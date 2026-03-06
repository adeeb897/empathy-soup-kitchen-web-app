const crypto = require('crypto');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 200, headers: CORS_HEADERS };
    return;
  }

  try {
    const { token } = req.body || {};
    if (!token) {
      context.res = { status: 400, headers: CORS_HEADERS, body: { error: 'Token is required' } };
      return;
    }

    const secret = process.env.MAGIC_LINK_SECRET;
    if (!secret) {
      context.log.error('MAGIC_LINK_SECRET not configured');
      context.res = { status: 500, headers: CORS_HEADERS, body: { error: 'Server configuration error' } };
      return;
    }

    // Parse token: base64url(email:expiry).signature
    const parts = token.split('.');
    if (parts.length !== 2) {
      context.res = { status: 401, headers: CORS_HEADERS, body: { error: 'Invalid token format' } };
      return;
    }

    const [payloadB64, signature] = parts;
    const payload = Buffer.from(payloadB64, 'base64url').toString();
    const [email, expiryStr] = payload.split(':');
    const expiry = parseInt(expiryStr, 10);

    // Verify signature
    const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'))) {
      context.res = { status: 401, headers: CORS_HEADERS, body: { error: 'Invalid token' } };
      return;
    }

    // Check expiry
    if (Date.now() > expiry) {
      context.res = { status: 401, headers: CORS_HEADERS, body: { error: 'Token has expired' } };
      return;
    }

    // Double-check admin list
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    if (!adminEmails.includes(email.toLowerCase())) {
      context.res = { status: 403, headers: CORS_HEADERS, body: { error: 'Access denied' } };
      return;
    }

    // Generate a session token (valid for 24 hours)
    const sessionExpiry = Date.now() + 24 * 60 * 60 * 1000;
    const sessionPayload = `${email}:${sessionExpiry}`;
    const sessionSig = crypto.createHmac('sha256', secret).update(sessionPayload).digest('hex');
    const sessionToken = Buffer.from(sessionPayload).toString('base64url') + '.' + sessionSig;

    context.log(`Admin authenticated via magic link: ${email}`);
    context.res = {
      status: 200,
      headers: CORS_HEADERS,
      body: {
        valid: true,
        isAdmin: true,
        email,
        name: email.split('@')[0],
        sessionToken,
        expiresAt: sessionExpiry
      }
    };

  } catch (error) {
    context.log.error('Verify magic link error:', error);
    context.res = { status: 500, headers: CORS_HEADERS, body: { error: 'Verification failed' } };
  }
};
