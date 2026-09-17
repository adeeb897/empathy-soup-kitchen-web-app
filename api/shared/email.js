const nodemailer = require('nodemailer');

const REQUIRED_ENV = [
  'EMAIL_SMTP_HOST',
  'EMAIL_SMTP_PORT',
  'EMAIL_SMTP_USERNAME',
  'EMAIL_SMTP_PASSWORD',
  'EMAIL_SENDER_EMAIL',
  'EMAIL_SENDER_NAME',
];

/** Environment variables the mailer needs but does not have. */
function missingEmailConfig() {
  return REQUIRED_ENV.filter((name) => !process.env[name]);
}

/**
 * Sends one email over SMTP.
 *
 * Extracted from the send-email function so other functions can send mail
 * directly — cancellation links have to be composed server-side, since the
 * tokens in them are signed with a secret the browser must never see.
 *
 * Throws on failure; callers decide how much to tell the client.
 */
async function sendMail({ to, subject, html, text, type }) {
  const missing = missingEmailConfig();
  if (missing.length > 0) {
    throw new Error(`Email is not configured: missing ${missing.join(', ')}`);
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST,
    port: parseInt(process.env.EMAIL_SMTP_PORT, 10),
    secure: process.env.EMAIL_SMTP_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_SMTP_USERNAME,
      pass: process.env.EMAIL_SMTP_PASSWORD,
    },
  });

  await transporter.verify();

  const mailOptions = {
    from: `${process.env.EMAIL_SENDER_NAME} <${process.env.EMAIL_SENDER_EMAIL}>`,
    to,
    subject,
    html,
    text: text || String(html || '').replace(/<[^>]*>/g, ''),
  };

  if (type) {
    mailOptions.headers = { 'X-Email-Type': type };
  }

  return transporter.sendMail(mailOptions);
}

/** Base URL for links in outgoing mail. */
function siteUrl() {
  return process.env.SITE_URL || 'https://empathysoupkitchen.org';
}

/** Escapes a value before putting it into email markup. */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { sendMail, missingEmailConfig, siteUrl, escapeHtml };
