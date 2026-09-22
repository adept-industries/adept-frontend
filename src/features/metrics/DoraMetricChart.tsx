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

function formatDate(dateStr: string | undefined, timeZone?: string, fallbackDaysAgo?: number): string {
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      try {
        const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        return new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          timeZone: tz,
        }).format(d);
      } catch {
        return `${d.getMonth() + 1}/${d.getDate()}`;
      }
    }
  }
  if (fallbackDaysAgo !== undefined) {
    const d = new Date();
    d.setDate(d.getDate() - fallbackDaysAgo);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  return "";
}

/**
 * Lightweight SVG sparkline chart for a single DORA metric time series.
 * Features:
 * - 2x2 expanded dimensions
 * - 7d: Timezone-aware day of week initials (e.g. T, W, T, F, S, S, M, T)
 * - 30d: Date labels (e.g. Aug 24 -> Aug 31 -> Sep 8 -> Sep 15 -> Today) with dividers
 * - 90d: Date labels (e.g. Jun 30 -> Jul 28 -> Aug 25 -> Today) with dividers
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

  // 2. "30d": 5 date labels (Start, 25%, 50%, 75%, Today)
  interface DateMarker {
    x: number;
    label: string;
    anchor: "start" | "middle" | "end";
    isDivider: boolean;
  }

  const dateMarkers30d: DateMarker[] = [];
  if (effectivePreset === "30d" && series.length >= 2) {
    const lastIdx = series.length - 1;
    const indices = [
      0,
      Math.round(lastIdx * 0.25),
      Math.round(lastIdx * 0.5),
      Math.round(lastIdx * 0.75),
      lastIdx,
    ];
    indices.forEach((idx, step) => {
      const isFirst = step === 0;
      const isLast = step === indices.length - 1;
      const anchor: "start" | "middle" | "end" = isFirst ? "start" : isLast ? "end" : "middle";
      const x = isFirst ? PAD_X : isLast ? W - PAD_X : toX(idx);
      const markerLabel = isLast
        ? "Today"
        : formatDate(series[idx].periodStart, timezone, Math.round(30 * (1 - step / 4)));
      dateMarkers30d.push({ x, label: markerLabel, anchor, isDivider: !isFirst && !isLast });
    });
  }

  // 3. "90d": 4 date labels (Start, ~33%, ~66%, Today)
  const dateMarkers90d: DateMarker[] = [];
  if (effectivePreset === "90d" && series.length >= 2) {
    const lastIdx = series.length - 1;
    const indices = [
      0,
      Math.round(lastIdx / 3),
      Math.round((2 * lastIdx) / 3),
      lastIdx,
    ];
    indices.forEach((idx, step) => {
      const isFirst = step === 0;
      const isLast = step === indices.length - 1;
      const anchor: "start" | "middle" | "end" = isFirst ? "start" : isLast ? "end" : "middle";
      const x = isFirst ? PAD_X : isLast ? W - PAD_X : toX(idx);
      const markerLabel = isLast
        ? "Today"
        : formatDate(series[idx].periodStart, timezone, Math.round(90 * (1 - step / 3)));
      dateMarkers90d.push({ x, label: markerLabel, anchor, isDivider: !isFirst && !isLast });
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

      {/* Vertical divider lines for 30d */}
      {effectivePreset === "30d" &&
        dateMarkers30d.map(
          (m, i) =>
            m.isDivider && (
              <g key={`div30-${i}`}>
                <line
                  x1={m.x}
                  y1={PAD_TOP}
                  x2={m.x}
                  y2={BASELINE_Y}
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeDasharray="2 2"
                />
                <line
                  x1={m.x}
                  y1={BASELINE_Y - 3}
                  x2={m.x}
                  y2={BASELINE_Y + 3}
                  stroke="rgba(255, 255, 255, 0.25)"
                  strokeWidth="1"
                />
              </g>
            )
        )}

      {/* Vertical divider lines for 90d */}
      {effectivePreset === "90d" &&
        dateMarkers90d.map(
          (m, i) =>
            m.isDivider && (
              <g key={`div90-${i}`}>
                <line
                  x1={m.x}
                  y1={PAD_TOP}
                  x2={m.x}
                  y2={BASELINE_Y}
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeDasharray="2 2"
                />
                <line
                  x1={m.x}
                  y1={BASELINE_Y - 3}
                  x2={m.x}
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

      {/* 30d: Date labels (e.g. Aug 24 -> Aug 31 -> Sep 8 -> Sep 15 -> Today) */}
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

      {/* 90d: Date labels (e.g. Jun 30 -> Jul 28 -> Aug 25 -> Today) */}
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
