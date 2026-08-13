export type DashboardTheme = "dark" | "light";

const KEY = "adept.dashboardTheme";

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
  },
};
