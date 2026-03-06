const { getPool, sql } = require('../shared/db');

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, HEAD, OPTIONS',
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

    if (req.method === 'HEAD') {
      context.res = { status: 200, headers: HEADERS };
      return;
    }

    if (req.method === 'GET') {
      const textName = req.query.TextName;
      let result;
      if (textName) {
        result = await pool.request()
          .input('TextName', sql.NVarChar(100), textName)
          .query('SELECT * FROM dbo.TextBoxes WHERE TextName = @TextName');
      } else {
        result = await pool.request().query('SELECT * FROM dbo.TextBoxes');
      }
      context.res = { status: 200, headers: HEADERS, body: { value: result.recordset } };
    }

    else if (req.method === 'POST') {
      const { TextName, TextContent } = req.body;
      const result = await pool.request()
        .input('TextName', sql.NVarChar(100), TextName)
        .input('TextContent', sql.NVarChar(sql.MAX), TextContent)
        .query('INSERT INTO dbo.TextBoxes (TextName, TextContent) OUTPUT INSERTED.* VALUES (@TextName, @TextContent)');
      context.res = { status: 201, headers: HEADERS, body: { value: result.recordset } };
    }

    else if (req.method === 'PATCH' && id) {
      const { TextContent } = req.body;
      const result = await pool.request()
        .input('ID', sql.Int, parseInt(id))
        .input('TextContent', sql.NVarChar(sql.MAX), TextContent)
        .query('UPDATE dbo.TextBoxes SET TextContent = @TextContent OUTPUT INSERTED.* WHERE ID = @ID');
      context.res = { status: 200, headers: HEADERS, body: { value: result.recordset } };
    }

    else {
      context.res = { status: 405, headers: HEADERS, body: { error: 'Method not allowed' } };
    }
  } catch (error) {
    context.log.error('TextBoxes API error:', error);
    context.res = { status: 500, headers: HEADERS, body: { error: error.message } };
  }
};
