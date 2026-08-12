/**
 * Workspace preference store.
 *
 * Persists only `adept.currentWorkspaceId` — a non-secret UUID — to
 * localStorage so a single-workspace user is not sent back to the selector
 * after every page reload.
 *
 * Any malformed or non-UUID value is removed immediately and never forwarded
 * to the API. The API still validates the preference as untrusted.
 */

const KEY = "adept.currentWorkspaceId";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export const workspacePreference = {
  get(): string | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === null) return null;
      if (!isValidUuid(raw)) {
        localStorage.removeItem(KEY);
        return null;
      }
      return raw;
    } catch {
      return null;
    }
  },

  set(workspaceId: string): void {
    if (!isValidUuid(workspaceId)) return;
    try {
      localStorage.setItem(KEY, workspaceId);
    } catch {
      // Storage may be unavailable (private browsing quota).
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Ignore.
    }
  },
} as const;
