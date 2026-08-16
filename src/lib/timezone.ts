/**
 * Timezone utilities for workspace settings.
 *
 * Uses the Intl API (supported in all modern browsers) to enumerate and
 * display timezone options. No external dependency is required.
 */

/** IANA timezone string (e.g. "America/New_York"). */
export type IanaTimezone = string;

/**
 * Returns a curated list of IANA timezone identifiers.
 * Falls back to a minimal hardcoded list when the Intl.supportedValuesOf
 * API is unavailable (very old browsers).
 */
export function listTimezones(): IanaTimezone[] {
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      return Array.from(new Set(["UTC", ...Intl.supportedValuesOf("timeZone")])) as IanaTimezone[];
    }
  } catch {
    // Fallback below.
  }
  return [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Asia/Kolkata",
    "Australia/Sydney",
  ];
}

/**
 * Returns the browser's current IANA timezone or "UTC" as a safe fallback.
 */
export function getBrowserTimezone(): IanaTimezone {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/**
 * Formats a timezone ID for display (e.g. "America/New_York" → "America/New York (UTC-5)").
 * Uses the short offset format from Intl to append the current offset.
 */
export function formatTimezone(tz: IanaTimezone): string {
  try {
    const offset = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value ?? "";
    const label = tz.replace(/_/g, " ");
    return offset ? `${label} (${offset})` : label;
  } catch {
    return tz.replace(/_/g, " ");
  }
}

/**
 * Formats an ISO UTC date string or Date instance according to the workspace's configured timezone.
 *
 * Example output: "8/15/2026, 11:57:53 PM EDT"
 */
export function formatWorkspaceDateTime(
  date: string | Date | null | undefined,
  timeZone?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!date) return "Never";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "Invalid Date";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: timeZone || "UTC",
      timeZoneName: "short",
      ...options,
    }).format(d);
  } catch {
    const d = typeof date === "string" ? new Date(date) : date;
    return isNaN(d.getTime()) ? "Invalid Date" : d.toLocaleString();
  }
}

