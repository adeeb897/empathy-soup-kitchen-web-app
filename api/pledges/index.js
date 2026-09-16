const { getPool, sql } = require('../shared/db');
const { requireAdmin } = require('../shared/auth');

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// Pledge records hold donor contact details, home addresses and amounts, so
// reads and deletes require a valid admin session token (Authorization:
// Bearer <token>, issued by auth-verify-magic).
//
// POST stays public — the pledge form is filled in by anonymous visitors.
module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 200, headers: HEADERS };
    return;
  }

  // Gate everything except public form submissions.
  if (req.method !== 'POST') {
    const auth = requireAdmin(req);
    if (!auth.valid) {
      context.log.warn(`Unauthorized ${req.method} /api/pledges: ${auth.error}`);
      context.res = { status: auth.status, headers: HEADERS, body: { error: auth.error } };
      return;
    }
  }

  try {
    const pool = await getPool();
    const id = context.bindingData.id;

    if (req.method === 'GET') {
      const pledgeId = req.query.PledgeID;
      const email = req.query.Email;
      let result;

      if (pledgeId) {
        result = await pool.request()
          .input('PledgeID', sql.Int, parseInt(pledgeId))
          .query('SELECT * FROM dbo.Pledges WHERE PledgeID = @PledgeID');
      } else if (email) {
        result = await pool.request()
          .input('Email', sql.NVarChar(200), email)
          .query('SELECT * FROM dbo.Pledges WHERE Email = @Email ORDER BY SubmittedAt DESC');
      } else {
        result = await pool.request()
          .query('SELECT * FROM dbo.Pledges ORDER BY SubmittedAt DESC');
      }

      context.res = { status: 200, headers: HEADERS, body: { value: result.recordset } };
    }

    else if (req.method === 'POST') {
      const {
        Amount, AmountLabel, Name, Email, PhoneNumber, Address,
        VolunteerInterest, Frequency, Timing, PaymentMethod, Notes
      } = req.body || {};

      if (!Name || !Email) {
        context.res = {
          status: 400,
          headers: HEADERS,
          body: { error: 'Name and Email are required' }
        };
        return;
      }

      const parsedAmount = Number(Amount);

      const result = await pool.request()
        .input('Amount', sql.Decimal(10, 2), Number.isFinite(parsedAmount) ? parsedAmount : 0)
        .input('AmountLabel', sql.NVarChar(100), AmountLabel || null)
        .input('Name', sql.NVarChar(200), Name)
        .input('Email', sql.NVarChar(200), Email)
        .input('PhoneNumber', sql.NVarChar(50), PhoneNumber || null)
        .input('Address', sql.NVarChar(400), Address || null)
        .input('VolunteerInterest', sql.NVarChar(50), VolunteerInterest || null)
        .input('Frequency', sql.NVarChar(100), Frequency || null)
        .input('Timing', sql.NVarChar(100), Timing || null)
        .input('PaymentMethod', sql.NVarChar(50), PaymentMethod || null)
        .input('Notes', sql.NVarChar(sql.MAX), Notes || null)
        .query(`INSERT INTO dbo.Pledges
          (Amount, AmountLabel, Name, Email, PhoneNumber, Address, VolunteerInterest, Frequency, Timing, PaymentMethod, Notes)
          OUTPUT INSERTED.*
          VALUES (@Amount, @AmountLabel, @Name, @Email, @PhoneNumber, @Address, @VolunteerInterest, @Frequency, @Timing, @PaymentMethod, @Notes)`);

      context.res = { status: 201, headers: HEADERS, body: { value: result.recordset } };
    }

    else if (req.method === 'DELETE' && id) {
      await pool.request()
        .input('PledgeID', sql.Int, parseInt(id))
        .query('DELETE FROM dbo.Pledges WHERE PledgeID = @PledgeID');
      context.res = { status: 204, headers: HEADERS };
    }

    else {
      context.res = { status: 405, headers: HEADERS, body: { error: 'Method not allowed' } };
    }
  } catch (error) {
    context.log.error('Pledges API error:', error);
    context.res = { status: 500, headers: HEADERS, body: { error: error.message } };
  }
};
