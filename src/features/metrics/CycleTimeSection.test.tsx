import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../auth/AuthContext.js";
import type { AuthenticatedState } from "../../auth/types.js";
import { renderWithProviders } from "../../test/renderWithProviders.js";
import { server } from "../../test/server.js";
import { CycleTimeSection } from "./CycleTimeSection.js";
import { formatCycleHours } from "./cycleTime.js";
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
      stages: [stage("CODING", 8, 5), stage("PICKUP", 44, 5), stage("REVIEW", 4, 4), stage("DEPLOY", 0, 0)],
    },
    {
      periodStart: "2026-09-14T00:00:00Z",
      periodEnd: "2026-09-21T00:00:00Z",
      pullRequestCount: 7,
      stages: [stage("CODING", 4, 7), stage("PICKUP", 14, 5), stage("REVIEW", 6, 5), stage("DEPLOY", 17, 8)],
    },
  ],
  sizeBreakdown: [
    { size: "S", pullRequestCount: 7, reviewedPullRequestCount: 6, mergeMedianHours: 12 },
    { size: "M", pullRequestCount: 4, reviewedPullRequestCount: 3, mergeMedianHours: 40 },
    { size: "L", pullRequestCount: 1, reviewedPullRequestCount: 1, mergeMedianHours: 70 },
    // The API omits null fields, so an empty bucket has no mergeMedianHours at all.
    { size: "XL", pullRequestCount: 0, reviewedPullRequestCount: 0 },
  ],
};

function renderSection() {
  const actions = { logout: vi.fn() } as unknown as AuthContextValue["actions"];
  return renderWithProviders(
    <AuthContext.Provider value={{ state: authenticatedState(), actions }}>
      <CycleTimeSection filters={FILTERS} fallbackTimezone="UTC" />
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
    expect(screen.getByRole("status")).toHaveTextContent(/^Bottleneck: Pickup· 30h$/);
    expect(requested!.searchParams.get("projectId")).toBe("project-1");
    expect(requested!.searchParams.get("granularity")).toBe("WEEK");
    expect(requested!.searchParams.get("from")).toBe(FILTERS.from);

    const stages = within(screen.getByRole("list", { name: "Stage medians" })).getAllByRole("listitem");
    expect(stages.map((item) => item.querySelector(".cycle-time-stage-label")?.textContent))
      .toEqual(["Coding", "Pickup", "Review", "Deploy"]);
    expect(stages[1]).toHaveClass("cycle-time-stage--bottleneck");
    expect(stages[2]).toHaveTextContent("30m");
    expect(screen.getByText(/2 of 12 pull requests were\s+merged without a review/)).toBeInTheDocument();
  });

  it("shows how pull request size affects review coverage and time to merge", async () => {
    server.use(http.get(`${API}/metrics/cycle-time`, () => HttpResponse.json(CYCLE_TIME_FIXTURE)));

    renderSection();

    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      "S76 of 712h",
      "M43 of 440h",
      "L11 of 12.9d",
      "XL0——",
    ]);
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

  it("describes the latest period with merges until a bar is hovered", async () => {
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

    renderSection();

    expect(await screen.findByText("Sep 14 · 7 merged PRs · Coding 4h · Pickup 14h · Review 6h · Deploy 17h"))
      .toBeInTheDocument();
  });

  it("describes a bar's stages when it receives focus", async () => {
    server.use(http.get(`${API}/metrics/cycle-time`, () => HttpResponse.json(CYCLE_TIME_FIXTURE)));
    const user = userEvent.setup();

    renderSection();

    const bars = await screen.findAllByRole("img", { name: /merged pull requests/ });
    expect(bars).toHaveLength(2);
    await user.tab();
    expect(screen.getByText("Sep 7 · 5 merged PRs · Coding 8h · Pickup 44h · Review 4h · Deploy —"))
      .toBeInTheDocument();
  });

  it("shows the empty state when nothing was merged", async () => {
    renderSection();

    expect(await screen.findByText("No merged pull requests in this period")).toBeInTheDocument();
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
    [0, "0h"],
    [0.25, "15m"],
    [5.56, "5.6h"],
    [47.9, "47.9h"],
    [72, "3d"],
  ])("formats %s hours as %s", (hours, expected) => {
    expect(formatCycleHours(hours)).toBe(expected);
  });
});
