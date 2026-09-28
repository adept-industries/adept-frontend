import type { CycleTimeStage } from "./types.js";

export const CYCLE_TIME_STAGES: ReadonlyArray<{ stage: CycleTimeStage; label: string }> = [
  { stage: "CODING", label: "Coding" },
  { stage: "PICKUP", label: "Pickup" },
  { stage: "REVIEW", label: "Review" },
  { stage: "MERGE", label: "Merge" },
  { stage: "DEPLOY", label: "Deploy" },
];

export function stageColorVar(stage: CycleTimeStage): string {
  return `var(--cycle-${stage.toLowerCase()})`;
}

/** Compact duration: minutes under an hour, hours under two days, then days. */
export function formatCycleHours(hours: number): string {
  if (hours <= 0) return "0h";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Number(hours.toFixed(1))}h`;
  return `${Number((hours / 24).toFixed(1))}d`;
}
