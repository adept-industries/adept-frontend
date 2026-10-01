import type { CycleTimePeriodDto, CycleTimeStage, MetricGranularity } from "./types.js";
import { zonedDateTimeToDate } from "./zonedTime.js";

export const CYCLE_TIME_STAGES: ReadonlyArray<{ stage: CycleTimeStage; label: string }> = [
  { stage: "CODING", label: "Coding" },
  { stage: "PICKUP", label: "Pickup" },
  { stage: "REVIEW", label: "Review" },
  { stage: "DEPLOY", label: "Deploy" },
];

export function stageColorVar(stage: CycleTimeStage): string {
  return `var(--cycle-${stage.toLowerCase()})`;
}

function withUnit(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

/** Readable duration: minutes under an hour, hours under two days, then days. */
export function formatCycleHours(hours: number): string {
  if (hours <= 0) return "0 min";
  if (hours < 1) return withUnit(Math.max(1, Math.round(hours * 60)), "min", "min");
  if (hours < 48) return withUnit(Number(hours.toFixed(1)), "hr", "hrs");
  return withUnit(Number((hours / 24).toFixed(1)), "day", "days");
}

function dayParts(instant: number, timezone: string): { month: string; day: string } {
  const format = (timeZone: string) => new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone,
  }).formatToParts(new Date(instant));
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = format(timezone);
  } catch {
    parts = format("UTC");
  }
  return {
    month: parts.find((part) => part.type === "month")?.value ?? "",
    day: parts.find((part) => part.type === "day")?.value ?? "",
  };
}

/**
 * Inclusive dates a bar covers, clipped to the selected range: "Aug 24 – 30",
 * "Aug 31 – Sep 6", or one date for a single day. The first and last calendar
 * periods only count merges inside the range, so their labels say so.
 */
export function formatPeriodRange(
  period: Pick<CycleTimePeriodDto, "periodStart" | "periodEnd">,
  rangeStart: string,
  rangeEnd: string,
  timezone: string,
): string {
  const start = Math.max(Date.parse(period.periodStart), Date.parse(rangeStart));
  // Period and range ends are exclusive, so the last covered day ends 1 ms earlier.
  const last = Math.min(Date.parse(period.periodEnd), Date.parse(rangeEnd)) - 1;
  const first = dayParts(start, timezone);
  const final = dayParts(Math.max(last, start), timezone);
  if (first.month === final.month && first.day === final.day) return `${first.month} ${first.day}`;
  if (first.month === final.month) return `${first.month} ${first.day} – ${final.day}`;
  return `${first.month} ${first.day} – ${final.month} ${final.day}`;
}

export type CycleTimeWindow = "7d" | "30d" | "90d";

const WINDOWS: Record<CycleTimeWindow, { granularity: MetricGranularity; periods: number; description: string }> = {
  "7d": { granularity: "DAY", periods: 7, description: "Last 7 days" },
  "30d": { granularity: "WEEK", periods: 4, description: "Last 4 weeks" },
  "90d": { granularity: "WEEK", periods: 12, description: "Last 12 weeks" },
};

export interface CycleTimeRange {
  from: string;
  to: string;
  granularity: MetricGranularity;
  /** Bars the chart shows: whole days or Monday-start weeks, the last one in progress. */
  periods: number;
  description: string;
}

const DAY_MS = 86_400_000;

/**
 * The cycle-time panel compares whole calendar periods, so every bar is a full
 * day or Monday-start week in the workspace timezone except the current one.
 * A rolling "last 30 days" would start mid-week and give the first bar only a
 * few days of merges, which reads as a false improvement or regression.
 *
 * @param today the workspace's current date as YYYY-MM-DD
 */
export function cycleTimeRange(
  window: CycleTimeWindow,
  timezone: string,
  today: string,
  now: Date = new Date(),
): CycleTimeRange {
  const { granularity, periods, description } = WINDOWS[window];
  const [year, month, day] = today.split("-").map(Number);
  const todayUtc = Date.UTC(year, month - 1, day);
  const daysSinceMonday = (new Date(todayUtc).getUTCDay() + 6) % 7;
  const daysBack = granularity === "DAY" ? periods - 1 : daysSinceMonday + 7 * (periods - 1);
  const start = new Date(todayUtc - daysBack * DAY_MS);
  const from = zonedDateTimeToDate({
    year: start.getUTCFullYear(),
    month: start.getUTCMonth() + 1,
    day: start.getUTCDate(),
    hour: 0,
    minute: 0,
    second: 0,
  }, 0, timezone);
  return { from: from.toISOString(), to: now.toISOString(), granularity, periods, description };
}

/**
 * Two short lines for a bar's x-axis label, so twelve weekly bars fit without
 * overlapping: a week reads "Aug 31" over "– Sep 6"; a day reads "Mon" over "Sep 28".
 */
export function periodLabelLines(
  period: Pick<CycleTimePeriodDto, "periodStart" | "periodEnd">,
  rangeStart: string,
  rangeEnd: string,
  timezone: string,
  granularity: MetricGranularity,
): [string, string] {
  const start = Math.max(Date.parse(period.periodStart), Date.parse(rangeStart));
  if (granularity === "DAY") {
    const { month, day } = dayParts(start, timezone);
    return [weekday(start, timezone), `${month} ${day}`];
  }
  const label = formatPeriodRange(period, rangeStart, rangeEnd, timezone);
  const [first, second] = label.split(" – ");
  return [first, second ? `– ${second}` : ""];
}

function weekday(instant: number, timezone: string): string {
  const format = (timeZone: string) =>
    new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(new Date(instant));
  try {
    return format(timezone);
  } catch {
    return format("UTC");
  }
}

/**
 * The axis maximum. One outlier period (a stuck pull request) would otherwise
 * flatten every other bar into a sliver, so when the tallest of at least four
 * bars is more than three times the next one, the axis fits the rest and the
 * outlier is clipped. With fewer bars every height is shown as it is.
 */
export function axisMaximum(totals: number[]): number {
  const measured = totals.filter((total) => total > 0).sort((a, b) => b - a);
  const [tallest = 0, next = 0] = measured;
  return measured.length >= 4 && tallest > next * 3 ? next * 1.25 : tallest;
}
