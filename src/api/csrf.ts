/**
 * CSRF bootstrap helpers for the Adept SPA.
 *
 * Rules enforced here:
 * 1. A single in-flight `GET /api/v1/auth/csrf` request is coordinated across
 *    tabs using the same-origin Web Lock named `adept-csrf-bootstrap`.
 * 2. Only after acquiring the lock do we recheck the cookie — if another tab
 *    already obtained it we skip the network request.
 * 3. The XSRF-TOKEN cookie is read immediately before every unsafe request so
 *    we never send a cached header after another tab rotated it.
 * 4. The value is never stored beyond what is needed for one request.
 *
 * Lock ordering (must never be reversed):
 *   adept-csrf-bootstrap  →  adept-session-mutation (when also needed)
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
const CSRF_COOKIE = "XSRF-TOKEN";
const CSRF_HEADER = "X-XSRF-TOKEN";
const CSRF_LOCK = "adept-csrf-bootstrap";

/** Read and URL-decode the XSRF-TOKEN cookie, returning null when absent. */
export function readCsrfCookie(): string | null {
  const prefix = CSRF_COOKIE + "=";
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trimStart();
    if (trimmed.startsWith(prefix)) {
      try {
        return decodeURIComponent(trimmed.slice(prefix.length));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Fetch a fresh CSRF seed from the API (no body, no credentials needed). */
async function fetchCsrfSeed(): Promise<void> {
  const res = await fetch(`${API_BASE}/v1/auth/csrf`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`CSRF seed failed: ${res.status}`);
  }
}

/**
 * Ensure the XSRF-TOKEN cookie is present.
 * Uses a Web Lock to guarantee only one tab calls the API at a time.
 * Falls back to a simple fetch when Web Locks are unavailable.
 */
export async function ensureCsrf(): Promise<void> {
  if (typeof navigator.locks === "undefined") {
    // Single-tab fallback
    if (!readCsrfCookie()) {
      await fetchCsrfSeed();
    }
    return;
  }

  await navigator.locks.request(CSRF_LOCK, async () => {
    // Recheck cookie after acquiring the lock.
    if (!readCsrfCookie()) {
      await fetchCsrfSeed();
    }
  });
}

/**
 * Read the current CSRF token immediately before dispatching an unsafe request.
 * Throws when the cookie is absent (caller must call ensureCsrf first).
 */
export function currentCsrfToken(): string {
  const token = readCsrfCookie();
  if (!token) {
    throw new Error("CSRF token is missing — call ensureCsrf() first");
  }
  return token;
}

export { CSRF_HEADER };
