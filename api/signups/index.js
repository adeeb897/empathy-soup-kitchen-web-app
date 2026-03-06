const { getPool, sql } = require('../shared/db');

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 200, headers: HEADERS };
    return;
  }

  try {
    const pool = await getPool();
    const id = context.bindingData.id;

    if (req.method === 'GET') {
      const result = await pool.request().query('SELECT * FROM dbo.SignUps');
      context.res = { status: 200, headers: HEADERS, body: { value: result.recordset } };
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
    context.log.error('Signups API error:', error);
    context.res = { status: 500, headers: HEADERS, body: { error: error.message } };
  }
};
