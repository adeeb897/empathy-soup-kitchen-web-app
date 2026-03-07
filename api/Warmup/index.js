const { getPool } = require('../shared/db');

/**
 * HTTP-triggered warmup endpoint.
 * Pre-initializes the DB connection pool so the first real request doesn't pay
 * the connection setup cost.
 */
module.exports = async function (context, req) {
  context.log('Warmup triggered — pre-initializing DB connection pool');
  try {
    await getPool();
    context.log('DB connection pool ready');
    context.res = { status: 200, body: 'warm' };
  } catch (err) {
    context.log.error('Warmup: DB connection failed:', err.message);
    context.res = { status: 500, body: 'DB warmup failed' };
  }
};
