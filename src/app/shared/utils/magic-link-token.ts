const STORAGE_KEY = 'esk_pending_magic_token';

/**
 * Stashes a ?token= magic-link parameter before Angular routes.
 *
 * The admin moved from /volunteer/admin to /admin, and Angular's redirectTo
 * drops query parameters — so a link emailed before the move arrived at the
 * sign-in screen with the token already gone. Reading it here, before the
 * router runs, makes the token survive any redirect.
 *
 * Safe to call on every page load: it only acts when a token is present.
 */
export function captureMagicLinkToken(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) return;

    sessionStorage.setItem(STORAGE_KEY, token);

    // Clear it from the address bar so the token is not left in history.
    params.delete('token');
    const query = params.toString();
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname + (query ? `?${query}` : '')
    );
  } catch {
    // Private mode or blocked storage — the sign-in form is still reachable.
  }
}

/** Returns the stashed token, clearing it so it is only consumed once. */
export function takeMagicLinkToken(): string | null {
  try {
    const token = sessionStorage.getItem(STORAGE_KEY);
    if (token) sessionStorage.removeItem(STORAGE_KEY);
    return token;
  } catch {
    return null;
  }
}
