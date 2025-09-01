const https = require('https');

/**
 * Azure Function to handle user logout
 * Revokes tokens with Google and clears httpOnly cookies
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
        const { accessToken } = req.body;
        
        // Get refresh token from httpOnly cookie
        const cookies = parseCookies(req.headers.cookie || '');
        const refreshToken = cookies.refreshToken;

        // Always clear the refresh token cookie
        const clearCookie = 'refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=0';
        context.res.headers = context.res.headers || {};
        context.res.headers['Set-Cookie'] = clearCookie;

        // Attempt to revoke tokens with Google (best effort)
        const revokePromises = [];
        
        if (accessToken) {
            revokePromises.push(revokeToken(accessToken).catch(err => {
                context.log.warn('Failed to revoke access token:', err.message);
            }));
        }
        
        if (refreshToken) {
            revokePromises.push(revokeToken(refreshToken).catch(err => {
                context.log.warn('Failed to revoke refresh token:', err.message);
            }));
        }

        // Wait for all revocation attempts to complete
        await Promise.allSettled(revokePromises);

        // Get user info for logging (if access token is still valid)
        let userEmail = 'unknown';
        if (accessToken) {
            try {
                const userInfo = await getUserInfo(accessToken);
                userEmail = userInfo.email;
            } catch (error) {
                // Token might already be invalid, which is fine for logout
                context.log.info('Could not get user info during logout (token might be expired)');
            }
        }

        // Log successful logout for audit purposes
        context.log.info(`User logged out: ${userEmail}`);

        context.res.status = 200;
        context.res.body = {
            success: true,
            message: 'Logged out successfully'
        };

    } catch (error) {
        context.log.error('Error in auth-logout:', error);
        
        // Even if there's an error, we still want to clear the cookie
        // and return success because the user wants to log out
        context.res.status = 200;
        context.res.body = {
            success: true,
            message: 'Logged out successfully (with cleanup errors)',
            warning: 'Some cleanup operations failed but you are logged out'
        };
    }
};

/**
 * Revoke a token (access or refresh) with Google
 */
async function revokeToken(token) {
    return new Promise((resolve, reject) => {
        const revokeUrl = `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`;
        
        const options = {
            hostname: 'oauth2.googleapis.com',
            path: `/revoke?token=${encodeURIComponent(token)}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve();
                } else {
                    // Don't reject on revoke failure - user still wants to log out
                    resolve();
                }
            });
        });

        req.on('error', (error) => {
            // Don't reject on network errors - user still wants to log out
            resolve();
        });
        
        req.end();
    });
}

/**
 * Get user information from Google (for logging purposes)
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