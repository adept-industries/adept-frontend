import { fireEvent, render, screen } from "@testing-library/react";
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

function failureRateItem(periodStart: string, failedDeployments: number, totalDeployments: number): MetricSeriesItemDto {
  return {
    ...seriesItem(periodStart, totalDeployments > 0 ? (failedDeployments / totalDeployments) * 100 : 0),
    metricType: "CHANGE_FAILURE_RATE_PERCENT",
    unit: "percent",
    sampleSize: totalDeployments,
    dimensions: {
      failed_deployments: failedDeployments,
      total_deployments: totalDeployments,
    },
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
    expect(chart).toHaveAttribute("preserveAspectRatio", "xMidYMid meet");
    const plottedPoints = chart.querySelector("polyline")?.getAttribute("points")?.split(" ") ?? [];
    const weekdayLabels = Array.from(chart.querySelectorAll('text[y="95"]')).map((node) => node.textContent);
    const yAxisValues = Array.from(chart.querySelectorAll('text[x="27"]')).map((node) => node.textContent);
    expect(plottedPoints).toHaveLength(8);
    expect(plottedPoints.at(-1)?.split(",")[0]).toBe("350");
    expect(weekdayLabels).toEqual(["W", "T", "F", "S", "S", "M", "T", "W"]);
    expect(yAxisValues).toEqual(["4/d", "2/d", "0/d"]);
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
    expect(Array.from(chart.querySelectorAll('text[x="27"]')).map((node) => node.textContent)).toEqual(["4/d", "2/d", "0/d"]);
    expect(chart.querySelectorAll('line[stroke-dasharray="3 3"]')).toHaveLength(4);
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
    expect(chart.querySelectorAll('line[stroke-dasharray="3 3"]')).toHaveLength(3);
  });

  it("shows the value and date for the hovered x-axis position", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T12:00:00Z"));

    render(
      <DoraMetricChart
        series={[seriesItem("2026-09-22", 4)]}
        color="#4caf82"
        label="Deployment Frequency trend"
        preset="7d"
        timezone="UTC"
      />,
    );

    const chart = screen.getByRole("img", { name: "Deployment Frequency trend" });
    vi.spyOn(chart, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 360,
      bottom: 100,
      width: 360,
      height: 100,
      toJSON: () => ({}),
    });
    fireEvent.pointerMove(screen.getByTestId("chart-hover-area"), { clientX: 350, clientY: 50 });

    expect(screen.getByRole("tooltip")).toHaveTextContent("Sep 22 · 4/d");
    expect(screen.getByRole("tooltip")).toHaveClass("dora-chart-tooltip");
  });

  it("shows 30-day deployment frequency axis and hover values per day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T12:00:00Z"));

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
    vi.spyOn(chart, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 360,
      bottom: 100,
      width: 360,
      height: 100,
      toJSON: () => ({}),
    });
    fireEvent.pointerMove(screen.getByTestId("chart-hover-area"), { clientX: 350, clientY: 50 });

    expect(screen.getByRole("tooltip")).toHaveTextContent("Sep 22 · 4/d");
    expect(Array.from(chart.querySelectorAll('text[x="27"]')).map((node) => node.textContent)).toEqual(["4/d", "2/d", "0/d"]);
  });

  it.each([
    { preset: "7d" as const, date: "2026-09-22", today: "2026-09-22T12:00:00Z", failed: 1, total: 8, expectedDate: "Sep 22", axis: ["2", "1", "0"] },
    { preset: "30d" as const, date: "2026-09-22", today: "2026-09-22T12:00:00Z", failed: 2, total: 11, expectedDate: "Sep 22", axis: ["2", "1", "0"] },
    { preset: "90d" as const, date: "2026-09-21", today: "2026-09-23T12:00:00Z", failed: 3, total: 20, expectedDate: "Sep 23", axis: ["4", "2", "0"] },
  ])("charts failure counts and totals for the selected range", ({ preset, date, today, failed, total, expectedDate, axis }) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(today));

    render(
      <DoraMetricChart
        series={[failureRateItem(date, failed, total)]}
        color="#4caf82"
        label="Change Failure Rate trend"
        preset={preset}
        timezone="UTC"
        unit="percent"
      />,
    );

    const chart = screen.getByRole("img", { name: "Change Failure Rate trend" });
    vi.spyOn(chart, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 360,
      bottom: 100,
      width: 360,
      height: 100,
      toJSON: () => ({}),
    });
    fireEvent.pointerMove(screen.getByTestId("chart-hover-area"), { clientX: 350, clientY: 50 });

    expect(Array.from(chart.querySelectorAll('text[x="27"]')).map((node) => node.textContent)).toEqual(axis);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      expectedDate + " · " + failed + " failed / " + total + " deployments",
    );
  });

  it("renders with compact dimensions and smaller tooltip in details variant", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T12:00:00Z"));

    render(
      <DoraMetricChart
        series={[seriesItem("2026-09-22", 4)]}
        color="#4caf82"
        label="Deployment Frequency trend"
        preset="7d"
        timezone="UTC"
        variant="details"
      />,
    );

    const chart = screen.getByRole("img", { name: "Deployment Frequency trend" });
    expect(chart).toHaveAttribute("viewBox", "0 0 720 130");
    expect(chart).toHaveClass("dora-chart-svg--details");

    vi.spyOn(chart, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 720,
      bottom: 130,
      width: 720,
      height: 130,
      toJSON: () => ({}),
    });
    fireEvent.pointerMove(screen.getByTestId("chart-hover-area"), { clientX: 700, clientY: 50 });

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Sep 22 · 4/d");
    const rect = tooltip.querySelector("rect");
    expect(rect).toHaveAttribute("rx", "2.5");
    expect(Number(rect?.getAttribute("height"))).toBeLessThanOrEqual(14);
  });
});
