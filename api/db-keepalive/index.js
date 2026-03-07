const { getPool } = require('../shared/db');

/**
 * HTTP endpoint that pings the Azure SQL database to prevent auto-pause.
 * Azure SQL serverless tier pauses after a period of inactivity (default 1 hour),
 * causing the next query to wait 30–60 s for the DB to resume.
 * Call GET /api/db-keepalive every 4 minutes via an external scheduler
 * (e.g. GitHub Actions scheduled workflow or Azure Logic App) to prevent that pause.
 */
module.exports = async function (context, req) {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1');
    context.log('DB keepalive ping successful');
    context.res = { status: 200, body: 'ok' };
  } catch (err) {
    context.log.error('DB keepalive ping failed:', err.message);
    context.res = { status: 500, body: 'ping failed' };
  }
};
