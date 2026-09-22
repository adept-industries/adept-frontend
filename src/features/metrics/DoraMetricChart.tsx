import type { MetricSeriesItemDto } from "./types.js";

interface DoraMetricChartProps {
  series: MetricSeriesItemDto[];
  color: string;
  /** aria-label for the chart SVG */
  label: string;
}

/**
 * Lightweight SVG sparkline chart for a single DORA metric time series.
 * Features an X-axis baseline with day/week tick dots and data point markers on the line.
 */
export function DoraMetricChart({ series, color, label }: DoraMetricChartProps) {
  if (series.length < 2) {
    return (
      <div className="dora-chart-empty" aria-label={label}>
        <span>Not enough data</span>
      </div>
    );
  }

  const W = 280;
  const H = 56;
  const PAD_X = 6;
  const PAD_TOP = 6;
  const BASELINE_Y = H - 4;
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

      {/* X-axis baseline */}
      <line
        x1={toX(0)}
        y1={BASELINE_Y}
        x2={toX(series.length - 1)}
        y2={BASELINE_Y}
        stroke="rgba(255, 255, 255, 0.12)"
        strokeWidth="1"
      />

      {/* X-axis tick dots along the baseline for each interval (day/week) */}
      {series.map((_, i) => (
        <circle
          key={`tick-${i}`}
          cx={toX(i)}
          cy={BASELINE_Y}
          r="1.2"
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
        strokeWidth="1.5"
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
            r={isLast ? "2.5" : "1.8"}
            fill={isLast ? color : "#0f141c"}
            stroke={color}
            strokeWidth={isLast ? "0" : "1.2"}
          />
        );
      })}
    </svg>
  );
}
