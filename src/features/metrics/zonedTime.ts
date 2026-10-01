/**
 * Calendar arithmetic in an IANA timezone (the workspace's), independent of the
 * browser's own timezone.
 */

export interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedDateTimeParts(date: Date, timezone: string): ZonedDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

export function zonedDateKey(date: Date, timezone: string): string {
  const { year, month, day } = zonedDateTimeParts(date, timezone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function zonedDateTimeToDate(parts: ZonedDateTimeParts, milliseconds: number, timezone: string): Date {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, milliseconds);
  let timestamp = target;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = zonedDateTimeParts(new Date(timestamp), timezone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second, milliseconds);
    const adjustment = target - represented;
    if (adjustment === 0) break;
    timestamp += adjustment;
  }

  return new Date(timestamp);
}
