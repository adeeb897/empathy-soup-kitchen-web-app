const crypto = require('crypto');
const nodemailer = require('nodemailer');

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
    const { email } = req.body || {};
    if (!email) {
      context.res = { status: 400, headers: CORS_HEADERS, body: { error: 'Email is required' } };
      return;
    }

    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    if (!adminEmails.includes(email.trim().toLowerCase())) {
      // Return same response to avoid email enumeration
      context.res = {
        status: 200,
        headers: CORS_HEADERS,
        body: { success: true, message: 'If this email is an admin, a login link has been sent.' }
      };
      return;
    }

    const secret = process.env.MAGIC_LINK_SECRET;
    if (!secret) {
      context.log.error('MAGIC_LINK_SECRET not configured');
      context.res = { status: 500, headers: CORS_HEADERS, body: { error: 'Server configuration error' } };
      return;
    }

    // Token: email + expiry (15 minutes), signed with HMAC
    const expiry = Date.now() + 15 * 60 * 1000;
    const payload = `${email.trim().toLowerCase()}:${expiry}`;
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const token = Buffer.from(payload).toString('base64url') + '.' + signature;

    // Build magic link
    const baseUrl = process.env.SITE_URL || 'https://empathysoupkitchen.org';
    const magicLink = `${baseUrl}/volunteer/admin?token=${encodeURIComponent(token)}`;

    // Send email
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SMTP_HOST,
      port: parseInt(process.env.EMAIL_SMTP_PORT),
      secure: process.env.EMAIL_SMTP_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_SMTP_USERNAME,
        pass: process.env.EMAIL_SMTP_PASSWORD
      }
    });

    await transporter.sendMail({
      from: `${process.env.EMAIL_SENDER_NAME || 'Empathy Soup Kitchen'} <${process.env.EMAIL_SENDER_EMAIL}>`,
      to: email,
      subject: 'Admin Login - Empathy Soup Kitchen',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#3B2F2A;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0">
            <h1 style="margin:0;font-size:24px">Admin Login</h1>
          </div>
          <div style="background:#FBF6EF;padding:24px;border-radius:0 0 8px 8px">
            <p>Click the button below to sign in to the volunteer admin panel.</p>
            <div style="text-align:center;margin:24px 0">
              <a href="${magicLink}" style="display:inline-block;background:#BF6B3F;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">
                Sign In
              </a>
            </div>
            <p style="color:#666;font-size:13px">This link expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
          </div>
        </div>
      `,
      text: `Admin Login\n\nClick this link to sign in:\n${magicLink}\n\nThis link expires in 15 minutes.`
    });

    context.log(`Magic link sent to ${email}`);
    context.res = {
      status: 200,
      headers: CORS_HEADERS,
      body: { success: true, message: 'If this email is an admin, a login link has been sent.' }
    };

  } catch (error) {
    context.log.error('Magic link error:', error);
    context.res = { status: 500, headers: CORS_HEADERS, body: { error: 'Failed to process request' } };
  }
};
