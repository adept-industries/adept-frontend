import type { CycleTimePeriodDto, CycleTimeStage } from "./types.js";

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
