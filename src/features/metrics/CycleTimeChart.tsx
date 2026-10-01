import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  axisMaximum,
  CYCLE_TIME_STAGES,
  formatCycleHours,
  formatPeriodRange,
  periodLabelLines,
  stageColorVar,
} from "./cycleTime.js";
import type { CycleTimePeriodDto, CycleTimeStage, MetricGranularity } from "./types.js";

function stageValue(period: CycleTimePeriodDto, stage: CycleTimeStage) {
  const value = period.stages.find((item) => item.stage === stage);
  return value && value.sampleSize > 0 ? value : null;
}

function stageHours(period: CycleTimePeriodDto, stage: CycleTimeStage): number {
  return stageValue(period, stage)?.medianHours ?? 0;
}

function stageLabel(stage: CycleTimeStage): string {
  return CYCLE_TIME_STAGES.find((item) => item.stage === stage)?.label ?? stage;
}

function mergedPullRequests(count: number): string {
  return `${count} merged PR${count === 1 ? "" : "s"}`;
}

function describeStages(period: CycleTimePeriodDto, separator: string): string {
  return CYCLE_TIME_STAGES
    .map(({ stage, label }) => {
      const value = stageValue(period, stage);
      return value
        ? `${label} ${formatCycleHours(value.medianHours)} (${value.sampleSize} PR${value.sampleSize === 1 ? "" : "s"})`
        : `${label} —`;
    })
    .join(separator);
}

function describeBottleneck(period: CycleTimePeriodDto): string {
  if (period.pullRequestCount === 0) return "No merged pull requests";
  if (!period.bottleneck) return "No stage took measurable time";
  const value = stageValue(period, period.bottleneck);
  return `Bottleneck: ${stageLabel(period.bottleneck)}${value ? ` · ${formatCycleHours(value.medianHours)}` : ""}`;
}

/** Tracks an element's rendered width so the chart draws in real pixels and text never shrinks. */
function useWidth<T extends HTMLElement>(fallback: number) {
  // A callback ref, so the observer attaches even when the chart first renders its empty state.
  const [element, setElement] = useState<T | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, width] as const;
}

interface CycleTimeChartProps {
  series: CycleTimePeriodDto[];
  rangeStart: string;
  rangeEnd: string;
  timezone: string;
  granularity: MetricGranularity;
}

const HEIGHT = 240;
const PAD_LEFT = 56;
const PAD_RIGHT = 8;
const PAD_TOP = 18;
const PAD_BOTTOM = 40;
const FONT_SIZE = 11;
// Rough advance of one character at FONT_SIZE, used to keep labels apart.
const CHAR_WIDTH = 6.4;
const MARKER_RADIUS = 4;

export function CycleTimeChart({ series, rangeStart, rangeEnd, timezone, granularity }: CycleTimeChartProps) {
  const [containerRef, width] = useWidth<HTMLDivElement>(720);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const barRefs = useRef<Array<SVGGElement | null>>([]);

  const totals = series.map((period) =>
    CYCLE_TIME_STAGES.reduce((sum, { stage }) => sum + stageHours(period, stage), 0));
  const maxTotal = axisMaximum(totals);

  if (series.length === 0 || maxTotal === 0) {
    return <div className="dora-chart-empty cycle-time-chart-empty">No merged pull requests in this period</div>;
  }

  const plotWidth = Math.max(width - PAD_LEFT - PAD_RIGHT, 1);
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const slot = plotWidth / series.length;
  const barWidth = Math.max(4, Math.min(48, slot * 0.6));
  const lines = series.map((period) => periodLabelLines(period, rangeStart, rangeEnd, timezone, granularity));
  const widestLabel = Math.max(...lines.flat().map((line) => line.length)) * CHAR_WIDTH + 8;
  // Every bar is labelled when there is room; narrow screens label every other one.
  const labelEvery = Math.max(1, Math.ceil(widestLabel / slot));
  const y = (hours: number) => PAD_TOP + plotHeight - (hours / maxTotal) * plotHeight;
  const periodName = (period: CycleTimePeriodDto) => formatPeriodRange(period, rangeStart, rangeEnd, timezone);

  // Hover previews a bar; a click, tap or keyboard focus keeps it selected.
  const latestIndex = series.findLastIndex((period) => period.pullRequestCount > 0);
  const shownIndex = hoverIndex ?? selectedIndex ?? (latestIndex >= 0 ? latestIndex : null);
  const shown = shownIndex !== null ? series[shownIndex] : null;

  const moveSelection = (event: KeyboardEvent<SVGGElement>, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = Math.min(series.length - 1, Math.max(0, index + step));
    barRefs.current[next]?.focus();
  };

  return (
    <div className="cycle-time-chart" ref={containerRef}>
      <svg
        className="cycle-time-chart-svg"
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="group"
        aria-label="Median time per cycle-time stage for each period. Select a bar to see its bottleneck."
        onPointerLeave={() => setHoverIndex(null)}
      >
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line
              x1={PAD_LEFT}
              x2={width - PAD_RIGHT}
              y1={y(maxTotal * fraction)}
              y2={y(maxTotal * fraction)}
              stroke="var(--dashboard-subtle-border)"
              strokeWidth="1"
            />
            <text
              x={PAD_LEFT - 8}
              y={y(maxTotal * fraction) + 4}
              textAnchor="end"
              fontSize={FONT_SIZE}
              fill="var(--text-secondary)"
            >
              {formatCycleHours(maxTotal * fraction)}
            </text>
          </g>
        ))}

        {series.map((period, index) => {
          const slotX = PAD_LEFT + slot * index;
          const x = slotX + (slot - barWidth) / 2;
          const [lineOne, lineTwo] = lines[index];
          const isShown = index === shownIndex;
          // An outlier taller than the axis keeps its stage proportions and gets break marks.
          const clipped = totals[index] > maxTotal;
          const scale = clipped ? maxTotal / totals[index] : 1;
          const bottleneckLabel = period.bottleneck ? stageLabel(period.bottleneck) : null;
          const showStageName = bottleneckLabel !== null
            && slot >= bottleneckLabel.length * CHAR_WIDTH + 12;
          let stackTop = 0;
          return (
            <g
              key={period.periodStart}
              ref={(element) => { barRefs.current[index] = element; }}
              className={`cycle-time-bar${isShown ? " cycle-time-bar--shown" : ""}`}
              tabIndex={0}
              role="button"
              aria-pressed={index === selectedIndex}
              aria-label={`${periodName(period)}: ${mergedPullRequests(period.pullRequestCount)}. `
                + `${describeBottleneck(period)}. ${describeStages(period, ", ")}`}
              onPointerEnter={() => setHoverIndex(index)}
              onClick={() => setSelectedIndex(index)}
              onFocus={() => setSelectedIndex(index)}
              onKeyDown={(event) => moveSelection(event, index)}
            >
              {/* Full-height hit area keeps short bars easy to hover and tap. */}
              <rect
                className="cycle-time-bar-hit"
                x={slotX}
                y={PAD_TOP - MARKER_RADIUS * 3}
                width={slot}
                height={plotHeight + MARKER_RADIUS * 3}
                rx={4}
              />
              {CYCLE_TIME_STAGES.map(({ stage }) => {
                const hours = stageHours(period, stage) * scale;
                if (hours <= 0) return null;
                const top = y(stackTop + hours);
                const height = y(stackTop) - top;
                stackTop += hours;
                return (
                  <rect
                    key={stage}
                    x={x}
                    // Keep tiny stages visible without hiding the one below.
                    y={Math.min(top, y(stackTop - hours) - 2)}
                    width={barWidth}
                    height={Math.max(height, 2)}
                    fill={stageColorVar(stage)}
                  />
                );
              })}
              {clipped && (
                <path
                  className="cycle-time-bar-break"
                  d={`M${x - 2},${y(maxTotal) + 10} l${barWidth + 4},-6 M${x - 2},${y(maxTotal) + 16} l${barWidth + 4},-6`}
                />
              )}
              {period.bottleneck && (showStageName ? (
                <text
                  className="cycle-time-bottleneck-marker"
                  x={x + barWidth / 2}
                  y={y(stackTop) - 6}
                  textAnchor="middle"
                  fontSize={FONT_SIZE}
                  fontWeight={600}
                  fill={stageColorVar(period.bottleneck)}
                >
                  {bottleneckLabel}
                </text>
              ) : (
                <circle
                  className="cycle-time-bottleneck-marker"
                  cx={x + barWidth / 2}
                  cy={y(stackTop) - MARKER_RADIUS - 4}
                  r={MARKER_RADIUS}
                  fill={stageColorVar(period.bottleneck)}
                />
              ))}
              {index % labelEvery === 0 && (
                <text
                  x={slotX + slot / 2}
                  y={HEIGHT - PAD_BOTTOM + 16}
                  textAnchor="middle"
                  fontSize={FONT_SIZE}
                  fontWeight={isShown ? 600 : 400}
                  fill={isShown ? "var(--text-primary)" : "var(--text-secondary)"}
                >
                  <tspan x={slotX + slot / 2}>{lineOne}</tspan>
                  {lineTwo && <tspan x={slotX + slot / 2} dy={FONT_SIZE + 3}>{lineTwo}</tspan>}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="cycle-time-chart-detail" aria-live="polite">
        {shown ? (
          <>
            <p className="cycle-time-chart-detail-title">
              <strong>{periodName(shown)}</strong>
              {` · ${mergedPullRequests(shown.pullRequestCount)} · `}
              {shown.bottleneck && (
                <span
                  className="cycle-time-dot"
                  style={{ background: stageColorVar(shown.bottleneck) }}
                  aria-hidden="true"
                />
              )}
              <strong>{describeBottleneck(shown)}</strong>
            </p>
            {shown.pullRequestCount > 0 && (
              <p className="cycle-time-chart-detail-stages">{describeStages(shown, " · ")}</p>
            )}
          </>
        ) : (
          <p className="cycle-time-chart-detail-title">Select a bar to see its bottleneck.</p>
        )}
      </div>
    </div>
  );
}
