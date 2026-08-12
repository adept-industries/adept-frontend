/**
 * Action token handoff.
 *
 * For verify-email and reset-password flows, the backend places the token in
 * the URL fragment (#token=…). This module:
 *
 *  1. Reads the token from `window.location.hash` synchronously before React
 *     renders the route.
 *  2. Immediately removes the fragment with `history.replaceState` so it
 *     never appears in server logs, browser history, referrer headers, or
 *     analytics.
 *  3. Stores the token in a module closure with a single-flight consume guard
 *     that survives React StrictMode double-invocations.
 *  4. The token is NEVER placed in React state, Router search/loader data,
 *     Query/Mutation cache, logs, or analytics.
 */

type ConsumeGuard = {
  token: string | null;
  consumed: boolean;
};

const guard: ConsumeGuard = { token: null, consumed: false };

/**
 * Call once at route activation time (before any render).
 * Reads and scrubs the fragment; subsequent calls within the same route
 * activation are no-ops.
 */
export function captureActionToken(): void {
  if (guard.token !== null || guard.consumed) return;

  const hash = window.location.hash;
  if (!hash || !hash.startsWith("#")) return;

  const params = new URLSearchParams(hash.slice(1));
  const raw = params.get("token");
  if (!raw) return;

  // Scrub immediately so it never appears in history.
  history.replaceState(null, "", window.location.pathname + window.location.search);

  guard.token = raw;
  guard.consumed = false;
}

/**
 * Consume the captured token exactly once.
 * Returns null if no token was captured or it has already been consumed.
 *
 * StrictMode-safe: the second call in a double-invocation returns null.
 */
export function consumeActionToken(): string | null {
  if (guard.consumed || guard.token === null) return null;
  const token = guard.token;
  guard.token = null;
  guard.consumed = true;
  return token;
}

/**
 * Clear the guard when the route is unmounted (navigation away).
 * Does NOT run on StrictMode effect cleanup.
 */
export function clearActionToken(): void {
  guard.token = null;
  guard.consumed = false;
}

/** Peek without consuming — for rendering the "token present" state. */
export function hasActionToken(): boolean {
  return guard.token !== null && !guard.consumed;
}
