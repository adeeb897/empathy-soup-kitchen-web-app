const crypto = require('crypto');

/**
 * Domains whose addresses are admins by default. Override with the
 * ADMIN_EMAIL_DOMAINS app setting (comma-separated) to add or remove one
 * without a deploy; set it to an empty string to require the explicit
 * ADMIN_EMAILS list only.
 */
const DEFAULT_ADMIN_DOMAINS = 'empathysoupkitchen.org';

function listFromEnv(value, fallback = '') {
  return String(value ?? fallback)
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Whether an address counts as an admin.
 *
 * Two ways to qualify, checked in this order:
 *   1. listed explicitly in ADMIN_EMAILS — for admins outside the org domain
 *   2. the address is at one of ADMIN_EMAIL_DOMAINS
 *
 * The domain is compared exactly against the part after the last "@", so
 * neither a lookalike domain (user@evil-empathysoupkitchen.org) nor a
 * subdomain (user@mail.empathysoupkitchen.org) matches by accident.
 */
function isAdminEmail(email) {
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!normalized) return false;

  if (listFromEnv(process.env.ADMIN_EMAILS).includes(normalized)) {
    return true;
  }

  const at = normalized.lastIndexOf('@');
  if (at === -1 || at === normalized.length - 1) return false;

  const domain = normalized.slice(at + 1);
  const domains = listFromEnv(process.env.ADMIN_EMAIL_DOMAINS, DEFAULT_ADMIN_DOMAINS)
    .map((d) => d.replace(/^@/, ''));

  return domains.includes(domain);
}

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

  // Re-checked on every request, so removing someone from ADMIN_EMAILS (or
  // from the admin domain) revokes access without waiting for token expiry.
  if (!isAdminEmail(email)) {
    return { valid: false, status: 403, error: 'Access denied' };
  }

  return { valid: true, email };
}

/**
 * Reads the admin session token from the request.
 *
 * X-Admin-Token is checked first and is the header the client relies on.
 * Azure Static Web Apps treats Authorization as its own — a request can
 * reach the function with an Authorization header whose value is not the
 * one the browser sent, which surfaces as a valid-looking token being
 * rejected as "Invalid token". A custom header is passed through untouched.
 *
 * Authorization is still accepted so direct API calls (curl, tests, any
 * non-SWA host) keep working.
 */
function getAdminToken(req) {
  const headers = req.headers || {};

  const custom = headers['x-admin-token'] || headers['X-Admin-Token'];
  if (custom && String(custom).trim()) return String(custom).trim();

  const authHeader = String(headers.authorization || headers.Authorization || '');
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match ? match[1] : null;
}

/** @deprecated use getAdminToken; kept so existing imports keep working. */
const getBearerToken = getAdminToken;

/** Convenience wrapper: verifies the request's admin session token. */
function requireAdmin(req) {
  return verifySessionToken(getAdminToken(req));
}

module.exports = { isAdminEmail, verifySessionToken, getAdminToken, getBearerToken, requireAdmin };
