import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MetricSeriesItemDto } from "./types.js";
import { DoraMetricChart } from "./DoraMetricChart.js";

function seriesItem(periodStart: string, value: number): MetricSeriesItemDto {
  const start = new Date(`${periodStart}T00:00:00Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    metricType: "DEPLOYMENT_FREQUENCY",
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    value,
    unit: "deployments",
    sampleSize: value,
    dimensions: {},
  };
}

function renderedDateLabels(chart: HTMLElement): string[] {
  return Array.from(chart.querySelectorAll("text"))
    .map((node) => node.textContent ?? "")
    .filter((text) => /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d+$/.test(text));
}

describe("DoraMetricChart rolling date ranges", () => {
  afterEach(() => vi.useRealTimers());

  it("labels the 7-day series from seven days ago through today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T23:30:00Z"));

    render(
      <DoraMetricChart
        series={[seriesItem("2026-09-22", 4)]}
        color="#4caf82"
        label="Deployment Frequency trend"
        preset="7d"
        timezone="Pacific/Kiritimati"
      />,
    );

    const chart = screen.getByRole("img", { name: "Deployment Frequency trend" });
    const plottedPoints = chart.querySelector("polyline")?.getAttribute("points")?.split(" ") ?? [];
    const weekdayLabels = Array.from(chart.querySelectorAll('text[y="95"]')).map((node) => node.textContent);
    expect(plottedPoints).toHaveLength(8);
    expect(plottedPoints.at(-1)?.split(",")[0]).toBe("350");
    expect(weekdayLabels).toEqual(["W", "T", "F", "S", "S", "M", "T", "W"]);
  });

  it("anchors the 30-day series at today and labels only Mondays", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T12:00:00Z"));

    render(
      <DoraMetricChart
        series={[seriesItem("2026-09-22", 4)]}
        color="#4caf82"
        label="Deployment Frequency trend"
        preset="30d"
        timezone="UTC"
      />,
    );

    const chart = screen.getByRole("img", { name: "Deployment Frequency trend" });
    const plottedPoints = chart.querySelector("polyline")?.getAttribute("points")?.split(" ") ?? [];
    expect(plottedPoints).toHaveLength(31);
    expect(plottedPoints.at(-1)?.split(",")[0]).toBe("350");
    expect(renderedDateLabels(chart)).toEqual(["Aug 31", "Sep 7", "Sep 14", "Sep 21"]);
  });

  it("anchors the 90-day weekly series at today and labels month starts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-23T12:00:00Z"));

    render(
      <DoraMetricChart
        series={[seriesItem("2026-09-21", 4)]}
        color="#4caf82"
        label="Deployment Frequency trend"
        preset="90d"
        timezone="UTC"
      />,
    );

    const chart = screen.getByRole("img", { name: "Deployment Frequency trend" });
    const plottedPoints = chart.querySelector("polyline")?.getAttribute("points")?.split(" ") ?? [];
    expect(plottedPoints).toHaveLength(14);
    expect(plottedPoints.at(-1)?.split(",")[0]).toBe("350");
    expect(renderedDateLabels(chart)).toEqual(["Jul 1", "Aug 1", "Sep 1"]);
  });
});
