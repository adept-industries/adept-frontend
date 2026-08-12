const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
const CSRF_COOKIE = "XSRF-TOKEN";
export const CSRF_HEADER = "X-XSRF-TOKEN";
export const CSRF_LOCK = "adept-csrf-bootstrap";

let pageBootstrap: Promise<void> | null = null;

export function readCsrfCookie(): string | null {
  const prefix = `${CSRF_COOKIE}=`;
  for (const part of document.cookie.split(";")) {
    const value = part.trimStart();
    if (!value.startsWith(prefix)) continue;
    try {
      return decodeURIComponent(value.slice(prefix.length));
    } catch {
      return null;
    }
  }
  return null;
}

async function fetchCsrfSeed(): Promise<void> {
  const response = await fetch(`${API_BASE}/v1/auth/csrf`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json, application/problem+json" },
  });
  if (!response.ok) throw new Error("Unable to establish CSRF protection.");
}

/** Must only be called while the caller owns the CSRF lock. */
export async function ensureCsrfWhileLocked(): Promise<void> {
  if (readCsrfCookie()) return;
  if (!pageBootstrap) {
    pageBootstrap = fetchCsrfSeed().finally(() => {
      pageBootstrap = null;
    });
  }
  await pageBootstrap;
  if (!readCsrfCookie()) {
    throw new Error("The CSRF cookie was not issued.");
  }
}

export async function withCsrfLock<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator.locks === "undefined") return work();
  return navigator.locks.request(CSRF_LOCK, work);
}

export async function ensureCsrf(): Promise<void> {
  await withCsrfLock(ensureCsrfWhileLocked);
}

/**
 * Construct and dispatch an ordinary unsafe request while the CSRF lock is
 * held. The response is intentionally awaited after releasing the lock: the
 * cookie/header pair is already fixed once fetch has been dispatched.
 */
export async function dispatchWithCsrf<T>(
  dispatch: (token: string) => Promise<T>,
): Promise<T> {
  let responsePromise: Promise<T> | undefined;
  await withCsrfLock(async () => {
    await ensureCsrfWhileLocked();
    const token = readCsrfCookie();
    if (!token) throw new Error("The CSRF token is missing.");
    responsePromise = dispatch(token);
  });
  if (!responsePromise) throw new Error("The request was not dispatched.");
  return responsePromise;
}

/** Read only while the CSRF lock is already owned by a session mutation. */
export function currentCsrfTokenWhileLocked(): string {
  const token = readCsrfCookie();
  if (!token) throw new Error("The CSRF token is missing.");
  return token;
}
