import type { MetricSeriesItemDto } from "./types.js";

interface DoraMetricChartProps {
  series: MetricSeriesItemDto[];
  color: string;
  /** aria-label for the chart SVG */
  label: string;
  preset?: "7d" | "30d" | "90d";
  timezone?: string;
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

/**
 * Lightweight SVG sparkline chart for a single DORA metric time series.
 * Features:
 * - 2x2 expanded dimensions
 * - 7d: Day of week labels (M, T, W, T, F, S, S)
 * - 30d: Week boundary divider lines and week labels (W1, W2, ...)
 * - 90d: Week boundary ticks and week labels (W1, W3, ...)
 */
export function DoraMetricChart({ series, color, label, preset, timezone }: DoraMetricChartProps) {
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

  const W = 360;
  const H = 68;
  const PAD_X = 10;
  const PAD_TOP = 8;
  const BASELINE_Y = 52;
  const LABEL_Y = 64;
  const PLOT_H = BASELINE_Y - PAD_TOP;

  const values = series.map((s) => s.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const toX = (i: number) =>
    PAD_X + (i / (series.length - 1)) * (W - PAD_X * 2);
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

  // 1. "7d": Weekday letter for each day
  const fallbackWeek = ["M", "T", "W", "T", "F", "S", "S"];

  // 2. "30d": Week boundaries (Monday starts or every 7 days)
  const weekBoundaries30d: { index: number; label: string }[] = [];
  if (effectivePreset === "30d") {
    let weekCount = 1;
    series.forEach((s, i) => {
      let isBoundary = false;
      if (i === 0) {
        isBoundary = true;
      } else if (s.periodStart) {
        const d = new Date(s.periodStart);
        if (!isNaN(d.getTime()) && isMonday(d, timezone)) {
          isBoundary = true;
        }
      } else if (i % 7 === 0) {
        isBoundary = true;
      }

      if (isBoundary) {
        weekBoundaries30d.push({ index: i, label: `W${weekCount++}` });
      }
    });
  }

  // 3. "90d": Week boundaries (series items are weeks)
  const weekBoundaries90d: { index: number; label: string }[] = [];
  if (effectivePreset === "90d") {
    series.forEach((_, i) => {
      if (i === 0 || (i + 1) % 3 === 0 || i === series.length - 1) {
        weekBoundaries90d.push({ index: i, label: `W${i + 1}` });
      }
    });
  }

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

      {/* Vertical week boundary divider lines for 30d */}
      {effectivePreset === "30d" &&
        weekBoundaries30d.map((wb) => (
          <line
            key={`wb-line-${wb.index}`}
            x1={toX(wb.index)}
            y1={PAD_TOP}
            x2={toX(wb.index)}
            y2={BASELINE_Y}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeDasharray="2 2"
          />
        ))}

      {/* Vertical week boundary lines for 90d */}
      {effectivePreset === "90d" &&
        series.map((_, i) => (
          <line
            key={`wb90-line-${i}`}
            x1={toX(i)}
            y1={BASELINE_Y - 4}
            x2={toX(i)}
            y2={BASELINE_Y + 2}
            stroke="rgba(255, 255, 255, 0.18)"
            strokeWidth="1"
          />
        ))}

      {/* X-axis baseline */}
      <line
        x1={toX(0)}
        y1={BASELINE_Y}
        x2={toX(series.length - 1)}
        y2={BASELINE_Y}
        stroke="rgba(255, 255, 255, 0.14)"
        strokeWidth="1"
      />

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
      {/* 7d: Day of week letters (M, T, W, T, F, S, S) */}
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

      {/* 30d: Week boundary labels (W1, W2, W3, ...) */}
      {effectivePreset === "30d" &&
        weekBoundaries30d.map((wb) => (
          <text
            key={`w-lbl-${wb.index}`}
            x={toX(wb.index)}
            y={LABEL_Y}
            textAnchor="middle"
            fontSize="9"
            fontWeight="500"
            fill="var(--text-secondary, #94a3b8)"
          >
            {wb.label}
          </text>
        ))}

      {/* 90d: Week boundary labels (W1, W3, W6, ...) */}
      {effectivePreset === "90d" &&
        weekBoundaries90d.map((wb) => (
          <text
            key={`w90-lbl-${wb.index}`}
            x={toX(wb.index)}
            y={LABEL_Y}
            textAnchor="middle"
            fontSize="9"
            fontWeight="500"
            fill="var(--text-secondary, #94a3b8)"
          >
            {wb.label}
          </text>
        ))}
    </svg>
  );
}
