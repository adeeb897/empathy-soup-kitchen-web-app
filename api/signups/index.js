const { getPool, sql } = require('../shared/db');
const { corsHeaders, errorResponse } = require('../shared/http');
const { requireAdmin } = require('../shared/auth');

const HEADERS = corsHeaders('GET, POST, PATCH, DELETE, OPTIONS', 'Content-Type, Authorization, X-Admin-Token');

// Columns safe to return to an unauthenticated caller. The public volunteer
// calendar only needs to count signups per shift to show remaining capacity —
// it never reads names, emails or phone numbers.
const PUBLIC_FIELDS = ['SignUpID', 'ShiftID', 'NumPeople'];

function toPublic(rows) {
  return rows.map((row) =>
    PUBLIC_FIELDS.reduce((out, field) => {
      out[field] = row[field];
      return out;
    }, {})
  );
}

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 200, headers: HEADERS };
    return;
  }

  const auth = requireAdmin(req);
  const isAdmin = auth.valid;

  // PATCH is admin-only (it flips ReminderSent). POST and DELETE stay public so
  // volunteers can sign up and cancel their own shifts.
  if (req.method === 'PATCH' && !isAdmin) {
    context.log.warn(`Unauthorized PATCH /api/signups: ${auth.error}`);
    context.res = { status: auth.status, headers: HEADERS, body: { error: auth.error } };
    return;
  }

  try {
    const pool = await getPool();
    const id = context.bindingData.id;

    if (req.method === 'GET') {
      const signUpId = req.query.SignUpID;
      const shiftId = req.query.ShiftID;
      const email = req.query.Email;
      let result;
      // Looking a signup up by its ID would let anyone walk the table by
      // incrementing an integer, so that lookup is admin-only.
      if (signUpId) {
        if (!isAdmin) {
          context.log.warn(`Unauthorized SignUpID lookup on /api/signups: ${auth.error}`);
          context.res = { status: auth.status, headers: HEADERS, body: { error: auth.error } };
          return;
        }
        result = await pool.request()
          .input('SignUpID', sql.Int, parseInt(signUpId))
          .query('SELECT * FROM dbo.SignUps WHERE SignUpID = @SignUpID');
      } else if (shiftId) {
        result = await pool.request()
          .input('ShiftID', sql.Int, parseInt(shiftId))
          .query('SELECT * FROM dbo.SignUps WHERE ShiftID = @ShiftID');
      } else if (email) {
        // Public: powers "find my signups to cancel". Returns only rows the
        // caller already identified by address.
        result = await pool.request()
          .input('Email', sql.NVarChar(200), email)
          .query('SELECT * FROM dbo.SignUps WHERE Email = @Email');
      } else {
        result = await pool.request().query('SELECT * FROM dbo.SignUps');
      }

      // Unauthenticated callers never receive contact details, except for the
      // email lookup above where they supplied the address themselves.
      const rows = isAdmin || email ? result.recordset : toPublic(result.recordset);
      context.res = { status: 200, headers: HEADERS, body: { value: rows } };
    }

    else if (req.method === 'POST') {
      const { ShiftID, Name, Email, PhoneNumber, NumPeople, ReminderSent } = req.body;
      const result = await pool.request()
        .input('ShiftID', sql.Int, ShiftID)
        .input('Name', sql.NVarChar(200), Name)
        .input('Email', sql.NVarChar(200), Email)
        .input('PhoneNumber', sql.NVarChar(50), PhoneNumber || null)
        .input('NumPeople', sql.Int, NumPeople || 1)
        .input('ReminderSent', sql.Bit, ReminderSent || false)
        .query('INSERT INTO dbo.SignUps (ShiftID, Name, Email, PhoneNumber, NumPeople, ReminderSent) OUTPUT INSERTED.* VALUES (@ShiftID, @Name, @Email, @PhoneNumber, @NumPeople, @ReminderSent)');
      context.res = { status: 201, headers: HEADERS, body: { value: result.recordset } };
    }

    else if (req.method === 'PATCH' && id) {
      const { ReminderSent } = req.body;
      const result = await pool.request()
        .input('SignUpID', sql.Int, parseInt(id))
        .input('ReminderSent', sql.Bit, ReminderSent)
        .query('UPDATE dbo.SignUps SET ReminderSent = @ReminderSent OUTPUT INSERTED.* WHERE SignUpID = @SignUpID');
      if (result.recordset.length === 0) {
        context.res = { status: 404, headers: HEADERS, body: { error: 'Signup not found' } };
      } else {
        context.res = { status: 200, headers: HEADERS, body: { value: result.recordset } };
      }
    }

    else if (req.method === 'DELETE' && id) {
      await pool.request()
        .input('SignUpID', sql.Int, parseInt(id))
        .query('DELETE FROM dbo.SignUps WHERE SignUpID = @SignUpID');
      context.res = { status: 204, headers: HEADERS };
    }

    else {
      context.res = { status: 405, headers: HEADERS, body: { error: 'Method not allowed' } };
    }
  } catch (error) {
    context.res = errorResponse(context, error, HEADERS);
  }
};
