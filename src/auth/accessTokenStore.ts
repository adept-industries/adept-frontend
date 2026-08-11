/**
 * Memory-only access token store.
 *
 * The raw access token is NEVER written to:
 *  - localStorage / sessionStorage / IndexedDB
 *  - document.cookie
 *  - URL / history
 *  - TanStack Query cache
 *  - logs or analytics
 *
 * It lives only in this module-level closure for the lifetime of the tab.
 */

let _token: string | null = null;

export const accessTokenStore = {
  get(): string | null {
    return _token;
  },
  set(token: string): void {
    _token = token;
  },
  clear(): void {
    _token = null;
  },
} as const;
