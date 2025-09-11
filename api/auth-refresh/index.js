const https = require('https');

/**
 * Azure Function to refresh OAuth access tokens
 * Uses the refresh token stored in httpOnly cookies
 */
module.exports = async function (context, req) {
    // Set CORS headers
    context.res = {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Credentials': 'true',
            'Content-Type': 'application/json'
        }
    };

    // Handle preflight
    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        return;
    }

    try {
        // Get refresh token from httpOnly cookie
        const cookies = parseCookies(req.headers.cookie || '');
        const refreshToken = cookies.refreshToken;

        if (!refreshToken) {
            context.res.status = 401;
            context.res.body = { 
                error: 'No refresh token',
                message: 'Refresh token not found. Please log in again.' 
            };
            return;
        }

        // Get OAuth configuration
        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            context.log.error('OAuth configuration missing');
            context.res.status = 500;
            context.res.body = { 
                error: 'Server configuration error',
                message: 'OAuth configuration is not properly set up' 
            };
            return;
        }

        // Refresh the access token
        const tokenData = await refreshAccessToken(clientId, clientSecret, refreshToken);
        
        // Get updated user info
        const userInfo = await getUserInfo(tokenData.access_token);

        // Re-validate admin access (in case admin list changed)
        const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
        const isAdmin = adminEmails.includes(userInfo.email.toLowerCase());

        if (!isAdmin) {
            context.log.warn(`Admin access revoked for: ${userInfo.email}`);
            
            // Clear refresh token cookie
            context.res.headers['Set-Cookie'] = 'refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=0';
            context.res.status = 403;
            context.res.body = { 
                error: 'Access revoked',
                message: 'Your admin access has been revoked. Please contact an administrator.' 
            };
            return;
        }

        // Update refresh token cookie if a new one was provided
        if (tokenData.refresh_token) {
            const refreshTokenCookie = `refreshToken=${tokenData.refresh_token}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=${7 * 24 * 60 * 60}`;
            context.res.headers['Set-Cookie'] = refreshTokenCookie;
        }

        context.res.status = 200;
        context.res.body = {
            success: true,
            accessToken: tokenData.access_token,
            expiresIn: tokenData.expires_in,
            user: {
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture
            }
        };

    } catch (error) {
        context.log.error('Error in auth-refresh:', error);
        
        // If refresh token is invalid, clear the cookie
        if (error.message.includes('invalid_grant') || error.message.includes('invalid_token')) {
            context.res.headers['Set-Cookie'] = 'refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=0';
            context.res.status = 401;
            context.res.body = { 
                error: 'Token expired',
                message: 'Your session has expired. Please log in again.' 
            };
        } else {
            context.res.status = 500;
            context.res.body = { 
                error: 'Token refresh failed',
                message: error.message || 'An unexpected error occurred' 
            };
        }
    }
};

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(clientId, clientSecret, refreshToken) {
    const tokenParams = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
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
                    reject(new Error(`Token refresh failed: ${data}`));
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

/**
 * Parse cookies from cookie header string
 */
function parseCookies(cookieHeader) {
    const cookies = {};
    if (cookieHeader) {
        cookieHeader.split(';').forEach(cookie => {
            const [name, ...rest] = cookie.split('=');
            if (name && rest.length > 0) {
                cookies[name.trim()] = rest.join('=').trim();
            }
        });
    }
    return cookies;
}