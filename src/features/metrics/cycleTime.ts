import type { CycleTimeStage } from "./types.js";

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
