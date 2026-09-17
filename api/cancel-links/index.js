const { getPool, sql } = require('../shared/db');
const { corsHeaders } = require('../shared/http');
const { mintCancelToken } = require('../shared/cancel-token');
const { sendMail, siteUrl, escapeHtml } = require('../shared/email');

const HEADERS = corsHeaders('POST, OPTIONS', 'Content-Type');

/**
 * Emails a volunteer the cancellation links for their upcoming shifts.
 *
 * Always answers identically whether or not the address has any signups, so
 * it cannot be used to check who volunteers here. The links themselves only
 * ever go to the address that owns them.
 */
module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 200, headers: HEADERS };
    return;
  }

  if (req.method !== 'POST') {
    context.res = { status: 405, headers: HEADERS, body: { error: 'Method not allowed' } };
    return;
  }

  // One response for every outcome below, including failures, so nothing about
  // the address leaks through status codes or timing-independent wording.
  const genericResponse = {
    status: 200,
    headers: HEADERS,
    body: {
      success: true,
      message:
        'If that address has upcoming shifts, we have emailed your cancellation links.'
    }
  };

  const email = String((req.body && req.body.email) || '').trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    context.res = genericResponse;
    return;
  }

  try {
    const pool = await getPool();

    const result = await pool.request()
      .input('Email', sql.NVarChar(200), email)
      .query(`
        SELECT s.SignUpID, s.Name, s.NumPeople, v.StartTime, v.EndTime
        FROM dbo.SignUps s
        INNER JOIN dbo.VolunteerShifts v ON v.ShiftID = s.ShiftID
        WHERE s.Email = @Email AND v.StartTime >= SYSUTCDATETIME()
        ORDER BY v.StartTime
      `);

    const signups = result.recordset || [];
    if (signups.length === 0) {
      context.res = genericResponse;
      return;
    }

    const base = siteUrl();
    const rows = signups
      .map((s) => {
        const when = new Date(s.StartTime).toLocaleString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit'
        });
        const link = `${base}/volunteer/cancel?t=${encodeURIComponent(mintCancelToken(s.SignUpID))}`;
        return `
          <div style="background:#f3ebdd;padding:16px;border-radius:8px;margin:12px 0">
            <p style="margin:0 0 4px"><strong>${escapeHtml(when)}</strong></p>
            <p style="margin:0 0 12px;color:#7d7068">${escapeHtml(String(s.NumPeople))} person(s)</p>
            <a href="${link}" style="display:inline-block;background:#bf6b3f;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Cancel this shift</a>
          </div>`;
      })
      .join('');

    const textRows = signups
      .map((s) => {
        const when = new Date(s.StartTime).toLocaleString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit'
        });
        return `${when}\n${base}/volunteer/cancel?t=${encodeURIComponent(mintCancelToken(s.SignUpID))}`;
      })
      .join('\n\n');

    await sendMail({
      to: email,
      subject: 'Your volunteer shift cancellation links',
      type: 'cancellation_links',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#3b2f2a;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0">
            <h1 style="margin:0;font-size:22px">Cancel a Volunteer Shift</h1>
          </div>
          <div style="background:#fbf6ef;padding:24px;border-radius:0 0 8px 8px">
            <p>Hi ${escapeHtml(signups[0].Name)},</p>
            <p>Here are your upcoming shifts. Use a button below to cancel one.</p>
            ${rows}
            <p style="color:#7d7068;font-size:13px">
              If you did not request this, you can ignore this email — nothing has changed.
            </p>
            <p>Thank you,<br>The Empathy Soup Kitchen Team</p>
          </div>
        </div>`,
      text:
        `Cancel a Volunteer Shift\n\nHi ${signups[0].Name},\n\n` +
        `Here are your upcoming shifts. Open a link below to cancel one.\n\n${textRows}\n\n` +
        `If you did not request this, you can ignore this email — nothing has changed.\n\n` +
        `Thank you,\nThe Empathy Soup Kitchen Team`
    });

    context.res = genericResponse;
  } catch (error) {
    // Even a failure answers the same way; the detail goes to the logs only.
    context.log.error('Cancellation links request failed:', error);
    context.res = genericResponse;
  }
};
