import { useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { MetricSeriesItemDto } from "./types.js";

interface DoraMetricChartProps {
  series: MetricSeriesItemDto[];
  color: string;
  /** aria-label for the chart SVG */
  label: string;
  preset?: "7d" | "30d" | "90d";
  timezone?: string;
  unit?: string;
  /** "card" for dashboard cards (default, 360x100), "details" for full-width details page (720x130) */
  variant?: "card" | "details";
}

interface ChartPoint {
  value: number;
  dateKey: string;
  failedDeploymentCount?: number;
  totalDeploymentCount?: number;
}

function workspaceDateKey(date: Date, timeZone?: string): string {
  try {
    const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
    return `${value("year")}-${value("month")}-${value("day")}`;
  } catch {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
}

function dateKeyWithOffset(dateKey: string, offset: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function dateKeyAsUtcDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00Z`);
}

function weekdayNumber(dateKey: string): number {
  return dateKeyAsUtcDate(dateKey).getUTCDay();
}

function weekdayLetter(dateKey: string): string {
  return ["S", "M", "T", "W", "T", "F", "S"][weekdayNumber(dateKey)];
}

function formatDateKey(dateKey: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateKeyAsUtcDate(dateKey));
}

function rollingDailySeries(
  series: MetricSeriesItemDto[],
  days: number,
  today: string,
  timeZone?: string,
  isFailureRateChart = false,
): ChartPoint[] {
  const pointsByDate = new Map<string, MetricSeriesItemDto>();
  for (const item of series) {
    if (!item.periodStart) continue;
    const date = new Date(item.periodStart);
    if (!Number.isNaN(date.getTime())) {
      pointsByDate.set(workspaceDateKey(date, timeZone), item);
    }
  }

  return Array.from({ length: days + 1 }, (_, index) => {
    const dateKey = dateKeyWithOffset(today, index - days);
    const point = pointsByDate.get(dateKey);
    return toChartPoint(point, dateKey, isFailureRateChart);
  });
}

function mondayDateKey(dateKey: string): string {
  return dateKeyWithOffset(dateKey, -((weekdayNumber(dateKey) + 6) % 7));
}

function rollingWeeklySeries(
  series: MetricSeriesItemDto[],
  today: string,
  timeZone?: string,
  isFailureRateChart = false,
): ChartPoint[] {
  const pointsByWeek = new Map<string, MetricSeriesItemDto>();
  for (const item of series) {
    if (!item.periodStart) continue;
    const date = new Date(item.periodStart);
    if (!Number.isNaN(date.getTime())) {
      pointsByWeek.set(workspaceDateKey(date, timeZone), item);
    }
  }

  const firstWeek = mondayDateKey(dateKeyWithOffset(today, -90));
  const currentWeek = mondayDateKey(today);
  const weekCount = (dateKeyAsUtcDate(currentWeek).getTime() - dateKeyAsUtcDate(firstWeek).getTime()) / (7 * 24 * 60 * 60 * 1000);
  return Array.from({ length: weekCount + 1 }, (_, index) => {
    const weekStart = dateKeyWithOffset(firstWeek, index * 7);
    const point = pointsByWeek.get(weekStart);
    return toChartPoint(point, weekStart === currentWeek ? today : weekStart, isFailureRateChart);
  });
}

function formatValue(v: number, unit?: string, preset?: "7d" | "30d" | "90d"): string {
  if (unit === "percent" || unit === "%") {
    return `${Math.round(v)}%`;
  }
  if (unit === "hours" || unit === "h") {
    if (v >= 10 || v % 1 === 0) {
      return `${Math.round(v)}h`;
    }
    return `${v.toFixed(1)}h`;
  }
  const rateSuffix = preset === "7d" ? "/d" : "/w";
  const numStr = v % 1 === 0 ? String(Math.round(v)) : v.toFixed(1);
  return `${numStr}${rateSuffix}`;
}

function formatChartValue(v: number, unit: string | undefined, preset: "7d" | "30d" | "90d", label: string): string {
  if (label.toLowerCase().includes("change failure rate")) {
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }
  const chartPreset = preset === "30d" && label.toLowerCase().includes("deployment frequency")
    ? "7d"
    : preset;
  return formatValue(v, unit, chartPreset);
}

function getChangeFailureCounts(point: MetricSeriesItemDto): { failed: number; total: number } {
  const total = point.dimensions["total_deployments"] ?? point.sampleSize;
  const failed = point.dimensions["failed_deployments"] ?? Math.round((point.value * total) / 100);
  return { failed, total };
}

function toChartPoint(point: MetricSeriesItemDto | undefined, dateKey: string, isFailureRateChart: boolean): ChartPoint {
  if (!isFailureRateChart) return { value: point?.value ?? 0, dateKey };
  if (!point) return { value: 0, dateKey, failedDeploymentCount: 0, totalDeploymentCount: 0 };

  const counts = getChangeFailureCounts(point);
  return {
    value: counts.failed,
    dateKey,
    failedDeploymentCount: counts.failed,
    totalDeploymentCount: counts.total,
  };
}

/**
 * Lightweight SVG sparkline chart for a single DORA metric time series.
 * Features:
 * - 2x2 expanded dimensions with horizontal value axis (min, mid, max)
 * - 7d: Workspace-local weekday initials for the previous seven days through today
 * - 30d: Vertical dashed lines for Mondays (dark & light mode visible) + date labels
 * - 90d: 1st of each month markers without dashed lines
 */
export function DoraMetricChart({ series, color, label, preset, timezone, unit, variant = "card" }: DoraMetricChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const effectivePreset: "7d" | "30d" | "90d" = preset ?? (
    series.length <= 7 ? "7d" : series.length <= 35 ? "30d" : "90d"
  );
  const todayKey = workspaceDateKey(new Date(), timezone);
  const rangeDays = effectivePreset === "7d" ? 7 : effectivePreset === "30d" ? 30 : 90;
  const chartRangeStartKey = dateKeyWithOffset(todayKey, -rangeDays);
  const isFailureRateChart = label.toLowerCase().includes("change failure rate") ||
    series.some((item) => item.metricType === "CHANGE_FAILURE_RATE_PERCENT");
  const chartSeries = effectivePreset === "90d"
    ? rollingWeeklySeries(series, todayKey, timezone, isFailureRateChart)
    : rollingDailySeries(series, rangeDays, todayKey, timezone, isFailureRateChart);

  if (chartSeries.length < 2) {
    return (
      <div className="dora-chart-empty" aria-label={label}>
        <span>Not enough data</span>
      </div>
    );
  }

  const effectiveUnit = unit ?? series[0]?.unit ?? (
    label.toLowerCase().includes("failure") ? "percent" :
    label.toLowerCase().includes("time") || label.toLowerCase().includes("lead") ? "hours" :
    "deployments"
  );

  const isDetails = variant === "details";
  const W = isDetails ? 720 : 360;
  const H = isDetails ? 130 : 100;
  const PAD_LEFT = isDetails ? 42 : 32;
  const PAD_RIGHT = isDetails ? 14 : 10;
  const PAD_TOP = isDetails ? 12 : 10;
  const BASELINE_Y = isDetails ? 104 : 82;
  const LABEL_Y = isDetails ? 119 : 95;
  const PLOT_H = BASELINE_Y - PAD_TOP;

  const values = chartSeries.map((s) => s.value);
  const dataMax = Math.max(...values);
  const minVal = 0;
  const maxVal = isFailureRateChart
    ? Math.max(2, Math.ceil(dataMax / 2) * 2)
    : dataMax > 0 ? dataMax : (effectiveUnit === "percent" ? 100 : 1);
  const range = maxVal - minVal || 1;

  const rangeStartTime = dateKeyAsUtcDate(chartRangeStartKey).getTime();
  const rangeEndTime = dateKeyAsUtcDate(todayKey).getTime();
  const xForDateKey = (dateKey: string) => {
    const fraction = (dateKeyAsUtcDate(dateKey).getTime() - rangeStartTime) / (rangeEndTime - rangeStartTime || 1);
    const boundedFraction = Math.max(0, Math.min(1, fraction));
    return PAD_LEFT + boundedFraction * (W - PAD_LEFT - PAD_RIGHT);
  };
  const toX = (i: number) => xForDateKey(chartSeries[i].dateKey);
  const toY = (v: number) =>
    BASELINE_Y - ((v - minVal) / range) * PLOT_H;

  const handlePlotPointerMove = (event: ReactPointerEvent<SVGRectElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    const bounds = svg?.getBoundingClientRect();
    if (!bounds || bounds.width === 0) return;

    const pointerX = ((event.clientX - bounds.left) / bounds.width) * W;
    const nearestIndex = chartSeries.reduce((closestIndex, point, index) =>
      Math.abs(xForDateKey(point.dateKey) - pointerX) < Math.abs(toX(closestIndex) - pointerX) ? index : closestIndex,
    0);
    setHoveredIndex(nearestIndex);
  };

  const points = chartSeries
    .map((s, i) => `${toX(i)},${toY(s.value)}`)
    .join(" ");

  const areaPoints = [
    `${toX(0)},${BASELINE_Y}`,
    ...chartSeries.map((s, i) => `${toX(i)},${toY(s.value)}`),
    `${toX(chartSeries.length - 1)},${BASELINE_Y}`,
  ].join(" ");

  // 2. "30d": Mondays detection & date markers
  interface DateMarker {
    x: number;
    label: string;
    anchor: "start" | "middle" | "end";
  }

  const mondayLines30d: number[] = [];
  const dateMarkers30d: DateMarker[] = [];

  if (effectivePreset === "30d" && chartSeries.length >= 2) {
    const mondays: { x: number; date: string }[] = [];
    chartSeries.forEach((item, i) => {
      if (weekdayNumber(item.dateKey) === 1) {
        mondays.push({ x: toX(i), date: formatDateKey(item.dateKey) });
      }
    });

    // Collect Monday line coordinates
    mondays.forEach((m) => mondayLines30d.push(m.x));

    // Monday labels
    mondays.forEach((m) => {
      const isNearEnd = m.x >= W - PAD_RIGHT - 25;
      const isNearStart = m.x <= PAD_LEFT + 20;
      const anchor: "start" | "middle" | "end" = isNearStart ? "start" : isNearEnd ? "end" : "middle";
      dateMarkers30d.push({ x: m.x, label: m.date, anchor });
    });

    // "Today" label if last Monday is >= 35px from right edge
    const lastMon = mondays[mondays.length - 1];
    if (!lastMon || (W - PAD_RIGHT) - lastMon.x >= 35) {
      dateMarkers30d.push({ x: W - PAD_RIGHT, label: "Today", anchor: "end" });
    }
  }

  // 3. "90d": 1st of each month markers without dashed lines
  const dateMarkers90d: DateMarker[] = [];
  const monthFirstTicks90d: number[] = [];

  if (effectivePreset === "90d" && chartSeries.length >= 2) {
    const [startYear, startMonth] = chartRangeStartKey.split("-").map(Number);
    const monthStart = new Date(Date.UTC(startYear, startMonth - 1, 1));
    const today = dateKeyAsUtcDate(todayKey);

    while (monthStart <= today) {
      const monthDateKey = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}-${String(monthStart.getUTCDate()).padStart(2, "0")}`;
      if (monthDateKey >= chartRangeStartKey) {
        const x = xForDateKey(monthDateKey);
        monthFirstTicks90d.push(x);
        dateMarkers90d.push({ x, label: formatDateKey(monthDateKey), anchor: "middle" });
      }
      monthStart.setUTCMonth(monthStart.getUTCMonth() + 1);
    }

    // Add "Today" at the right edge if there is space
    const lastX = dateMarkers90d[dateMarkers90d.length - 1]?.x ?? PAD_LEFT;
    if (W - PAD_RIGHT - lastX >= (isDetails ? 65 : 40)) {
      dateMarkers90d.push({ x: W - PAD_RIGHT, label: "Today", anchor: "end" });
    }
  }

  const midY = PAD_TOP + PLOT_H / 2;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      aria-label={label}
      role="img"
      className={`dora-chart-svg${isDetails ? " dora-chart-svg--details" : ""}`}
    >
      {/* Gradient fill under the line */}
      <defs>
        <linearGradient id={`grad-${label.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* ── Horizontal Gridlines ── */}
      <line
        x1={PAD_LEFT}
        y1={PAD_TOP}
        x2={W - PAD_RIGHT}
        y2={PAD_TOP}
        stroke="var(--text-secondary, #94a3b8)"
        strokeOpacity="0.2"
        strokeDasharray="2 2"
      />
      <text
        x={PAD_LEFT - 5}
        y={PAD_TOP + 3}
        textAnchor="end"
        fontSize={isDetails ? "6.5" : "8"}
        fontWeight="500"
        fill="var(--text-secondary, #94a3b8)"
      >
        {formatChartValue(maxVal, effectiveUnit, effectivePreset, label)}
      </text>
      <line
        x1={PAD_LEFT}
        y1={midY}
        x2={W - PAD_RIGHT}
        y2={midY}
        stroke="var(--text-secondary, #94a3b8)"
        strokeOpacity="0.14"
        strokeDasharray="2 2"
      />
      <text
        x={PAD_LEFT - 5}
        y={midY + 3}
        textAnchor="end"
        fontSize={isDetails ? "6.5" : "8"}
        fontWeight="500"
        fill="var(--text-secondary, #94a3b8)"
      >
        {formatChartValue(maxVal / 2, effectiveUnit, effectivePreset, label)}
      </text>
      <line
        x1={PAD_LEFT}
        y1={BASELINE_Y}
        x2={W - PAD_RIGHT}
        y2={BASELINE_Y}
        stroke="rgba(255, 255, 255, 0.14)"
        strokeWidth="1"
      />
      <text
        x={PAD_LEFT - 5}
        y={BASELINE_Y + 3}
        textAnchor="end"
        fontSize={isDetails ? "6.5" : "8"}
        fontWeight="500"
        fill="var(--text-secondary, #94a3b8)"
      >
        {formatChartValue(0, effectiveUnit, effectivePreset, label)}
      </text>
      {/* Vertical dashed lines for Mondays in 30d (visible in both dark and light modes) */}
      {effectivePreset === "30d" &&
        mondayLines30d.map((x, i) => (
          <g key={`mon-div-${i}`}>
            <line
              x1={x}
              y1={PAD_TOP}
              x2={x}
              y2={BASELINE_Y}
              stroke="var(--text-secondary, #94a3b8)"
              strokeOpacity="0.4"
              strokeDasharray="3 3"
            />
            <line
              x1={x}
              y1={BASELINE_Y - 3}
              x2={x}
              y2={BASELINE_Y + 3}
              stroke="var(--text-secondary, #94a3b8)"
              strokeOpacity="0.65"
              strokeWidth="1.2"
            />
          </g>
        ))}

      {/* X-axis baseline tick dots for each point */}
      {chartSeries.map((_, i) => (
        <circle
          key={`tick-${i}`}
          cx={toX(i)}
          cy={BASELINE_Y}
          r={effectivePreset === "7d" ? (isDetails ? "1.2" : "1.5") : (isDetails ? "0.8" : "1")}
          fill="rgba(255, 255, 255, 0.28)"
        />
      ))}

      {/* Vertical dashed lines for 1st of each month in 90d (visible in both dark and light modes) */}
      {effectivePreset === "90d" &&
        monthFirstTicks90d.map((x, i) => (
          <g key={`m1st-div-${i}`}>
            <line
              x1={x}
              y1={PAD_TOP}
              x2={x}
              y2={BASELINE_Y}
              stroke="var(--text-secondary, #94a3b8)"
              strokeOpacity="0.4"
              strokeDasharray="3 3"
            />
            <line
              x1={x}
              y1={BASELINE_Y - 3}
              x2={x}
              y2={BASELINE_Y + 3}
              stroke="var(--text-secondary, #94a3b8)"
              strokeOpacity="0.65"
              strokeWidth="1.2"
            />
          </g>
        ))}

      {/* Area fill */}
      <polygon
        points={areaPoints}
        fill={`url(#grad-${label.replace(/\s+/g, "-")})`}
      />

      {/* Trend line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={isDetails ? "1.4" : "1.8"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data point dots on the line */}
      {chartSeries.map((s, i) => {
        const isLast = i === chartSeries.length - 1;
        return (
          <circle
            key={`pt-${i}`}
            cx={toX(i)}
            cy={toY(s.value)}
            r={isLast ? (isDetails ? "2.4" : "3") : (isDetails ? "1.4" : "1.8")}
            fill={isLast ? color : "#0f141c"}
            stroke={color}
            strokeWidth={isLast ? "0" : (isDetails ? "1" : "1.2")}
          />
        );
      })}

      {/* ── X-axis Labels ── */}
      {/* 7d: Workspace-local weekday labels */}
      {effectivePreset === "7d" &&
        chartSeries.map((point, i) => (
          <text
            key={`day-lbl-${i}`}
            x={toX(i)}
            y={LABEL_Y}
            textAnchor="middle"
            fontSize={isDetails ? "6.8" : "9"}
            fontWeight="500"
            fill="var(--text-secondary, #94a3b8)"
          >
            {weekdayLetter(point.dateKey)}
          </text>
        ))}

      {/* 30d: Date labels with Mondays and Today */}
      {effectivePreset === "30d" &&
        dateMarkers30d.map((m, i) => (
          <text
            key={`d30-lbl-${i}`}
            x={m.x}
            y={LABEL_Y}
            textAnchor={m.anchor}
            fontSize={isDetails ? "6.5" : "8.5"}
            fontWeight="500"
            fill="var(--text-secondary, #94a3b8)"
          >
            {m.label}
          </text>
        ))}

      {/* 90d: 1st of each month labels (e.g. Jul 1, Aug 1, Sep 1, Today) */}
      {effectivePreset === "90d" &&
        dateMarkers90d.map((m, i) => (
          <text
            key={`d90-lbl-${i}`}
            x={m.x}
            y={LABEL_Y}
            textAnchor={m.anchor}
            fontSize={isDetails ? "6.5" : "8.5"}
            fontWeight="500"
            fill="var(--text-secondary, #94a3b8)"
          >
            {m.label}
          </text>
        ))}

      <rect
        x={PAD_LEFT}
        y={PAD_TOP}
        width={W - PAD_LEFT - PAD_RIGHT}
        height={PLOT_H}
        fill="transparent"
        pointerEvents="all"
        aria-hidden="true"
        data-testid="chart-hover-area"
        onPointerMove={handlePlotPointerMove}
        onPointerLeave={() => setHoveredIndex(null)}
      />

      {hoveredIndex !== null && (() => {
        const point = chartSeries[hoveredIndex];
        if (!point) return null;

        const pointLabel = isFailureRateChart
          ? String(point.failedDeploymentCount ?? 0) + " failed / " + String(point.totalDeploymentCount ?? 0) +
            (point.totalDeploymentCount === 1 ? " deployment" : " deployments")
          : formatChartValue(point.value, effectiveUnit, effectivePreset, label);
        const tooltipText = formatDateKey(point.dateKey) + " · " + pointLabel;
        const fontSz = isDetails ? 7.6 : 7.5;
        const charW = isDetails ? 4.4 : 4.4;
        const padX = isDetails ? 14 : 12;
        const tooltipWidth = Math.min(
          W - PAD_LEFT - PAD_RIGHT,
          Math.max(isDetails ? 62 : 58, tooltipText.length * charW + padX),
        );
        const tooltipHeight = isDetails ? 16 : 16;
        const textY = isDetails ? 11.2 : 11.2;
        const pointX = toX(hoveredIndex);
        const pointY = toY(point.value);
        const tooltipX = Math.max(PAD_LEFT, Math.min(pointX - tooltipWidth / 2, W - PAD_RIGHT - tooltipWidth));
        const tooltipY = pointY - tooltipHeight - 5 >= PAD_TOP
          ? pointY - tooltipHeight - 5
          : pointY + 6;
        return (
          <g
            className="dora-chart-tooltip"
            role="tooltip"
            pointerEvents="none"
            transform={`translate(${tooltipX} ${tooltipY})`}
          >
            <rect
              x="0"
              y="0"
              width={tooltipWidth}
              height={tooltipHeight}
              rx="3"
              fill="var(--card-bg, #101010)"
              stroke="var(--border-color, #414141)"
              strokeWidth="1"
            />
            <text
              x={tooltipWidth / 2}
              y={textY}
              textAnchor="middle"
              fontSize={fontSz}
              fontWeight="600"
              fill="var(--text-primary, #f8fafc)"
            >
              {tooltipText}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}
