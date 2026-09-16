const { getPool, isWarmingUp } = require('../shared/db');
const { corsHeaders, RETRY_AFTER_SECONDS } = require('../shared/http');

const HEADERS = corsHeaders('GET, OPTIONS');
// Short budget: the browser polls this endpoint, so answer quickly with the
// current state rather than holding the request open while the database resumes.
const PROBE_BUDGET_MS = 6000;

/**
 * Readiness probe for the volunteer sign-up database.
 *
 * Touching a paused Azure SQL serverless database is what triggers its resume,
 * so calling this early (when someone heads towards the volunteer page) starts
 * the 30-90 s wake-up before the page actually needs data. Returns immediately
 * with `ready: false` while the resume is still in progress.
 */
module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 200, headers: HEADERS };
    return;
  }

  try {
    const pool = await getPool({ budgetMs: PROBE_BUDGET_MS });
    await pool.request().query('SELECT 1');
    context.res = { status: 200, headers: HEADERS, body: { ready: true, state: 'ready' } };
  } catch (error) {
    if (isWarmingUp(error)) {
      context.log('Warmup: database still resuming');
      context.res = {
        status: 200,
        headers: { ...HEADERS, 'Retry-After': String(RETRY_AFTER_SECONDS) },
        body: { ready: false, state: 'warming' }
      };
      return;
    }

    context.log.error('Warmup failed:', error.message);
    context.res = { status: 500, headers: HEADERS, body: { ready: false, state: 'error', error: error.message } };
  }
};
