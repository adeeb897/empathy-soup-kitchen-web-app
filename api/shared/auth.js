const crypto = require('crypto');

/**
 * Verifies an admin session token issued by auth-verify-magic.
 *
 * Token format: base64url(email:expiry).hmacSha256Hex
 * Signed with MAGIC_LINK_SECRET, so verification is pure crypto — no
 * database lookup or session store needed.
 *
 * Returns { valid: true, email } or { valid: false, status, error }.
 */
function verifySessionToken(token) {
  if (!token) {
    return { valid: false, status: 401, error: 'Authentication required' };
  }

  const secret = process.env.MAGIC_LINK_SECRET;
  if (!secret) {
    // Misconfiguration, not a client error — never fall through to allowing access.
    return { valid: false, status: 500, error: 'Server configuration error' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, status: 401, error: 'Invalid token' };
  }

  const [payloadB64, signature] = parts;

  let payload;
  try {
    payload = Buffer.from(payloadB64, 'base64url').toString();
  } catch {
    return { valid: false, status: 401, error: 'Invalid token' };
  }

  const separator = payload.lastIndexOf(':');
  if (separator === -1) {
    return { valid: false, status: 401, error: 'Invalid token' };
  }

  const email = payload.slice(0, separator);
  const expiry = parseInt(payload.slice(separator + 1), 10);
  if (!email || !Number.isFinite(expiry)) {
    return { valid: false, status: 401, error: 'Invalid token' };
  }

  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  // timingSafeEqual throws on length mismatch, so compare lengths first.
  // A malformed signature must yield 401, never a 500.
  const providedBuf = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return { valid: false, status: 401, error: 'Invalid token' };
  }

  if (Date.now() > expiry) {
    return { valid: false, status: 401, error: 'Session expired' };
  }

  // Re-check the admin list on every request, so removing someone from
  // ADMIN_EMAILS revokes their access without waiting for token expiry.
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.includes(email.toLowerCase())) {
    return { valid: false, status: 403, error: 'Access denied' };
  }

  return { valid: true, email };
}

/** Pulls the bearer token out of an Authorization header. */
function getBearerToken(req) {
  const header =
    (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/** Convenience wrapper: verifies the request's bearer token. */
function requireAdmin(req) {
  return verifySessionToken(getBearerToken(req));
}

module.exports = { verifySessionToken, getBearerToken, requireAdmin };
