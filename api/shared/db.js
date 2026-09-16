const sql = require('mssql');

/**
 * Connection helper for the Azure SQL serverless (free tier) database.
 *
 * The database auto-pauses after inactivity. The first connection afterwards
 * triggers a resume that takes 30-90 seconds, and every login during that
 * window fails with a transient error. Static Web Apps cuts off any managed
 * function response at 45 seconds, so a request can never simply wait the
 * resume out: instead we retry inside a bounded budget and, if the database is
 * still coming up, throw a tagged error so the caller can answer 503 and let
 * the browser poll until it is ready.
 */

// Transient errors raised while a serverless database is paused or resuming.
const RESUMING_SQL_ERROR_NUMBERS = new Set([
  4060,  // Cannot open database
  40197, // Service error processing request
  40501, // Service is busy
  40613, // Database is not currently available
  49918, // Cannot process request, not enough resources
  49919, // Cannot process create or update request
  49920, // Cannot process request, too many operations
  10928, // Resource ID limit reached
  10929  // Resource ID minimum guarantee not available
]);

const RESUMING_ERROR_CODES = new Set([
  'ETIMEOUT',    // login timed out while the database resumes
  'ESOCKET',     // socket closed mid-handshake
  'ECONNCLOSED', // pool connection closed underneath us
  'ELOGIN',      // login rejected while the database is unavailable
  'ENOTOPEN'
]);

const CONNECT_TIMEOUT_MS = 10000;
const REQUEST_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 2000;
// Default budget for a data request: long enough to ride out a resume that is
// nearly finished, short enough to answer well inside the 45 s SWA ceiling.
const DEFAULT_BUDGET_MS = 25000;

const WARMING_UP = 'DB_WARMING_UP';

let pool = null;
let connecting = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** True when the error means "the database is paused or still resuming". */
function isWarmingUp(error) {
  if (!error) return false;
  if (error.code === WARMING_UP) return true;
  if (RESUMING_ERROR_CODES.has(error.code)) return true;
  if (typeof error.number === 'number' && RESUMING_SQL_ERROR_NUMBERS.has(error.number)) return true;
  // mssql wraps the driver error; check one level down too.
  return error.originalError ? isWarmingUp(error.originalError) : false;
}

function warmingUpError(cause) {
  const err = new Error('Database is resuming from auto-pause');
  err.code = WARMING_UP;
  err.cause = cause;
  return err;
}

async function openPool() {
  const connectionString = process.env.SQL_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('SQL_CONNECTION_STRING is not configured');
  }

  const candidate = new sql.ConnectionPool(connectionString);
  // The connection string is parsed in the constructor, so these overrides are
  // applied before any socket is opened.
  candidate.config.connectionTimeout = CONNECT_TIMEOUT_MS;
  candidate.config.requestTimeout = REQUEST_TIMEOUT_MS;
  candidate.config.pool = { ...candidate.config.pool, min: 0, max: 4, idleTimeoutMillis: 30000 };

  // A pool that errors out is unusable; drop it so the next call reconnects.
  candidate.on('error', () => {
    if (pool === candidate) pool = null;
  });

  await candidate.connect();
  return candidate;
}

async function connectWithRetry(budgetMs) {
  const deadline = Date.now() + budgetMs;
  let lastError;

  do {
    try {
      return await openPool();
    } catch (error) {
      lastError = error;
      if (!isWarmingUp(error)) throw error;
      if (Date.now() + RETRY_DELAY_MS >= deadline) break;
      await sleep(RETRY_DELAY_MS);
    }
  } while (Date.now() < deadline);

  throw warmingUpError(lastError);
}

/**
 * Returns a connected pool, reusing the existing one when possible.
 * Concurrent callers share a single connect attempt so a cold page load does
 * not fire three logins at a database that is still resuming.
 *
 * @param {{ budgetMs?: number }} [options] how long to keep retrying a resume.
 */
async function getPool(options = {}) {
  if (pool && pool.connected) return pool;

  if (!connecting) {
    const budgetMs = options.budgetMs ?? DEFAULT_BUDGET_MS;
    connecting = connectWithRetry(budgetMs)
      .then((connected) => {
        pool = connected;
        return connected;
      })
      .finally(() => {
        connecting = null;
      });
  }

  return connecting;
}

module.exports = { getPool, isWarmingUp, sql, WARMING_UP };
