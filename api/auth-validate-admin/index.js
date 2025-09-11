const https = require('https');

/**
 * Azure Function to validate admin access
 * Checks if the provided access token belongs to an authorized admin
 */
module.exports = async function (context, req) {
    // Set CORS headers
    context.res = {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Content-Type': 'application/json'
        }
    };

    // Handle preflight
    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        return;
    }

    try {
        const { accessToken } = req.body;
        const authHeader = req.headers.authorization;

        // Get access token from body or Authorization header
        const token = accessToken || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null);

        if (!token) {
            context.res.status = 401;
            context.res.body = { 
                error: 'No access token',
                message: 'Access token is required for validation' 
            };
            return;
        }

        // Get user info from Google using the access token
        const userInfo = await getUserInfo(token);

        // Check if user is in the admin list
        const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
        const isAdmin = adminEmails.includes(userInfo.email.toLowerCase());

        if (!isAdmin) {
            context.log.warn(`Unauthorized validation attempt by: ${userInfo.email}`);
            context.res.status = 403;
            context.res.body = { 
                error: 'Access denied',
                message: 'You are not authorized to access the admin panel',
                isAdmin: false
            };
            return;
        }

        // Log successful admin validation for audit purposes
        context.log.info(`Admin access validated for: ${userInfo.email}`);

        context.res.status = 200;
        context.res.body = {
            success: true,
            isAdmin: true,
            user: {
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture
            },
            permissions: {
                canManageShifts: true,
                canViewReports: true,
                canManageVolunteers: true
            }
        };

    } catch (error) {
        context.log.error('Error in auth-validate-admin:', error);

        // Handle specific error cases
        if (error.message.includes('invalid_token') || error.message.includes('401')) {
            context.res.status = 401;
            context.res.body = { 
                error: 'Invalid token',
                message: 'The provided access token is invalid or expired',
                isAdmin: false
            };
        } else if (error.message.includes('403')) {
            context.res.status = 403;
            context.res.body = { 
                error: 'Access denied',
                message: 'Insufficient permissions to access admin features',
                isAdmin: false
            };
        } else {
            context.res.status = 500;
            context.res.body = { 
                error: 'Validation failed',
                message: error.message || 'An unexpected error occurred during validation',
                isAdmin: false
            };
        }
    }
};

/**
 * Get user information from Google using access token
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
                    const errorMessage = `Failed to get user info (${res.statusCode}): ${data}`;
                    if (res.statusCode === 401) {
                        reject(new Error(`invalid_token: ${errorMessage}`));
                    } else if (res.statusCode === 403) {
                        reject(new Error(`403: ${errorMessage}`));
                    } else {
                        reject(new Error(errorMessage));
                    }
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}