const STORAGE_KEY_PREFIX = "adept.project.";

function key(workspaceId: string): string {
  return `${STORAGE_KEY_PREFIX}${workspaceId}`;
}

export const projectPreference = {
  get(workspaceId: string): string | null {
    try {
      return window.sessionStorage.getItem(key(workspaceId));
    } catch {
      return null;
    }
  },

  set(workspaceId: string, projectId: string): void {
    try {
      window.sessionStorage.setItem(key(workspaceId), projectId);
    } catch {
      // Selection is optional UI state; storage failure must not break auth.
    }
  },

  clear(workspaceId: string): void {
    try {
      window.sessionStorage.removeItem(key(workspaceId));
    } catch {
      // No-op when storage is unavailable.
    }
  },
};
