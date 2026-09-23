import type { MetricSeriesItemDto } from "./types.js";

interface DoraMetricChartProps {
  series: MetricSeriesItemDto[];
  color: string;
  /** aria-label for the chart SVG */
  label: string;
  preset?: "7d" | "30d" | "90d";
  timezone?: string;
  unit?: string;
}

interface ChartPoint {
  value: number;
  dateKey: string;
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
    return {
      value: point?.value ?? 0,
      dateKey,
    };
  });
}

function mondayDateKey(dateKey: string): string {
  return dateKeyWithOffset(dateKey, -((weekdayNumber(dateKey) + 6) % 7));
}

function rollingWeeklySeries(series: MetricSeriesItemDto[], today: string, timeZone?: string): ChartPoint[] {
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
    return {
      value: point?.value ?? 0,
      dateKey: weekStart === currentWeek ? today : weekStart,
    };
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

/**
 * Lightweight SVG sparkline chart for a single DORA metric time series.
 * Features:
 * - 2x2 expanded dimensions with horizontal value axis (min, mid, max)
 * - 7d: Workspace-local weekday initials for the previous seven days through today
 * - 30d: Vertical dashed lines for Mondays (dark & light mode visible) + date labels
 * - 90d: 1st of each month markers without dashed lines
 */
export function DoraMetricChart({ series, color, label, preset, timezone, unit }: DoraMetricChartProps) {
  const effectivePreset: "7d" | "30d" | "90d" = preset ?? (
    series.length <= 7 ? "7d" : series.length <= 35 ? "30d" : "90d"
  );
  const todayKey = workspaceDateKey(new Date(), timezone);
  const rangeDays = effectivePreset === "7d" ? 7 : effectivePreset === "30d" ? 30 : 90;
  const chartRangeStartKey = dateKeyWithOffset(todayKey, -rangeDays);
  const chartSeries = effectivePreset === "90d"
    ? rollingWeeklySeries(series, todayKey, timezone)
    : rollingDailySeries(series, rangeDays, todayKey, timezone);

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

  const W = 360;
  const H = 100;
  const PAD_LEFT = 32;
  const PAD_RIGHT = 10;
  const PAD_TOP = 10;
  const BASELINE_Y = 82;
  const LABEL_Y = 95;
  const PLOT_H = BASELINE_Y - PAD_TOP;

  const values = chartSeries.map((s) => s.value);
  const dataMax = Math.max(...values);
  const minVal = 0;
  const maxVal = dataMax > 0 ? dataMax : (effectiveUnit === "percent" ? 100 : 1);
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
    if (W - PAD_RIGHT - lastX >= 40) {
      dateMarkers90d.push({ x: W - PAD_RIGHT, label: "Today", anchor: "end" });
    }
  }

  const midY = PAD_TOP + PLOT_H / 2;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-label={label}
      role="img"
      className="dora-chart-svg"
    >
      {/* Gradient fill under the line */}
      <defs>
        <linearGradient id={`grad-${label.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* ── Horizontal Gridlines & Value Labels ── */}
      {/* Top line (max value) */}
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
        fontSize="8"
        fontWeight="500"
        fill="var(--text-secondary, #94a3b8)"
      >
        {formatValue(maxVal, effectiveUnit, effectivePreset)}
      </text>

      {/* Middle line (mid value) */}
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
        fontSize="8"
        fontWeight="500"
        fill="var(--text-secondary, #94a3b8)"
      >
        {formatValue(maxVal / 2, effectiveUnit, effectivePreset)}
      </text>

      {/* Baseline (0 value) */}
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
        fontSize="8"
        fontWeight="500"
        fill="var(--text-secondary, #94a3b8)"
      >
        {formatValue(0, effectiveUnit, effectivePreset)}
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
          r={effectivePreset === "7d" ? "1.5" : "1"}
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
        strokeWidth="1.8"
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
            r={isLast ? "3" : "1.8"}
            fill={isLast ? color : "#0f141c"}
            stroke={color}
            strokeWidth={isLast ? "0" : "1.2"}
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
            fontSize="9"
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
            fontSize="8.5"
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
            fontSize="8.5"
            fontWeight="500"
            fill="var(--text-secondary, #94a3b8)"
          >
            {m.label}
          </text>
        ))}
    </svg>
  );
}
