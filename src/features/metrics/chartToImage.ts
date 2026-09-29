/**
 * Converts DORA metric series data into a PNG data URL by constructing
 * a self-contained SVG and rendering it via HTMLCanvasElement.
 *
 * CSS variable fallbacks in the SVG (e.g. var(--text-secondary, #94a3b8))
 * resolve to the fallback values in the offscreen Canvas context, giving a
 * clean light-mode-neutral chart suitable for PDF embedding.
 */

import type { MetricSeriesItemDto } from "./types.js";

// ─── date helpers (mirrors DoraMetricChart.tsx) ──────────────────────────────

function workspaceDateKey(date: Date, timeZone?: string): string {
  try {
    const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? "00";
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

function mondayDateKey(dateKey: string): string {
  return dateKeyWithOffset(dateKey, -((weekdayNumber(dateKey) + 6) % 7));
}

// ─── chart-point building ─────────────────────────────────────────────────────

interface ChartPoint {
  value: number;
  dateKey: string;
}

function rollingDailySeries(
  series: MetricSeriesItemDto[],
  days: number,
  today: string,
  timeZone?: string,
): ChartPoint[] {
  const byDate = new Map<string, MetricSeriesItemDto>();
  for (const item of series) {
    if (!item.periodStart) continue;
    const d = new Date(item.periodStart);
    if (!Number.isNaN(d.getTime())) byDate.set(workspaceDateKey(d, timeZone), item);
  }
  return Array.from({ length: days + 1 }, (_, idx) => {
    const dateKey = dateKeyWithOffset(today, idx - days);
    return { value: byDate.get(dateKey)?.value ?? 0, dateKey };
  });
}

function rollingWeeklySeries(
  series: MetricSeriesItemDto[],
  today: string,
  timeZone?: string,
): ChartPoint[] {
  const byWeek = new Map<string, MetricSeriesItemDto>();
  for (const item of series) {
    if (!item.periodStart) continue;
    const d = new Date(item.periodStart);
    if (!Number.isNaN(d.getTime())) byWeek.set(workspaceDateKey(d, timeZone), item);
  }
  const firstWeek = mondayDateKey(dateKeyWithOffset(today, -90));
  const currentWeek = mondayDateKey(today);
  const weekCount =
    (dateKeyAsUtcDate(currentWeek).getTime() - dateKeyAsUtcDate(firstWeek).getTime()) /
    (7 * 24 * 60 * 60 * 1000);
  return Array.from({ length: weekCount + 1 }, (_, idx) => {
    const weekStart = dateKeyWithOffset(firstWeek, idx * 7);
    const point = byWeek.get(weekStart);
    return { value: point?.value ?? 0, dateKey: weekStart === currentWeek ? today : weekStart };
  });
}

function formatValue(v: number, unit?: string, preset?: "7d" | "30d" | "90d"): string {
  if (unit === "percent" || unit === "%") return `${Math.round(v)}%`;
  if (unit === "hours" || unit === "h") {
    if (v >= 10 || v % 1 === 0) return `${Math.round(v)}h`;
    return `${v.toFixed(1)}h`;
  }
  const rateSuffix = preset === "7d" ? "/d" : "/w";
  return `${v % 1 === 0 ? Math.round(v) : v.toFixed(1)}${rateSuffix}`;
}

// ─── SVG builder ──────────────────────────────────────────────────────────────

function buildChartSvg(
  chartSeries: ChartPoint[],
  color: string,
  label: string,
  preset: "7d" | "30d" | "90d",
  unit?: string,
): string {
  const W = 720;
  const H = 150;
  const PAD_LEFT = 42;
  const PAD_RIGHT = 14;
  const PAD_TOP = 14;
  const BASELINE_Y = 118;
  const LABEL_Y = 135;
  const PLOT_H = BASELINE_Y - PAD_TOP;

  const todayKey = workspaceDateKey(new Date());
  const rangeDays = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const rangeStartKey = dateKeyWithOffset(todayKey, -rangeDays);

  const rangeStartTime = dateKeyAsUtcDate(rangeStartKey).getTime();
  const rangeEndTime = dateKeyAsUtcDate(todayKey).getTime();

  const xForDateKey = (dateKey: string) => {
    const fraction =
      (dateKeyAsUtcDate(dateKey).getTime() - rangeStartTime) / (rangeEndTime - rangeStartTime || 1);
    return PAD_LEFT + Math.max(0, Math.min(1, fraction)) * (W - PAD_LEFT - PAD_RIGHT);
  };

  const values = chartSeries.map((s) => s.value);
  const dataMax = Math.max(...values, 0);
  const maxVal = dataMax > 0 ? dataMax : unit === "percent" ? 100 : 1;
  const midVal = maxVal / 2;
  const chartRange = maxVal || 1;

  const toX = (i: number) => xForDateKey(chartSeries[i].dateKey);
  const toY = (v: number) => BASELINE_Y - (v / chartRange) * PLOT_H;
  const midY = PAD_TOP + PLOT_H / 2;

  const TEXT_COLOR = "#64748b";
  const GRID_COLOR = "#cbd5e1";
  const BG_COLOR = "#f8fafc";

  const linePoints = chartSeries.map((s, i) => `${toX(i)},${toY(s.value)}`).join(" ");
  const areaPoints = [
    `${toX(0)},${BASELINE_Y}`,
    ...chartSeries.map((s, i) => `${toX(i)},${toY(s.value)}`),
    `${toX(chartSeries.length - 1)},${BASELINE_Y}`,
  ].join(" ");

  interface DateMarker {
    x: number;
    label: string;
    anchor: "start" | "middle" | "end";
  }
  const mondayLines: number[] = [];
  const dateMarkers: DateMarker[] = [];

  if (preset === "30d") {
    const mondays: { x: number; date: string }[] = [];
    chartSeries.forEach((item, i) => {
      if (weekdayNumber(item.dateKey) === 1) {
        mondays.push({ x: toX(i), date: formatDateKey(item.dateKey) });
      }
    });
    mondays.forEach(({ x }) => mondayLines.push(x));
    mondays.forEach(({ x, date }) => {
      const anchor: "start" | "middle" | "end" =
        x <= PAD_LEFT + 20 ? "start" : x >= W - PAD_RIGHT - 25 ? "end" : "middle";
      dateMarkers.push({ x, label: date, anchor });
    });
    const lastMon = mondays[mondays.length - 1];
    if (!lastMon || W - PAD_RIGHT - lastMon.x >= 35) {
      dateMarkers.push({ x: W - PAD_RIGHT, label: "Today", anchor: "end" });
    }
  } else if (preset === "90d") {
    const [sy, sm] = rangeStartKey.split("-").map(Number);
    const ms = new Date(Date.UTC(sy, sm - 1, 1));
    const today = dateKeyAsUtcDate(todayKey);
    while (ms <= today) {
      const mk = `${ms.getUTCFullYear()}-${String(ms.getUTCMonth() + 1).padStart(2, "0")}-01`;
      if (mk >= rangeStartKey) {
        const x = xForDateKey(mk);
        mondayLines.push(x);
        dateMarkers.push({ x, label: formatDateKey(mk), anchor: "middle" });
      }
      ms.setUTCMonth(ms.getUTCMonth() + 1);
    }
    const lastX = dateMarkers[dateMarkers.length - 1]?.x ?? PAD_LEFT;
    if (W - PAD_RIGHT - lastX >= 65) {
      dateMarkers.push({ x: W - PAD_RIGHT, label: "Today", anchor: "end" });
    }
  }

  const gradId = `grad-pdf-${label.replace(/\s+/g, "-")}`;
  const circleR = preset === "7d" ? 1.4 : 0.9;
  const lastIdx = chartSeries.length - 1;

  const dots = chartSeries
    .map(
      (s, i) =>
        `<circle cx="${toX(i).toFixed(2)}" cy="${toY(s.value).toFixed(2)}" r="${i === lastIdx ? 2.6 : circleR}" fill="${i === lastIdx ? color : "#fff"}" stroke="${color}" stroke-width="${i === lastIdx ? 0 : 1}" />`,
    )
    .join("\n    ");

  const gridLines = `
    <line x1="${PAD_LEFT}" y1="${PAD_TOP}" x2="${W - PAD_RIGHT}" y2="${PAD_TOP}" stroke="${GRID_COLOR}" stroke-dasharray="2 2" />
    <line x1="${PAD_LEFT}" y1="${midY.toFixed(2)}" x2="${W - PAD_RIGHT}" y2="${midY.toFixed(2)}" stroke="${GRID_COLOR}" stroke-dasharray="2 2" />
    <line x1="${PAD_LEFT}" y1="${BASELINE_Y}" x2="${W - PAD_RIGHT}" y2="${BASELINE_Y}" stroke="${GRID_COLOR}" />
    <text x="${PAD_LEFT - 4}" y="${PAD_TOP + 4}" text-anchor="end" font-size="7" fill="${TEXT_COLOR}">${formatValue(maxVal, unit, preset)}</text>
    <text x="${PAD_LEFT - 4}" y="${(midY + 4).toFixed(2)}" text-anchor="end" font-size="7" fill="${TEXT_COLOR}">${formatValue(midVal, unit, preset)}</text>
    <text x="${PAD_LEFT - 4}" y="${BASELINE_Y + 4}" text-anchor="end" font-size="7" fill="${TEXT_COLOR}">0</text>`;

  const vertLines = mondayLines
    .map(
      (x) =>
        `<line x1="${x.toFixed(2)}" y1="${PAD_TOP}" x2="${x.toFixed(2)}" y2="${BASELINE_Y}" stroke="${GRID_COLOR}" stroke-dasharray="3 3" />`,
    )
    .join("\n    ");

  const xLabels =
    preset === "7d"
      ? chartSeries
          .map(
            (s, i) =>
              `<text x="${toX(i).toFixed(2)}" y="${LABEL_Y}" text-anchor="middle" font-size="7" fill="${TEXT_COLOR}">${weekdayLetter(s.dateKey)}</text>`,
          )
          .join("\n    ")
      : dateMarkers
          .map(
            (m) =>
              `<text x="${m.x.toFixed(2)}" y="${LABEL_Y}" text-anchor="${m.anchor}" font-size="7" fill="${TEXT_COLOR}">${m.label}</text>`,
          )
          .join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${BG_COLOR}" rx="4"/>
  ${gridLines}
  ${vertLines}
  <polygon points="${areaPoints}" fill="url(#${gradId})"/>
  <polyline points="${linePoints}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  ${dots}
  ${xLabels}
</svg>`;
}

/**
 * Renders the DORA metric chart series to a PNG data URL.
 *
 * @returns A Promise resolving to a base64 PNG data URL, or `null` if
 *          rendering is not possible (e.g. in a test/SSR environment).
 */
export async function seriesChartToDataUrl(
  series: MetricSeriesItemDto[],
  color: string,
  label: string,
  preset: "7d" | "30d" | "90d",
  timezone: string | undefined,
  unit: string | undefined,
): Promise<string | null> {
  if (typeof document === "undefined") return null;
  if (series.length < 2) return null;

  const todayKey = workspaceDateKey(new Date(), timezone);
  const rangeDays = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;

  const chartSeries =
    preset === "90d"
      ? rollingWeeklySeries(series, todayKey, timezone)
      : rollingDailySeries(series, rangeDays, todayKey, timezone);

  if (chartSeries.length < 2) return null;

  const svg = buildChartSvg(chartSeries, color, label, preset, unit);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  return new Promise<string | null>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const W = 720;
      const H = 150;
      const canvas = document.createElement("canvas");
      // 2× for retina-quality PDF embedding
      canvas.width = W * 2;
      canvas.height = H * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(null);
        return;
      }
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, W, H);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
