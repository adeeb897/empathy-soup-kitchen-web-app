const crypto = require('crypto');

/**
 * Tokens that authorise cancelling one specific signup.
 *
 * Format: base64url("cancel:<signupId>:<expiry>").hmacSha256Hex
 *
 * Signed with MAGIC_LINK_SECRET, the same secret as admin sessions, but the
 * "cancel" prefix means the two payload shapes can never be mistaken for one
 * another — an admin session token cannot be replayed as a cancellation
 * token, or the reverse.
 *
 * A token names the signup it may cancel, so holding one grants nothing
 * beyond cancelling that shift.
 */

const PREFIX = 'cancel';
/** Long enough to outlast any reasonable gap between signing up and cancelling. */
const DEFAULT_TTL_MS = 120 * 24 * 60 * 60 * 1000;

function mintCancelToken(signupId, ttlMs = DEFAULT_TTL_MS) {
  const secret = process.env.MAGIC_LINK_SECRET;
  if (!secret) return null;

  const id = parseInt(signupId, 10);
  if (!Number.isFinite(id)) return null;

  const payload = `${PREFIX}:${id}:${Date.now() + ttlMs}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64url') + '.' + signature;
}

/**
 * Returns { valid: true, signupId } or { valid: false, status, error }.
 * Never throws: a malformed token is a 401, not a 500.
 */
function verifyCancelToken(token) {
  if (!token) {
    return { valid: false, status: 401, error: 'Cancellation link is required' };
  }

  const secret = process.env.MAGIC_LINK_SECRET;
  if (!secret) {
    return { valid: false, status: 500, error: 'Server configuration error' };
  }

  const parts = String(token).split('.');
  if (parts.length !== 2) {
    return { valid: false, status: 401, error: 'Invalid cancellation link' };
  }

  const [payloadB64, signature] = parts;

  let payload;
  try {
    payload = Buffer.from(payloadB64, 'base64url').toString();
  } catch {
    return { valid: false, status: 401, error: 'Invalid cancellation link' };
  }

  const segments = payload.split(':');
  if (segments.length !== 3 || segments[0] !== PREFIX) {
    return { valid: false, status: 401, error: 'Invalid cancellation link' };
  }

  const signupId = parseInt(segments[1], 10);
  const expiry = parseInt(segments[2], 10);
  if (!Number.isFinite(signupId) || !Number.isFinite(expiry)) {
    return { valid: false, status: 401, error: 'Invalid cancellation link' };
  }

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const providedBuf = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return { valid: false, status: 401, error: 'Invalid cancellation link' };
  }

  if (Date.now() > expiry) {
    return { valid: false, status: 401, error: 'This cancellation link has expired' };
  }

  return { valid: true, signupId };
}

module.exports = { mintCancelToken, verifyCancelToken, DEFAULT_TTL_MS };
