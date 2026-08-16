import { describe, expect, it } from "vitest";
import {
  formatTimezone,
  formatWorkspaceDateTime,
  getBrowserTimezone,
  listTimezones,
} from "./timezone.js";

describe("timezone utilities", () => {
  it("lists supported timezones containing UTC and major zones", () => {
    const tzList = listTimezones();
    expect(tzList).toContain("UTC");
    expect(tzList).toContain("America/New_York");
    expect(tzList).toContain("Asia/Colombo");
    expect(tzList.length).toBeGreaterThan(5);
  });

  it("returns browser timezone or UTC fallback", () => {
    const browserTz = getBrowserTimezone();
    expect(typeof browserTz).toBe("string");
    expect(browserTz.length).toBeGreaterThan(0);
  });

  it("formats timezone label with offset", () => {
    const label = formatTimezone("UTC");
    expect(label).toContain("UTC");
  });

  describe("formatWorkspaceDateTime", () => {
    const testUtcIso = "2026-08-16T03:57:53.000Z";

    it("returns 'Never' for null or undefined input", () => {
      expect(formatWorkspaceDateTime(null)).toBe("Never");
      expect(formatWorkspaceDateTime(undefined)).toBe("Never");
      expect(formatWorkspaceDateTime("")).toBe("Never");
    });

    it("formats UTC timestamp correctly in America/New_York (EDT)", () => {
      // 03:57:53 UTC on Aug 16 is 23:57:53 EDT on Aug 15 (UTC-4)
      const formatted = formatWorkspaceDateTime(testUtcIso, "America/New_York");
      expect(formatted).toContain("8/15/2026");
      expect(formatted).toContain("11:57:53 PM");
      expect(formatted).toContain("EDT");
    });

    it("formats UTC timestamp correctly in Asia/Colombo (UTC+5:30)", () => {
      // 03:57:53 UTC on Aug 16 is 09:27:53 on Aug 16 (UTC+5:30)
      const formatted = formatWorkspaceDateTime(testUtcIso, "Asia/Colombo");
      expect(formatted).toContain("8/16/2026");
      expect(formatted).toContain("9:27:53 AM");
    });

    it("formats UTC timestamp correctly in UTC", () => {
      const formatted = formatWorkspaceDateTime(testUtcIso, "UTC");
      expect(formatted).toContain("8/16/2026");
      expect(formatted).toContain("3:57:53 AM");
      expect(formatted).toContain("UTC");
    });

    it("handles invalid dates gracefully", () => {
      expect(formatWorkspaceDateTime("not-a-valid-date")).toBe("Invalid Date");
    });
  });
});
