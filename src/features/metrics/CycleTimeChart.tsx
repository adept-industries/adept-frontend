import { useState } from "react";
import { CYCLE_TIME_STAGES, formatCycleHours, formatPeriodRange, stageColorVar } from "./cycleTime.js";
import type { CycleTimePeriodDto, CycleTimeStage, MetricGranularity } from "./types.js";

function stageHours(period: CycleTimePeriodDto, stage: CycleTimeStage): number {
  const value = period.stages.find((item) => item.stage === stage);
  return value && value.sampleSize > 0 ? value.medianHours : 0;
}

function describeStages(period: CycleTimePeriodDto, separator: string): string {
  return CYCLE_TIME_STAGES
    .map(({ stage, label }) => {
      const value = period.stages.find((item) => item.stage === stage);
      return `${label} ${value && value.sampleSize > 0 ? formatCycleHours(value.medianHours) : "—"}`;
    })
    .join(separator);
}

function plural(count: number): string {
  return `${count} merged PR${count === 1 ? "" : "s"}`;
}

interface CycleTimeChartProps {
  series: CycleTimePeriodDto[];
  rangeStart: string;
  rangeEnd: string;
  timezone: string;
  granularity: MetricGranularity;
}

const WIDTH = 720;
const HEIGHT = 190;
const PAD_LEFT = 52;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 24;

export function CycleTimeChart({ series, rangeStart, rangeEnd, timezone, granularity }: CycleTimeChartProps) {
  const label = (period: CycleTimePeriodDto) => formatPeriodRange(period, rangeStart, rangeEnd, timezone);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const totals = series.map((period) =>
    CYCLE_TIME_STAGES.reduce((sum, { stage }) => sum + stageHours(period, stage), 0));
  const maxTotal = Math.max(...totals, 0);

  if (series.length === 0 || maxTotal === 0) {
    return <div className="dora-chart-empty cycle-time-chart-empty">No merged pull requests in this period</div>;
  }

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const slot = plotWidth / series.length;
  const barWidth = Math.min(44, slot * 0.62);
  // Range labels ("Aug 31 – Sep 6") need ~76 chart units at this font size; skip
  // labels rather than let neighbours overlap. The readout always names the bar.
  const labelWidth = granularity === "DAY" ? 40 : 76;
  const labelEvery = Math.max(1, Math.ceil(labelWidth / slot));
  const y = (hours: number) => PAD_TOP + plotHeight - (hours / maxTotal) * plotHeight;
  // Until a bar is hovered, describe the latest period that had merges.
  const latestIndex = series.findLastIndex((period) => period.pullRequestCount > 0);
  const shownIndex = activeIndex ?? (latestIndex >= 0 ? latestIndex : null);
  const shown = shownIndex !== null ? series[shownIndex] : null;

  return (
    <div className="cycle-time-chart">
      <svg
        className="cycle-time-chart-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="group"
        aria-label="Median hours per cycle-time stage for each period"
        onPointerLeave={() => setActiveIndex(null)}
      >
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={y(maxTotal * fraction)}
              y2={y(maxTotal * fraction)}
              stroke="var(--dashboard-subtle-border)"
              strokeWidth="1"
            />
            <text
              x={PAD_LEFT - 6}
              y={y(maxTotal * fraction) + 3}
              textAnchor="end"
              fontSize="9"
              fill="var(--text-secondary)"
            >
              {formatCycleHours(maxTotal * fraction)}
            </text>
          </g>
        ))}

        {series.map((period, index) => {
          const x = PAD_LEFT + slot * index + (slot - barWidth) / 2;
          const periodLabel = label(period);
          let stackTop = 0;
          const dimmed = activeIndex !== null && activeIndex !== index;
          return (
            <g
              key={period.periodStart}
              className="cycle-time-bar"
              tabIndex={0}
              role="img"
              aria-label={`${periodLabel}: ${period.pullRequestCount} merged pull requests. ${describeStages(period, ", ")}`}
              opacity={dimmed ? 0.4 : 1}
              onPointerEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
            >
              {/* Full-height hit area keeps short bars easy to hover. */}
              <rect x={PAD_LEFT + slot * index} y={PAD_TOP} width={slot} height={plotHeight} fill="transparent" />
              {CYCLE_TIME_STAGES.map(({ stage }) => {
                const hours = stageHours(period, stage);
                if (hours <= 0) return null;
                const top = y(stackTop + hours);
                const height = y(stackTop) - top;
                stackTop += hours;
                return (
                  <rect
                    key={stage}
                    x={x}
                    y={top}
                    width={barWidth}
                    height={Math.max(height, 1)}
                    fill={stageColorVar(stage)}
                  />
                );
              })}
              {index % labelEvery === 0 && (
                <text
                  x={x + barWidth / 2}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  fontSize="9"
                  fill="var(--text-secondary)"
                >
                  {periodLabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <p className="cycle-time-chart-detail" aria-live="polite">
        {shown
          ? `${label(shown)} · ${plural(shown.pullRequestCount)} · `
            + describeStages(shown, " · ")
          : "Hover or focus a bar to see its stage medians."}
      </p>
    </div>
  );
}
