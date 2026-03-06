const { getPool } = require('../shared/db');

/**
 * Timer trigger that runs every 4 minutes to keep the Azure SQL database from
 * auto-pausing. Azure SQL serverless tier pauses after a period of inactivity
 * (default 1 hour), causing the next query to wait 30–60 s for the DB to resume.
 * A lightweight ping every 4 minutes prevents that pause entirely.
 */
module.exports = async function (context, timer) {
  if (timer.isPastDue) {
    context.log('DB keepalive timer is running late');
  }

  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1');
    context.log('DB keepalive ping successful');
  } catch (err) {
    context.log.error('DB keepalive ping failed:', err.message);
  }
};
