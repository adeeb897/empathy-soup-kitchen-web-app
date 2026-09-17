const { isWarmingUp } = require('./db');

/** Seconds the browser should wait before retrying while the database resumes. */
const RETRY_AFTER_SECONDS = 5;

function corsHeaders(methods, allowHeaders = 'Content-Type') {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': allowHeaders
  };
}

/**
 * Turns a thrown error into a response. A database that is still resuming from
 * auto-pause is a "come back in a moment" condition, not a failure, so it gets
 * a 503 with Retry-After — the client keeps waiting instead of showing an error.
 */
function errorResponse(context, error, headers) {
  if (isWarmingUp(error)) {
    context.log('Database is resuming from auto-pause; asking the client to retry');
    return {
      status: 503,
      headers: { ...headers, 'Retry-After': String(RETRY_AFTER_SECONDS) },
      body: { error: 'The database is starting up. Please retry shortly.', state: 'warming' }
    };
  }

  // The message can carry driver and schema detail — table names, constraint
  // names, fragments of the failing statement — so it stays in the logs. The
  // client gets something it can show a volunteer and nothing it can map the
  // database with.
  context.log.error('API error:', error);
  return {
    status: 500,
    headers,
    body: { error: 'Something went wrong. Please try again.' }
  };
}

module.exports = { corsHeaders, errorResponse, RETRY_AFTER_SECONDS };
