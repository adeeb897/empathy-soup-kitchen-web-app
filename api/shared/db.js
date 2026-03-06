const sql = require('mssql');

let pool = null;

async function getPool() {
  if (pool) return pool;

  const connectionString = process.env.SQL_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('SQL_CONNECTION_STRING is not configured');
  }

  pool = await sql.connect(connectionString);
  return pool;
}

module.exports = { getPool, sql };
