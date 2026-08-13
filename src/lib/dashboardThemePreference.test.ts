import { beforeEach, describe, expect, it } from "vitest";
import { dashboardThemePreference } from "./dashboardThemePreference";

describe("dashboardThemePreference", () => {
  beforeEach(() => {
    localStorage.removeItem("adept.dashboardTheme");
  });

  it("defaults to the existing dark theme", () => {
    expect(dashboardThemePreference.get()).toBe("dark");
  });

  it("persists a selected light theme", () => {
    dashboardThemePreference.set("light");

    expect(dashboardThemePreference.get()).toBe("light");
  });

  it("ignores an invalid stored value", () => {
    localStorage.setItem("adept.dashboardTheme", "sepia");

    expect(dashboardThemePreference.get()).toBe("dark");
  });
});
