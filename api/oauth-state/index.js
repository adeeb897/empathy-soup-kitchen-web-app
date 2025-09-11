const crypto = require('crypto');

// In-memory storage for OAuth states (in production, use Redis or database)
const stateStorage = new Map();

// Clean up expired states every hour
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of stateStorage.entries()) {
        if (now > value.expiresAt) {
            stateStorage.delete(key);
        }
    }
}, 60 * 60 * 1000);

/**
 * Azure Function to manage OAuth state server-side
 * Supports storing and retrieving OAuth state securely on the server
 */
module.exports = async function (context, req) {
    // Set CORS headers
    context.res = {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Content-Type': 'application/json'
        }
    };

    // Handle preflight
    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        return;
    }

    try {
        const method = req.method;
        const { action } = req.query;

        switch (method) {
            case 'POST':
                if (action === 'store') {
                    await handleStoreState(context, req);
                } else {
                    context.res.status = 400;
                    context.res.body = { error: 'Invalid action. Use ?action=store' };
                }
                break;

            case 'GET':
                if (action === 'retrieve') {
                    await handleRetrieveState(context, req);
                } else {
                    context.res.status = 400;
                    context.res.body = { error: 'Invalid action. Use ?action=retrieve' };
                }
                break;

            case 'DELETE':
                if (action === 'cleanup') {
                    await handleCleanupState(context, req);
                } else {
                    context.res.status = 400;
                    context.res.body = { error: 'Invalid action. Use ?action=cleanup' };
                }
                break;

            default:
                context.res.status = 405;
                context.res.body = { error: 'Method not allowed' };
        }

    } catch (error) {
        context.log.error('Error in oauth-state:', error);
        context.res.status = 500;
        context.res.body = { 
            error: 'Internal server error',
            message: error.message 
        };
    }
};

/**
 * Store OAuth state securely on the server
 */
async function handleStoreState(context, req) {
    const { state, codeVerifier, redirectUri } = req.body;

    if (!state || !codeVerifier || !redirectUri) {
        context.res.status = 400;
        context.res.body = { 
            error: 'Missing required parameters',
            message: 'state, codeVerifier, and redirectUri are required' 
        };
        return;
    }

    // Generate a secure session ID
    const sessionId = crypto.randomBytes(32).toString('hex');
    
    // Store the OAuth state with expiration (30 minutes)
    const expiresAt = Date.now() + (30 * 60 * 1000);
    
    stateStorage.set(sessionId, {
        state,
        codeVerifier,
        redirectUri,
        expiresAt,
        createdAt: Date.now()
    });

    context.log.info('OAuth state stored:', {
        sessionId: sessionId.substring(0, 8) + '...',
        state: state.substring(0, 8) + '...',
        expiresAt: new Date(expiresAt).toISOString()
    });

    context.res.status = 200;
    context.res.body = {
        success: true,
        sessionId,
        expiresAt
    };
}

/**
 * Retrieve OAuth state from the server
 */
async function handleRetrieveState(context, req) {
    const { sessionId, state } = req.query;

    if (!sessionId || !state) {
        context.res.status = 400;
        context.res.body = { 
            error: 'Missing required parameters',
            message: 'sessionId and state query parameters are required' 
        };
        return;
    }

    const storedData = stateStorage.get(sessionId);

    if (!storedData) {
        context.log.warn('OAuth state not found:', { sessionId: sessionId.substring(0, 8) + '...' });
        context.res.status = 404;
        context.res.body = { 
            error: 'State not found',
            message: 'OAuth state has expired or is invalid' 
        };
        return;
    }

    // Check if expired
    if (Date.now() > storedData.expiresAt) {
        stateStorage.delete(sessionId);
        context.log.warn('OAuth state expired:', { sessionId: sessionId.substring(0, 8) + '...' });
        context.res.status = 410;
        context.res.body = { 
            error: 'State expired',
            message: 'OAuth state has expired' 
        };
        return;
    }

    // Validate state parameter
    if (state !== storedData.state) {
        context.log.error('OAuth state mismatch - possible CSRF attack:', {
            sessionId: sessionId.substring(0, 8) + '...',
            receivedState: state.substring(0, 8) + '...',
            storedState: storedData.state.substring(0, 8) + '...'
        });
        context.res.status = 403;
        context.res.body = { 
            error: 'State mismatch',
            message: 'OAuth state validation failed - possible CSRF attack' 
        };
        return;
    }

    context.log.info('OAuth state retrieved successfully:', {
        sessionId: sessionId.substring(0, 8) + '...'
    });

    context.res.status = 200;
    context.res.body = {
        success: true,
        state: storedData.state,
        codeVerifier: storedData.codeVerifier,
        redirectUri: storedData.redirectUri
    };
}

/**
 * Clean up OAuth state after successful use
 */
async function handleCleanupState(context, req) {
    const { sessionId } = req.query;

    if (!sessionId) {
        context.res.status = 400;
        context.res.body = { 
            error: 'Missing required parameters',
            message: 'sessionId query parameter is required' 
        };
        return;
    }

    const existed = stateStorage.delete(sessionId);

    context.log.info('OAuth state cleanup:', {
        sessionId: sessionId.substring(0, 8) + '...',
        existed
    });

    context.res.status = 200;
    context.res.body = {
        success: true,
        cleaned: existed
    };
}