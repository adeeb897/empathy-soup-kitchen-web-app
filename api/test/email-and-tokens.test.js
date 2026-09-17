/**
 * Covers the two pieces of api/shared that have no other safety net: the mailer
 * and the signed cancellation tokens.
 *
 * The mailer is exercised against a real SMTP conversation rather than a stub,
 * because what breaks on a nodemailer upgrade is the wire behaviour — headers,
 * multipart structure, the AUTH handshake — not whether the module loads. A
 * stub would have passed happily through every version.
 *
 * Plain node, no test framework: the API has no dev dependencies to speak of
 * and this runs anywhere `node` does. `npm test` in api/ runs it.
 */
const net = require('net');
const assert = require('assert');

const checks = [];
function check(name, fn) {
  try {
    fn();
    checks.push({ name, pass: true });
  } catch (e) {
    checks.push({ name, pass: false, detail: e.message });
  }
}

/** An SMTP server that speaks just enough to accept one message. */
function startSmtpServer(onMessage) {
  return new Promise((resolve) => {
    let body = '';
    const server = net.createServer((sock) => {
      let inData = false;
      sock.write('220 localhost ESMTP test\r\n');
      sock.on('data', (buf) => {
        const raw = buf.toString();
        if (inData) {
          body += raw;
          if (/\r\n\.\r\n$/.test(body)) {
            inData = false;
            onMessage(body);
            sock.write('250 OK queued\r\n');
          }
          return;
        }
        for (const line of raw.split('\r\n').filter(Boolean)) {
          const cmd = line.toUpperCase();
          if (cmd.startsWith('EHLO')) sock.write('250-localhost\r\n250-AUTH PLAIN LOGIN\r\n250 OK\r\n');
          else if (cmd.startsWith('DATA')) { inData = true; sock.write('354 Go ahead\r\n'); }
          else if (cmd.startsWith('QUIT')) { sock.write('221 Bye\r\n'); sock.end(); }
          else sock.write('250 OK\r\n');
        }
      });
      sock.on('error', () => {});
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  let delivered = '';
  const server = await startSmtpServer((b) => { delivered = b; });
  const port = server.address().port;

  Object.assign(process.env, {
    EMAIL_SMTP_HOST: '127.0.0.1',
    EMAIL_SMTP_PORT: String(port),
    EMAIL_SMTP_SECURE: 'false',
    EMAIL_SMTP_USERNAME: 'user',
    EMAIL_SMTP_PASSWORD: 'pass',
    EMAIL_SENDER_EMAIL: 'info@empathysoupkitchen.org',
    EMAIL_SENDER_NAME: 'Empathy Soup Kitchen',
    MAGIC_LINK_SECRET: 'test-secret-not-a-real-one',
  });

  const { sendMail, missingEmailConfig, escapeHtml, siteUrl } = require('../shared/email');
  const { mintCancelToken, verifyCancelToken } = require('../shared/cancel-token');
  const { errorResponse } = require('../shared/http');

  // ── mailer ────────────────────────────────────────────────────────────
  check('missingEmailConfig reports nothing when fully configured',
    () => assert.deepStrictEqual(missingEmailConfig(), []));

  let sendError = null;
  try {
    const info = await sendMail({
      to: 'volunteer@example.com',
      subject: 'Your volunteer shift cancellation links',
      type: 'cancellation_links',
      html: '<p>Hi Dana,</p><a href="https://example.org/c">Cancel this shift</a>',
      text: 'Hi Dana,\nhttps://example.org/c',
    });
    assert.ok(info.messageId, 'no messageId returned');
  } catch (e) {
    sendError = e;
  }
  check('sendMail delivers over SMTP', () => assert.strictEqual(sendError, null));
  check('subject reaches the wire', () => assert.match(delivered, /Your volunteer shift cancellation links/));
  check('From carries sender name and address',
    () => assert.match(delivered, /From: Empathy Soup Kitchen <info@empathysoupkitchen\.org>/));
  check('To is preserved', () => assert.match(delivered, /To: volunteer@example\.com/));
  check('X-Email-Type header survives', () => assert.match(delivered, /X-Email-Type: cancellation_links/));
  check('html and text are sent as multipart',
    () => assert.match(delivered, /Content-Type: multipart\/alternative/));

  check('escapeHtml neutralises markup in volunteer-supplied names',
    () => assert.strictEqual(escapeHtml('<script>alert(1)</script>'),
      '&lt;script&gt;alert(1)&lt;/script&gt;'));
  check('siteUrl falls back to the public site',
    () => assert.strictEqual(siteUrl(), 'https://empathysoupkitchen.org'));

  const saved = process.env.EMAIL_SMTP_HOST;
  delete process.env.EMAIL_SMTP_HOST;
  check('missingEmailConfig names what is absent',
    () => assert.deepStrictEqual(missingEmailConfig(), ['EMAIL_SMTP_HOST']));
  process.env.EMAIL_SMTP_HOST = saved;

  // ── cancellation tokens ───────────────────────────────────────────────
  const token = mintCancelToken(4242);
  check('a minted token verifies and names its signup', () => {
    const r = verifyCancelToken(token);
    assert.strictEqual(r.valid, true);
    assert.strictEqual(r.signupId, 4242);
  });
  check('a tampered signature is rejected',
    () => assert.strictEqual(verifyCancelToken(token.slice(0, -1) + '0').valid, false));
  check('a token for another signup cannot be forged by editing the payload', () => {
    const [payload, sig] = token.split('.');
    const swapped = Buffer.from(
      Buffer.from(payload, 'base64url').toString().replace('4242', '4243')
    ).toString('base64url');
    assert.strictEqual(verifyCancelToken(swapped + '.' + sig).valid, false);
  });
  check('an admin session token is not accepted as a cancellation token', () => {
    const fake = Buffer.from('admin@empathysoupkitchen.org:9999999999999').toString('base64url');
    assert.strictEqual(verifyCancelToken(fake + '.deadbeef').valid, false);
  });
  check('an expired token is rejected',
    () => assert.strictEqual(verifyCancelToken(mintCancelToken(1, -1000)).valid, false));
  check('a missing token is rejected',
    () => assert.strictEqual(verifyCancelToken('').valid, false));
  check('a malformed token is a 401, not a crash', () => {
    const r = verifyCancelToken('not-a-token');
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.status, 401);
  });

  // ── error responses ───────────────────────────────────────────────────
  const ctx = { log: Object.assign(() => {}, { error: () => {} }) };
  check('a 500 does not leak the driver message to the client', () => {
    const res = errorResponse(ctx, new Error("Invalid column name 'Email' on dbo.SignUps"), {});
    assert.strictEqual(res.status, 500);
    assert.ok(!/SignUps|column/i.test(res.body.error),
      'response body leaked schema detail: ' + res.body.error);
  });
  check('a resuming database still asks the client to retry', () => {
    const warming = Object.assign(new Error('paused'), { number: 40613 });
    const res = errorResponse(ctx, warming, {});
    assert.strictEqual(res.status, 503);
    assert.strictEqual(res.body.state, 'warming');
  });

  // ── report ────────────────────────────────────────────────────────────
  let failed = 0;
  for (const c of checks) {
    if (!c.pass) failed++;
    console.log((c.pass ? 'ok   ' : 'FAIL ') + c.name + (c.detail ? '\n       ' + c.detail : ''));
  }
  console.log('\n' + (checks.length - failed) + '/' + checks.length + ' passed');
  server.close();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
