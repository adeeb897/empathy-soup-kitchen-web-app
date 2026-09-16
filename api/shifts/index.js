const { getPool, sql } = require('../shared/db');
const { corsHeaders, errorResponse } = require('../shared/http');

const HEADERS = corsHeaders('GET, POST, DELETE, OPTIONS');

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 200, headers: HEADERS };
    return;
  }

  try {
    const pool = await getPool();
    const id = context.bindingData.id;

    if (req.method === 'GET') {
      const shiftId = req.query.ShiftID;
      let result;
      if (shiftId) {
        result = await pool.request()
          .input('ShiftID', sql.Int, parseInt(shiftId))
          .query('SELECT * FROM dbo.VolunteerShifts WHERE ShiftID = @ShiftID');
      } else {
        result = await pool.request().query('SELECT * FROM dbo.VolunteerShifts');
      }
      context.res = { status: 200, headers: HEADERS, body: { value: result.recordset } };
    }

    else if (req.method === 'POST') {
      const { StartTime, EndTime, Capacity } = req.body;
      const result = await pool.request()
        .input('StartTime', sql.DateTime2, StartTime)
        .input('EndTime', sql.DateTime2, EndTime)
        .input('Capacity', sql.Int, Capacity)
        .query('INSERT INTO dbo.VolunteerShifts (StartTime, EndTime, Capacity) OUTPUT INSERTED.* VALUES (@StartTime, @EndTime, @Capacity)');
      context.res = { status: 201, headers: HEADERS, body: { value: result.recordset } };
    }

    else if (req.method === 'DELETE' && id) {
      await pool.request()
        .input('ShiftID', sql.Int, parseInt(id))
        .query('DELETE FROM dbo.VolunteerShifts WHERE ShiftID = @ShiftID');
      context.res = { status: 204, headers: HEADERS };
    }

    else {
      context.res = { status: 405, headers: HEADERS, body: { error: 'Method not allowed' } };
    }
  } catch (error) {
    context.res = errorResponse(context, error, HEADERS);
  }
};
