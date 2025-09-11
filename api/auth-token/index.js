const https = require('https');
const crypto = require('crypto');

/**
 * Azure Function to exchange OAuth authorization code for tokens
 * This function implements the server-side part of OAuth 2.0 with PKCE
 */
module.exports = async function (context, req) {
    // Set CORS headers
    context.res = {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
        const { code, codeVerifier, redirectUri, state } = req.body;
        
        context.log.info('Auth token request received:', {
            hasCode: !!code,
            hasCodeVerifier: !!codeVerifier,
            hasRedirectUri: !!redirectUri,
            hasState: !!state,
            requestBody: JSON.stringify(req.body)
        });

        if (!code || !codeVerifier) {
            context.log.error('Missing required parameters:', {
                hasCode: !!code,
                hasCodeVerifier: !!codeVerifier
            });
            context.res.status = 400;
            context.res.body = { 
                error: 'Missing required parameters',
                message: 'code and codeVerifier are required' 
            };
            return;
        }

        // Get OAuth configuration from environment
        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
        const finalRedirectUri = redirectUri || process.env.GOOGLE_OAUTH_REDIRECT_URI;

        if (!clientId || !clientSecret || !finalRedirectUri) {
            context.log.error('OAuth configuration missing:', {
                hasClientId: !!clientId,
                hasClientSecret: !!clientSecret,
                hasRedirectUri: !!finalRedirectUri,
                requestRedirectUri: redirectUri,
                envRedirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI
            });
            context.res.status = 500;
            context.res.body = { 
                error: 'Server configuration error',
                message: 'OAuth configuration is not properly set up' 
            };
            return;
        }

        // Exchange code for tokens
        const tokenData = await exchangeCodeForTokens(clientId, clientSecret, finalRedirectUri, code, codeVerifier);
        
        // Get user info from Google
        const userInfo = await getUserInfo(tokenData.access_token);

        // Validate admin access
        const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(email => email.trim()).filter(Boolean);
        const isAdmin = adminEmails.includes(userInfo.email);

        if (!isAdmin) {
            context.log.warn(`Unauthorized access attempt by: ${userInfo.email}`);
            context.res.status = 403;
            context.res.body = { 
                error: 'Access denied',
                message: 'You are not authorized to access the admin panel' 
            };
            return;
        }

        // Set httpOnly cookie for refresh token (secure storage)
        const refreshTokenCookie = `refreshToken=${tokenData.refresh_token}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=${7 * 24 * 60 * 60}`; // 7 days

        context.res.status = 200;
        context.res.headers['Set-Cookie'] = refreshTokenCookie;
        context.res.body = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_in: tokenData.expires_in,
            token_type: tokenData.token_type || 'Bearer',
            scope: tokenData.scope || 'openid email profile'
        };

    } catch (error) {
        context.log.error('Error in auth-token:', error);
        context.res.status = 500;
        context.res.body = { 
            error: 'Authentication failed',
            message: error.message || 'An unexpected error occurred' 
        };
    }
};

/**
 * Exchange authorization code for access and refresh tokens
 */
async function exchangeCodeForTokens(clientId, clientSecret, redirectUri, code, codeVerifier) {
    const tokenParams = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
    });

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'oauth2.googleapis.com',
            path: '/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': tokenParams.toString().length
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`Token exchange failed: ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.write(tokenParams.toString());
        req.end();
    });
}

/**
 * Get user information from Google
 */
async function getUserInfo(accessToken) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'www.googleapis.com',
            path: '/oauth2/v2/userinfo',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`Failed to get user info: ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}