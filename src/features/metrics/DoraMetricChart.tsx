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

/**
 * Lightweight SVG sparkline chart for a single DORA metric time series.
 * Features:
 * - 2x2 expanded dimensions
 * - 7d: Timezone-aware day of week labels (e.g. T, W, T, F, S, S, M, T)
 * - 30d: 4 equally divided weeks (W1, W2, W3, W4) with clean vertical dividers
 * - 90d: Equal 3-week intervals (W1, W4, W7, W10, W13) with dividers
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

  // 1. "7d": Fallback weekday letters
  const fallbackWeek = ["M", "T", "W", "T", "F", "S", "S"];

  // 2. "30d": 4 equal week quarters across the month
  const qWidth30 = (W - PAD_X * 2) / 4;
  const quarters30d = [0, 1, 2, 3].map((q) => ({
    label: `W${q + 1}`,
    centerX: PAD_X + (q + 0.5) * qWidth30,
    dividerX: q > 0 ? PAD_X + q * qWidth30 : null,
  }));

  // 3. "90d": Equal 3-week intervals (W1, W4, W7, W10, W13)
  const weekBoundaries90d: { x: number; label: string; isDivider: boolean }[] = [];
  if (effectivePreset === "90d") {
    const step = 3;
    for (let i = 0; i < series.length; i += step) {
      weekBoundaries90d.push({
        x: toX(i),
        label: `W${i + 1}`,
        isDivider: i > 0,
      });
    }
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

      {/* Vertical week boundary divider lines for 30d (equal 4 quarters) */}
      {effectivePreset === "30d" &&
        quarters30d.map(
          (q, i) =>
            q.dividerX !== null && (
              <g key={`wb-div-${i}`}>
                <line
                  x1={q.dividerX}
                  y1={PAD_TOP}
                  x2={q.dividerX}
                  y2={BASELINE_Y}
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeDasharray="2 2"
                />
                <line
                  x1={q.dividerX}
                  y1={BASELINE_Y - 3}
                  x2={q.dividerX}
                  y2={BASELINE_Y + 3}
                  stroke="rgba(255, 255, 255, 0.25)"
                  strokeWidth="1"
                />
              </g>
            )
        )}

      {/* Vertical week boundary divider lines for 90d (equal 3-week intervals) */}
      {effectivePreset === "90d" &&
        weekBoundaries90d.map(
          (wb, i) =>
            wb.isDivider && (
              <g key={`wb90-div-${i}`}>
                <line
                  x1={wb.x}
                  y1={PAD_TOP}
                  x2={wb.x}
                  y2={BASELINE_Y}
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeDasharray="2 2"
                />
                <line
                  x1={wb.x}
                  y1={BASELINE_Y - 3}
                  x2={wb.x}
                  y2={BASELINE_Y + 3}
                  stroke="rgba(255, 255, 255, 0.25)"
                  strokeWidth="1"
                />
              </g>
            )
        )}

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

      {/* 30d: 4 equal weeks (W1, W2, W3, W4) centered in each quarter */}
      {effectivePreset === "30d" &&
        quarters30d.map((q, i) => (
          <text
            key={`w-lbl-${i}`}
            x={q.centerX}
            y={LABEL_Y}
            textAnchor="middle"
            fontSize="9"
            fontWeight="500"
            fill="var(--text-secondary, #94a3b8)"
          >
            {q.label}
          </text>
        ))}

      {/* 90d: Equal 3-week intervals (W1, W4, W7, W10, W13) */}
      {effectivePreset === "90d" &&
        weekBoundaries90d.map((wb, i) => (
          <text
            key={`w90-lbl-${i}`}
            x={wb.x}
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
