import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../auth/AuthContext.js";
import type { AuthenticatedState } from "../../auth/types.js";
import { renderWithProviders } from "../../test/renderWithProviders.js";
import { server } from "../../test/server.js";
import { DoraMetricsSection } from "./DoraMetricsSection.js";

const API = "/api/v1";

// ── Test helpers ──────────────────────────────────────────────────────────

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

function renderSection(props: { selectedProjectId?: string | null } = {}) {
  const state = authenticatedState();
  const actions = { logout: vi.fn() } as unknown as AuthContextValue["actions"];

  return renderWithProviders(
    <AuthContext.Provider value={{ state, actions }}>
      <DoraMetricsSection {...props} />
    </AuthContext.Provider>,
  );
}

// ── Fixtures ──────────────────────────────────────────────────────────────

const SUMMARY_FIXTURE = {
  workspaceId: "ws-1",
  projectId: null,
  repositoryId: null,
  repositoryCount: 2,
  periodStart: "2026-07-24T00:00:00Z",
  periodEnd: "2026-08-23T00:00:00Z",
  timezone: "UTC",
  calculationVersion: "dora-v2",
  deploymentFrequency: {
    value: 4.5,
    unit: "deployments/week",
    sampleSize: 18,
    rating: "HIGH",
    dimensions: { total_deployments: 18, period_days: 30 },
  },
  changeLeadTime: {
    value: 2.4,
    unit: "hours",
    sampleSize: 14,
    rating: "HIGH",
    dimensions: { p50: 2.4, mean: 3.1, p75: 4.2, p90: 5.8 },
  },
  recoveryTime: {
    value: 0.8,
    unit: "hours",
    sampleSize: 2,
    rating: "ELITE",
    dimensions: { p50: 0.8 },
  },
  changeFailureRate: {
    value: 5.26,
    unit: "percent",
    sampleSize: 19,
    rating: "HIGH",
    dimensions: { total_deployments: 19, failed_deployments: 1 },
  },
  calculatedAt: "2026-08-23T12:00:00Z",
  stale: false,
};

const EMPTY_SUMMARY_FIXTURE = {
  ...SUMMARY_FIXTURE,
  deploymentFrequency: { ...SUMMARY_FIXTURE.deploymentFrequency, sampleSize: 0, value: 0 },
  changeLeadTime:      { ...SUMMARY_FIXTURE.changeLeadTime,      sampleSize: 0, value: 0 },
  recoveryTime:        { ...SUMMARY_FIXTURE.recoveryTime,        sampleSize: 0, value: 0 },
  changeFailureRate:   { ...SUMMARY_FIXTURE.changeFailureRate,   sampleSize: 0, value: 0 },
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe("DoraMetricsSection", () => {
  it("renders 4 skeleton cards while loading", () => {
    // Make the summary endpoint hang so we stay in loading state
    server.use(
      http.get(`${API}/metrics/summary`, () => new Promise(() => {/* never resolves */})),
      http.get(`${API}/metrics/series`,  () => new Promise(() => {/* never resolves */})),
    );

    renderSection();

    const skeletons = screen.getAllByRole("generic", { busy: true });
    // The section renders 4 aria-busy skeleton cards
    expect(skeletons.length).toBe(4);
  });

  it("renders all 4 DORA metric cards with values and rating badges", async () => {
    renderSection();

    // Deployment Frequency
    await waitFor(() => expect(screen.getByText("Deployment Frequency")).toBeInTheDocument());
    expect(screen.getByText("4.5")).toBeInTheDocument();
    // Change Lead Time
    expect(screen.getByText("Change Lead Time")).toBeInTheDocument();
    expect(screen.getByText("2.4h")).toBeInTheDocument();
    // Recovery Time
    expect(screen.getByText("Recovery Time")).toBeInTheDocument();
    expect(screen.getByText("0.8h")).toBeInTheDocument();
    // Change Failure Rate
    expect(screen.getByText("Change Failure Rate")).toBeInTheDocument();
    expect(screen.getByText("5.3%")).toBeInTheDocument();
    expect(screen.getByLabelText("Metric calculation status")).toHaveTextContent("dora-v2");
  });

  it("renders an API failure separately from an empty dataset", async () => {
    server.use(
      http.get(`${API}/metrics/summary`, () => HttpResponse.json({}, { status: 503 })),
      http.get(`${API}/metrics/series`, () => HttpResponse.json({}, { status: 503 })),
    );

    renderSection();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("DORA metrics could not be loaded"),
    );
    expect(screen.queryByText("No deployments recorded in this period")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders correct rating badges", async () => {
    renderSection();

    await waitFor(() => expect(screen.getByText("Deployment Frequency")).toBeInTheDocument());

    const highBadges = screen.getAllByText("High");
    expect(highBadges.length).toBeGreaterThanOrEqual(2); // DF, CLT, CFR

    const eliteBadge = screen.getByText("Elite");
    expect(eliteBadge).toBeInTheDocument();
  });

  it("shows empty state when all sampleSizes are 0", async () => {
    server.use(
      http.get(`${API}/metrics/summary`, () => HttpResponse.json(EMPTY_SUMMARY_FIXTURE)),
    );

    renderSection();

    await waitFor(() =>
      expect(screen.getByText("No deployments recorded in this period")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Deployment Frequency")).not.toBeInTheDocument();
  });

  it("shows Change Lead Time percentile breakdown when expanded", async () => {
    renderSection();
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText("Change Lead Time")).toBeInTheDocument());

    // Find the percentile toggle button within the lead time card
    const leadTimeCard = screen.getByLabelText("Change Lead Time trend").closest("[id='dora-card-clt']")
      ?? screen.getByText("Show percentiles").closest(".dora-card")!;
    const toggleBtn = within(leadTimeCard as HTMLElement).getByText("Show percentiles");
    await user.click(toggleBtn);

    expect(screen.getByText("P50")).toBeInTheDocument();
    expect(screen.getByText("P75")).toBeInTheDocument();
    expect(screen.getByText("P90")).toBeInTheDocument();
    expect(screen.getByText("Mean")).toBeInTheDocument();
  });

  it("shows Change Failure Rate failed/total breakdown", async () => {
    renderSection();

    await waitFor(() => expect(screen.getByText("Change Failure Rate")).toBeInTheDocument());

    expect(screen.getByText("1 failed")).toBeInTheDocument();
    expect(screen.getByText("19 total")).toBeInTheDocument();
  });

  it("changes time range filter on button click", async () => {
    const summaryRequests: Request[] = [];
    server.use(
      http.get(`${API}/metrics/summary`, ({ request }) => {
        summaryRequests.push(request);
        return HttpResponse.json(SUMMARY_FIXTURE);
      }),
    );

    renderSection();
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText("Deployment Frequency")).toBeInTheDocument());

    const btn7d = screen.getByRole("button", { name: "Last 7 Days" });
    await user.click(btn7d);

    // Button should now be active
    expect(btn7d).toHaveAttribute("aria-pressed", "true");

    // A second request should have fired with a shorter from/to range
    await waitFor(() => expect(summaryRequests.length).toBeGreaterThanOrEqual(2));
    const lastUrl = new URL(summaryRequests[summaryRequests.length - 1].url);
    const from = new Date(lastUrl.searchParams.get("from")!);
    const to   = new Date(lastUrl.searchParams.get("to")!);
    const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeLessThanOrEqual(8);
  });

  it("passes projectId filter when a project is selected", async () => {
    const capturedUrls: string[] = [];
    server.use(
      http.get(`${API}/metrics/summary`, ({ request }) => {
        capturedUrls.push(request.url);
        return HttpResponse.json(SUMMARY_FIXTURE);
      }),
      http.get(`${API}/metrics/series`, () =>
        HttpResponse.json({ workspaceId: "ws-1", projectId: null, repositoryId: null, repositoryCount: 1, granularity: "DAY", series: [] }),
      ),
    );

    renderSection({ selectedProjectId: "proj-123" });

    await waitFor(() => expect(capturedUrls.length).toBeGreaterThan(0));
    const url = new URL(capturedUrls[capturedUrls.length - 1]);
    expect(url.searchParams.get("projectId")).toBe("proj-123");
  });

});
