const { getPool } = require('../shared/db');

/**
 * Azure Functions warmup trigger.
 * Fires when a new function app instance is loading, before it receives traffic.
 * Pre-initializes the DB connection pool so the first real request doesn't pay
 * the connection setup cost.
 */
module.exports = async function (context) {
  context.log('Warmup trigger fired — pre-initializing DB connection pool');
  try {
    await getPool();
    context.log('DB connection pool ready');
  } catch (err) {
    context.log.error('Warmup: DB connection failed:', err.message);
  }
};
