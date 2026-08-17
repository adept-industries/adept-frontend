export type DashboardTheme = "dark" | "light";

const KEY = "adept.dashboardTheme";
type Listener = (theme: DashboardTheme) => void;
const listeners = new Set<Listener>();

export const dashboardThemePreference = {
  get(): DashboardTheme {
    try {
      return localStorage.getItem(KEY) === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  },

  set(theme: DashboardTheme): void {
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // The current theme still works when storage is unavailable; it simply
      // cannot be restored on the next visit.
    }
    listeners.forEach((listener) => {
      try {
        listener(theme);
      } catch {
        // Safe listener execution
      }
    });
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

