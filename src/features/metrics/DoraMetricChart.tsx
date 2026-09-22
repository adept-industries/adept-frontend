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

const DAY_LETTERS: Record<string, string> = {
  Sun: "S",
  Mon: "M",
  Tue: "T",
  Wed: "W",
  Thu: "T",
  Fri: "F",
  Sat: "S",
};

function getDayLetter(date: Date, timeZone?: string): string {
  try {
    const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(date);
    return DAY_LETTERS[weekday] ?? weekday.charAt(0);
  } catch {
    const fallback = ["S", "M", "T", "W", "T", "F", "S"];
    return fallback[date.getDay()];
  }
}

function isMonday(date: Date, timeZone?: string): boolean {
  try {
    const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(date);
    return weekday === "Mon";
  } catch {
    return date.getDay() === 1;
  }
}

function formatDate(date: Date, timeZone?: string): string {
  try {
    const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: tz,
    }).format(date);
  } catch {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
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
 * - 7d: Timezone-aware day of week initials (e.g. T, W, T, F, S, S, M, T)
 * - 30d: Vertical dashed lines for Mondays (dark & light mode visible) + date labels
 * - 90d: 1st of each month markers without dashed lines
 */
export function DoraMetricChart({ series, color, label, preset, timezone, unit }: DoraMetricChartProps) {
  if (series.length < 2) {
    return (
      <div className="dora-chart-empty" aria-label={label}>
        <span>Not enough data</span>
      </div>
    );
  }

  const effectivePreset: "7d" | "30d" | "90d" = preset ?? (
    series.length <= 7 ? "7d" : series.length <= 35 ? "30d" : "90d"
  );

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

  const values = series.map((s) => s.value);
  const dataMax = Math.max(...values);
  const minVal = 0;
  const maxVal = dataMax > 0 ? dataMax : (effectiveUnit === "percent" ? 100 : 1);
  const range = maxVal - minVal || 1;

  const toX = (i: number) =>
    PAD_LEFT + (i / (series.length - 1)) * (W - PAD_LEFT - PAD_RIGHT);
  const toY = (v: number) =>
    BASELINE_Y - ((v - minVal) / range) * PLOT_H;

  const points = series
    .map((s, i) => `${toX(i)},${toY(s.value)}`)
    .join(" ");

  const areaPoints = [
    `${toX(0)},${BASELINE_Y}`,
    ...series.map((s, i) => `${toX(i)},${toY(s.value)}`),
    `${toX(series.length - 1)},${BASELINE_Y}`,
  ].join(" ");

  // 1. "7d": Fallback weekday letters
  const fallbackWeek = ["M", "T", "W", "T", "F", "S", "S"];

  // 2. "30d": Mondays detection & date markers
  interface DateMarker {
    x: number;
    label: string;
    anchor: "start" | "middle" | "end";
  }

  const mondayLines30d: number[] = [];
  const dateMarkers30d: DateMarker[] = [];

  if (effectivePreset === "30d" && series.length >= 2) {
    const mondays: { index: number; x: number; date: string }[] = [];
    series.forEach((item, i) => {
      if (item.periodStart) {
        const d = new Date(item.periodStart);
        if (!isNaN(d.getTime()) && isMonday(d, timezone)) {
          mondays.push({ index: i, x: toX(i), date: formatDate(d, timezone) });
        }
      }
    });

    // Collect Monday line coordinates
    mondays.forEach((m) => mondayLines30d.push(m.x));

    // Optional start label if first Monday is >= 35px from start
    const firstMon = mondays[0];
    if (firstMon && firstMon.x >= PAD_LEFT + 35 && series[0].periodStart) {
      dateMarkers30d.push({
        x: PAD_LEFT,
        label: formatDate(new Date(series[0].periodStart), timezone),
        anchor: "start",
      });
    }

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

  if (effectivePreset === "90d" && series.length >= 2) {
    const startDate = series[0].periodStart ? new Date(series[0].periodStart) : null;
    const endDate = series[series.length - 1].periodStart
      ? new Date(series[series.length - 1].periodStart)
      : null;

    if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      const tStart = startDate.getTime();
      const tEnd = endDate.getTime();
      const timeToX = (t: number) =>
        PAD_LEFT + ((t - tStart) / (tEnd - tStart || 1)) * (W - PAD_LEFT - PAD_RIGHT);

      // Iterate through months between start and end
      const d = new Date(startDate);
      d.setUTCDate(1);
      d.setUTCHours(0, 0, 0, 0);

      while (d <= endDate) {
        if (d >= startDate) {
          const x = timeToX(d.getTime());
          monthFirstTicks90d.push(x);
          dateMarkers90d.push({
            x,
            label: formatDate(d, timezone),
            anchor: "middle",
          });
        }
        d.setUTCMonth(d.getUTCMonth() + 1);
      }

      // Add "Today" at the right edge if there is space
      const lastX = dateMarkers90d[dateMarkers90d.length - 1]?.x ?? 0;
      if (W - PAD_RIGHT - lastX >= 40) {
        dateMarkers90d.push({ x: W - PAD_RIGHT, label: "Today", anchor: "end" });
      }
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
      {series.map((_, i) => (
        <circle
          key={`tick-${i}`}
          cx={toX(i)}
          cy={BASELINE_Y}
          r={effectivePreset === "7d" ? "1.5" : "1"}
          fill="rgba(255, 255, 255, 0.28)"
        />
      ))}

      {/* 90d baseline ticks for 1st of each month */}
      {effectivePreset === "90d" &&
        monthFirstTicks90d.map((x, i) => (
          <line
            key={`m1st-tick-${i}`}
            x1={x}
            y1={BASELINE_Y - 3}
            x2={x}
            y2={BASELINE_Y + 3}
            stroke="var(--text-secondary, #94a3b8)"
            strokeOpacity="0.65"
            strokeWidth="1.2"
          />
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
      {series.map((s, i) => {
        const isLast = i === series.length - 1;
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
      {/* 7d: Day of week letters (T, W, T, F, S, S, M, T) */}
      {effectivePreset === "7d" &&
        series.map((s, i) => {
          let letter = fallbackWeek[i % 7];
          if (s.periodStart) {
            const d = new Date(s.periodStart);
            if (!isNaN(d.getTime())) {
              letter = getDayLetter(d, timezone);
            }
          }
          return (
            <text
              key={`day-lbl-${i}`}
              x={toX(i)}
              y={LABEL_Y}
              textAnchor="middle"
              fontSize="9"
              fontWeight="500"
              fill="var(--text-secondary, #94a3b8)"
            >
              {letter}
            </text>
          );
        })}

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
