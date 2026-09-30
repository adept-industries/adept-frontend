import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../auth/AuthContext.js";
import type { AuthenticatedState } from "../../auth/types.js";
import { renderWithProviders } from "../../test/renderWithProviders.js";
import { server } from "../../test/server.js";
import { CycleTimeSection } from "./CycleTimeSection.js";
import {
  axisMaximum,
  cycleTimeRange,
  formatCycleHours,
  formatPeriodRange,
  periodLabelLines,
} from "./cycleTime.js";
import type { CycleTimeFilters } from "./types.js";

const API = "/api/v1";

function authenticatedState(): AuthenticatedState {
  return {
    status: "authenticated",
    generation: 1,
    user: {
      id: "user-1",
      email: "user@example.com",
      displayName: "Test User",
      emailVerified: true,
      hasPassword: true,
      onboardingComplete: true,
    },
    currentMembership: {
      id: "mem-1",
      workspaceId: "ws-1",
      workspaceName: "Acme",
      workspaceSlug: "acme-abc123",
      timezone: "UTC",
      role: "MANAGER",
    },
    workspaces: [{ id: "ws-1", name: "Acme", slug: "acme-abc123", timezone: "UTC", role: "MANAGER" }],
  };
}

const FILTERS: CycleTimeFilters = {
  projectId: "project-1",
  repositoryId: null,
  from: "2026-08-24T00:00:00Z",
  to: "2026-09-21T00:00:00Z",
  granularity: "WEEK",
};

function stage(name: string, medianHours: number, sampleSize: number) {
  return { stage: name, medianHours, p75Hours: medianHours, sampleSize };
}

const CYCLE_TIME_FIXTURE = {
  workspaceId: "ws-1",
  projectId: "project-1",
  repositoryId: null,
  repositoryCount: 1,
  periodStart: FILTERS.from,
  periodEnd: FILTERS.to,
  timezone: "UTC",
  granularity: "WEEK",
  calculationVersion: "cycle-time-v2",
  calculatedAt: "2026-09-21T08:00:00Z",
  stale: false,
  pullRequestCount: 12,
  unreviewedPullRequestCount: 2,
  bottleneck: "PICKUP",
  stages: [
    stage("CODING", 6, 12),
    stage("PICKUP", 30, 10),
    stage("REVIEW", 0.5, 9),
    stage("DEPLOY", 17, 8),
  ],
  series: [
    {
      periodStart: "2026-09-07T00:00:00Z",
      periodEnd: "2026-09-14T00:00:00Z",
      pullRequestCount: 5,
      bottleneck: "PICKUP",
      stages: [stage("CODING", 8, 5), stage("PICKUP", 44, 5), stage("REVIEW", 4, 4), stage("DEPLOY", 0, 0)],
    },
    {
      periodStart: "2026-09-14T00:00:00Z",
      periodEnd: "2026-09-21T00:00:00Z",
      pullRequestCount: 7,
      // This week's slowest stage differs from the range-wide bottleneck.
      bottleneck: "DEPLOY",
      stages: [stage("CODING", 4, 7), stage("PICKUP", 14, 5), stage("REVIEW", 6, 5), stage("DEPLOY", 17, 8)],
    },
  ],
};

function renderSection() {
  const actions = { logout: vi.fn() } as unknown as AuthContextValue["actions"];
  return renderWithProviders(
    <AuthContext.Provider value={{ state: authenticatedState(), actions }}>
      <CycleTimeSection filters={FILTERS} description="Last 4 weeks" fallbackTimezone="UTC" />
    </AuthContext.Provider>,
  );
}

describe("CycleTimeSection", () => {
  it("requests the scoped cycle time and names the bottleneck", async () => {
    let requested: URL | null = null;
    server.use(http.get(`${API}/metrics/cycle-time`, ({ request }) => {
      requested = new URL(request.url);
      return HttpResponse.json(CYCLE_TIME_FIXTURE);
    }));

    renderSection();

    expect(await screen.findByText("Bottleneck: Pickup")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/^Bottleneck: Pickup· 30 hrs$/);
    expect(requested!.searchParams.get("projectId")).toBe("project-1");
    expect(requested!.searchParams.get("granularity")).toBe("WEEK");
    expect(requested!.searchParams.get("from")).toBe(FILTERS.from);

    const stages = within(screen.getByRole("list", { name: "Stage medians" })).getAllByRole("listitem");
    expect(stages.map((item) => item.querySelector(".cycle-time-stage-label")?.textContent))
      .toEqual(["Coding", "Pickup", "Review", "Deploy"]);
    expect(stages[1]).toHaveClass("cycle-time-stage--bottleneck");
    expect(stages[2]).toHaveTextContent("30 min");
    expect(screen.getByText(/2 of 12 pull requests were\s+merged without a review/)).toBeInTheDocument();
    expect(screen.getByText(/Last 4 weeks \(Aug 24 – Sep 20\), one bar per week\./)).toBeInTheDocument();
  });

  it("marks review stages without reviewed pull requests", async () => {
    server.use(http.get(`${API}/metrics/cycle-time`, () => HttpResponse.json({
      ...CYCLE_TIME_FIXTURE,
      unreviewedPullRequestCount: 12,
      bottleneck: "DEPLOY",
      stages: [stage("CODING", 6, 12), stage("PICKUP", 0, 0), stage("REVIEW", 0, 0), stage("DEPLOY", 17, 8)],
    })));

    renderSection();

    const stages = within(await screen.findByRole("list", { name: "Stage medians" })).getAllByRole("listitem");
    expect(stages[1]).toHaveTextContent("—");
    expect(stages[1]).toHaveTextContent("No reviewed PRs");
    expect(stages[3]).toHaveTextContent("8 PRs");
  });

  it("describes the latest period with merges and its own bottleneck by default", async () => {
    server.use(http.get(`${API}/metrics/cycle-time`, () => HttpResponse.json({
      ...CYCLE_TIME_FIXTURE,
      series: [
        ...CYCLE_TIME_FIXTURE.series,
        {
          periodStart: "2026-09-21T00:00:00Z",
          periodEnd: "2026-09-28T00:00:00Z",
          pullRequestCount: 0,
          stages: [stage("CODING", 0, 0), stage("PICKUP", 0, 0), stage("REVIEW", 0, 0), stage("DEPLOY", 0, 0)],
        },
      ],
    })));

    const { container } = renderSection();

    await screen.findByRole("group", { name: /Select a bar to see its bottleneck/ });
    const detail = container.querySelector(".cycle-time-chart-detail")!;
    expect(detail).toHaveTextContent("Sep 14 – 20 · 7 merged PRs · Bottleneck: Deploy · 17 hrs");
    expect(detail).toHaveTextContent(
      "Coding 4 hrs (7 PRs) · Pickup 14 hrs (5 PRs) · Review 6 hrs (5 PRs) · Deploy 17 hrs (8 PRs)",
    );
    // The range bottleneck above the chart still pools every week.
    expect(screen.getByRole("status")).toHaveTextContent("Bottleneck: Pickup");
  });

  it("marks each period's bottleneck with its stage colour", async () => {
    server.use(http.get(`${API}/metrics/cycle-time`, () => HttpResponse.json(CYCLE_TIME_FIXTURE)));

    const { container } = renderSection();

    await screen.findAllByRole("button", { name: /merged PRs/ });
    const markers = Array.from(container.querySelectorAll(".cycle-time-bottleneck-marker"));
    expect(markers.map((marker) => marker.getAttribute("fill")))
      .toEqual(["var(--cycle-pickup)", "var(--cycle-deploy)"]);
  });

  it("keeps a clicked bar selected and moves with the arrow keys", async () => {
    server.use(http.get(`${API}/metrics/cycle-time`, () => HttpResponse.json(CYCLE_TIME_FIXTURE)));
    const user = userEvent.setup();

    const { container } = renderSection();

    const bars = await screen.findAllByRole("button", { name: /merged PRs/ });
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAccessibleName(/^Sep 7 – 13: 5 merged PRs\. Bottleneck: Pickup · 44 hrs\./);
    const detail = () => container.querySelector(".cycle-time-chart-detail")!;

    await user.click(bars[0]);
    await user.unhover(bars[0]);
    expect(detail()).toHaveTextContent("Sep 7 – 13 · 5 merged PRs · Bottleneck: Pickup · 44 hrs");
    expect(detail()).toHaveTextContent("Deploy —");
    expect(bars[0]).toHaveAttribute("aria-pressed", "true");

    await user.keyboard("{ArrowRight}");
    expect(bars[1]).toHaveFocus();
    expect(detail()).toHaveTextContent("Sep 14 – 20 · 7 merged PRs · Bottleneck: Deploy · 17 hrs");
  });

  it("says when a selected period had no merges", async () => {
    server.use(http.get(`${API}/metrics/cycle-time`, () => HttpResponse.json({
      ...CYCLE_TIME_FIXTURE,
      series: [
        {
          periodStart: "2026-08-31T00:00:00Z",
          periodEnd: "2026-09-07T00:00:00Z",
          pullRequestCount: 0,
          stages: [stage("CODING", 0, 0), stage("PICKUP", 0, 0), stage("REVIEW", 0, 0), stage("DEPLOY", 0, 0)],
        },
        ...CYCLE_TIME_FIXTURE.series,
      ],
    })));
    const user = userEvent.setup();

    const { container } = renderSection();

    const bars = await screen.findAllByRole("button", { name: /merged PRs/ });
    await user.click(bars[0]);
    await user.unhover(bars[0]);
    expect(container.querySelector(".cycle-time-chart-detail"))
      .toHaveTextContent("Aug 31 – Sep 6 · 0 merged PRs · No merged pull requests");
    expect(container.querySelectorAll(".cycle-time-bottleneck-marker")).toHaveLength(2);
  });

  it("cuts an outlier week short and still reports its full times", async () => {
    const week = (start: string, end: string, hours: number, bottleneck: string) => ({
      periodStart: start,
      periodEnd: end,
      pullRequestCount: 1,
      bottleneck,
      stages: ["CODING", "PICKUP", "REVIEW", "DEPLOY"].map((name) =>
        name === bottleneck ? stage(name, hours, 1) : stage(name, 0, name === "CODING" ? 1 : 0)),
    });
    server.use(http.get(`${API}/metrics/cycle-time`, () => HttpResponse.json({
      ...CYCLE_TIME_FIXTURE,
      series: [
        week("2026-08-24T00:00:00Z", "2026-08-31T00:00:00Z", 1, "DEPLOY"),
        week("2026-08-31T00:00:00Z", "2026-09-07T00:00:00Z", 60, "REVIEW"),
        week("2026-09-07T00:00:00Z", "2026-09-14T00:00:00Z", 2, "DEPLOY"),
        week("2026-09-14T00:00:00Z", "2026-09-21T00:00:00Z", 3, "DEPLOY"),
      ],
    })));
    const user = userEvent.setup();

    const { container } = renderSection();

    const bars = await screen.findAllByRole("button", { name: /merged PR/ });
    expect(container.querySelectorAll(".cycle-time-bar-break")).toHaveLength(1);
    // The axis fits the other weeks: 3 hrs × 1.25.
    expect(container.querySelector(".cycle-time-chart-svg")).toHaveTextContent("3.8 hrs");
    await user.click(bars[1]);
    await user.unhover(bars[1]);
    expect(container.querySelector(".cycle-time-chart-detail"))
      .toHaveTextContent("Aug 31 – Sep 6 · 1 merged PR · Bottleneck: Review · 2.5 days");
  });

  it("shows the empty state when nothing was merged", async () => {
    renderSection();

    expect(await screen.findByText("No merged pull requests in this period")).toBeInTheDocument();
  });

  it("explains that cycle time has not been calculated yet", async () => {
    // Before the first recalculation the API omits calculatedAt and bottleneck entirely.
    const notCalculated: Record<string, unknown> = {
      ...CYCLE_TIME_FIXTURE,
      pullRequestCount: 0,
      unreviewedPullRequestCount: 0,
      series: [],
    };
    delete notCalculated.calculatedAt;
    delete notCalculated.bottleneck;
    server.use(http.get(`${API}/metrics/cycle-time`, () => HttpResponse.json(notCalculated)));

    renderSection();

    expect(await screen.findByText("Cycle time is being calculated")).toBeInTheDocument();
    expect(screen.getByText("Cycle time has not been calculated yet")).toBeInTheDocument();
  });

  it("hides the bottleneck line when the API reports none", async () => {
    const withoutBottleneck: Record<string, unknown> = { ...CYCLE_TIME_FIXTURE };
    delete withoutBottleneck.bottleneck;
    server.use(http.get(`${API}/metrics/cycle-time`, () => HttpResponse.json(withoutBottleneck)));

    renderSection();

    expect(await screen.findByRole("list", { name: "Stage medians" })).toBeInTheDocument();
    // Only the range-wide line disappears; each bar still names its own bottleneck.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers a retry when loading fails", async () => {
    server.use(http.get(`${API}/metrics/cycle-time`, () => HttpResponse.json(
      { type: "about:blank", title: "Internal Server Error", status: 500, code: "INTERNAL_ERROR", detail: "Boom" },
      { status: 500, headers: { "Content-Type": "application/problem+json" } },
    )));

    renderSection();

    expect(await screen.findByText("Cycle time could not be loaded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("formatCycleHours", () => {
  it.each([
    [0, "0 min"],
    [0.25, "15 min"],
    [1, "1 hr"],
    [5.56, "5.6 hrs"],
    [47.9, "47.9 hrs"],
    [24, "24 hrs"],
    [48, "2 days"],
    [72, "3 days"],
  ])("formats %s hours as %s", (hours, expected) => {
    expect(formatCycleHours(hours)).toBe(expected);
  });
});

describe("formatPeriodRange", () => {
  const week = (start: string, end: string) => ({ periodStart: start, periodEnd: end });

  it.each([
    // Full weeks show inclusive days, so neighbouring bars never share a date.
    ["within a month", week("2026-08-24T00:00:00Z", "2026-08-31T00:00:00Z"), "Aug 24 – 30"],
    ["across months", week("2026-08-31T00:00:00Z", "2026-09-07T00:00:00Z"), "Aug 31 – Sep 6"],
  ])("labels a full week %s", (_name, period, expected) => {
    expect(formatPeriodRange(period, "2026-08-01T00:00:00Z", "2026-10-01T00:00:00Z", "UTC")).toBe(expected);
  });

  it("clips the first and the current week to the selected range", () => {
    const from = "2026-08-29T17:00:00Z";
    const now = "2026-09-30T10:00:00Z";
    expect(formatPeriodRange(week("2026-08-24T00:00:00Z", "2026-08-31T00:00:00Z"), from, now, "UTC"))
      .toBe("Aug 29 – 30");
    expect(formatPeriodRange(week("2026-09-28T00:00:00Z", "2026-10-05T00:00:00Z"), from, now, "UTC"))
      .toBe("Sep 28 – 30");
  });

  it("shows one date for a single day or a week that has only just started", () => {
    expect(formatPeriodRange(
      week("2026-09-28T00:00:00Z", "2026-10-05T00:00:00Z"),
      "2026-08-29T00:00:00Z",
      "2026-09-28T06:00:00Z",
      "UTC",
    )).toBe("Sep 28");
  });

  it("uses the workspace timezone for the covered dates", () => {
    // Monday 00:00 in Colombo is 18:30 UTC on the Sunday before.
    expect(formatPeriodRange(
      week("2026-08-30T18:30:00Z", "2026-09-06T18:30:00Z"),
      "2026-08-01T00:00:00Z",
      "2026-10-01T00:00:00Z",
      "Asia/Colombo",
    )).toBe("Aug 31 – Sep 6");
  });
});

describe("cycleTimeRange", () => {
  // Wednesday 2026-09-30, 10:00 UTC.
  const now = new Date("2026-09-30T10:00:00Z");

  it.each([
    ["7d", "DAY", 7, "2026-09-24T00:00:00.000Z", "Last 7 days"],
    ["30d", "WEEK", 4, "2026-09-07T00:00:00.000Z", "Last 4 weeks"],
    ["90d", "WEEK", 12, "2026-07-13T00:00:00.000Z", "Last 12 weeks"],
  ] as const)("covers whole periods for %s", (window, granularity, periods, from, description) => {
    expect(cycleTimeRange(window, "UTC", "2026-09-30", now)).toEqual({
      from,
      to: now.toISOString(),
      granularity,
      periods,
      description,
    });
  });

  it.each([
    ["Monday", "2026-09-28"],
    ["Sunday", "2026-10-04"],
  ])("counts the current week as one of the weeks on a %s", (_day, today) => {
    expect(cycleTimeRange("30d", "UTC", today, now).from).toBe("2026-09-07T00:00:00.000Z");
  });

  it("starts at midnight in the workspace timezone", () => {
    // Midnight in Colombo is 18:30 UTC the day before.
    expect(cycleTimeRange("7d", "Asia/Colombo", "2026-09-30", now).from).toBe("2026-09-23T18:30:00.000Z");
  });

  it("keeps local midnight across a daylight-saving change", () => {
    // New York leaves daylight time on 2026-11-01; Oct 28 is still UTC-4.
    expect(cycleTimeRange("7d", "America/New_York", "2026-11-03", now).from).toBe("2026-10-28T04:00:00.000Z");
  });
});

describe("periodLabelLines", () => {
  const range = ["2026-08-01T00:00:00Z", "2026-09-30T10:00:00Z"] as const;

  it("splits a week over two short lines", () => {
    expect(periodLabelLines(
      { periodStart: "2026-08-31T00:00:00Z", periodEnd: "2026-09-07T00:00:00Z" }, ...range, "UTC", "WEEK",
    )).toEqual(["Aug 31", "– Sep 6"]);
  });

  it("ends the current week today", () => {
    expect(periodLabelLines(
      { periodStart: "2026-09-28T00:00:00Z", periodEnd: "2026-10-05T00:00:00Z" }, ...range, "UTC", "WEEK",
    )).toEqual(["Sep 28", "– 30"]);
  });

  it("names the weekday for a day", () => {
    expect(periodLabelLines(
      { periodStart: "2026-09-28T00:00:00Z", periodEnd: "2026-09-29T00:00:00Z" }, ...range, "UTC", "DAY",
    )).toEqual(["Mon", "Sep 28"]);
  });
});

describe("axisMaximum", () => {
  it("fits the axis to the tallest bar", () => {
    expect(axisMaximum([0, 4, 3, 2, 1])).toBe(4);
  });

  it("clips one outlier among at least four bars", () => {
    expect(axisMaximum([0, 540, 3, 60, 10, 5])).toBe(75);
  });

  it("never clips when fewer than four bars have data", () => {
    expect(axisMaximum([11, 3, 0, 0])).toBe(11);
  });
});
