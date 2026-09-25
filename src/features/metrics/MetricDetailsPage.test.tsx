import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../auth/AuthContext.js";
import { ProjectContext, type ProjectContextValue } from "../projects/ProjectContext.js";
import type { AuthenticatedState } from "../../auth/types.js";
import { renderWithProviders } from "../../test/renderWithProviders.js";
import { server } from "../../test/server.js";
import { MetricDetailsPage } from "./MetricDetailsPage.js";

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

const mockProjectContext: ProjectContextValue = {
  projects: [],
  selectedProject: null,
  loading: false,
  error: null,
  select: () => undefined,
  reload: () => Promise.resolve(),
};

function renderPage(initialRoute = "/dashboard/metrics/details") {
  const state = authenticatedState();
  const actions = { logout: vi.fn() } as unknown as AuthContextValue["actions"];

  return renderWithProviders(
    <AuthContext.Provider value={{ state, actions }}>
      <ProjectContext.Provider value={mockProjectContext}>
        <MetricDetailsPage />
      </ProjectContext.Provider>
    </AuthContext.Provider>,
    { initialPath: initialRoute },
  );
}

const DETAILS_FIXTURE = {
  workspaceId: "ws-1",
  projectId: null,
  repositoryId: null,
  repositoryCount: 1,
  rangeStart: "2026-08-01T00:00:00Z",
  rangeEnd: "2026-08-31T00:00:00Z",
  timezone: "UTC",
  page: 0,
  size: 20,
  totalElements: 2,
  totalPages: 1,
  items: [
    {
      id: "dep-1",
      repositoryId: "repo-1",
      repositoryName: "core-service",
      repositoryFullName: "acme/core-service",
      deployedAt: "2026-08-20T14:30:00Z",
      environment: "production",
      source: "GITHUB_DEPLOYMENT",
      commitSha: "a1b2c3d4e5f67890",
      durationSeconds: 145,
    },
    {
      id: "dep-2",
      repositoryId: "repo-1",
      repositoryName: "core-service",
      repositoryFullName: "acme/core-service",
      deployedAt: "2026-08-22T10:15:00Z",
      environment: "production",
      source: "GITHUB_WORKFLOW",
      commitSha: "9876543210fedcba",
      durationSeconds: null,
    },
  ],
};

describe("MetricDetailsPage", () => {
  it("renders deployment frequency details table with events and formatted columns", async () => {
    server.use(
      http.get(`${API}/metrics/deployment-frequency/details`, () =>
        HttpResponse.json(DETAILS_FIXTURE),
      ),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText("acme/core-service")).toHaveLength(2);
    });

    expect(screen.getByText("Deployment Frequency Details")).toBeInTheDocument();
    expect(screen.getByText("GitHub Deployment")).toBeInTheDocument();
    expect(screen.getByText("GitHub Workflow")).toBeInTheDocument();
    expect(screen.getByText("a1b2c3d")).toBeInTheDocument();
    const commitLink = screen.getByRole("link", { name: /a1b2c3d/i });
    expect(commitLink).toHaveAttribute(
      "href",
      "https://github.com/acme/core-service/commit/a1b2c3d4e5f67890",
    );
    expect(commitLink).toHaveAttribute("target", "_blank");
    expect(commitLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("2m 25s")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–2 of 2 deployments")).toBeInTheDocument();
  });

  it("renders empty state when no deployments exist in range", async () => {
    server.use(
      http.get(`${API}/metrics/deployment-frequency/details`, () =>
        HttpResponse.json({
          ...DETAILS_FIXTURE,
          totalElements: 0,
          totalPages: 0,
          items: [],
        }),
      ),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No successful production deployments")).toBeInTheDocument();
    });
  });

  it("switches to Change Lead Time tab and renders CLT table", async () => {
    const user = userEvent.setup();
    const CLT_FIXTURE = {
      workspaceId: "ws-1",
      projectId: null,
      repositoryId: null,
      repositoryCount: 1,
      rangeStart: "2026-08-01T00:00:00Z",
      rangeEnd: "2026-08-31T00:00:00Z",
      timezone: "UTC",
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      items: [
        {
          prId: "pr-1",
          prNumber: 142,
          prTitle: "Add search index caching",
          prUrl: "https://github.com/acme/engine/pull/142",
          authorLogin: "rangaNP",
          repositoryId: "repo-1",
          repositoryName: "engine",
          repositoryOwnerLogin: "acme",
          repositoryFullName: "acme/engine",
          firstCommitAt: "2026-09-20T14:15:00Z",
          openedAt: "2026-09-20T16:00:00Z",
          mergedAt: "2026-09-21T09:30:00Z",
          deployedAt: "2026-09-21T09:42:00Z",
          leadTimeSeconds: 70020,
          codingTimeSeconds: 6300,
          reviewTimeSeconds: 63000,
          deployTimeSeconds: 720,
          deploymentEnvironment: "production",
          deploymentCommitSha: "abc1234",
        },
      ],
    };

    server.use(
      http.get(`${API}/metrics/deployment-frequency/details`, () =>
        HttpResponse.json({ ...DETAILS_FIXTURE, items: [], totalElements: 0, totalPages: 0 }),
      ),
      http.get(`${API}/metrics/change-lead-time/details`, () =>
        HttpResponse.json(CLT_FIXTURE),
      ),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Deployment Frequency Details")).toBeInTheDocument();
    });

    const leadTimeTab = screen.getByRole("tab", { name: "Change Lead Time" });
    await user.click(leadTimeTab);

    expect(screen.getByText("Change Lead Time Details")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("acme/engine")).toBeInTheDocument();
    });

    expect(screen.getByText("rangaNP")).toBeInTheDocument();
    // PR link
    const prLink = screen.getByRole("link", { name: /142.*Add search index caching/i });
    expect(prLink).toHaveAttribute("href", "https://github.com/acme/engine/pull/142");
    expect(prLink).toHaveAttribute("target", "_blank");
    // Lead time cell should show formatted duration
    expect(screen.getByText(/19h 27m/i)).toBeInTheDocument();
    // Pagination
    expect(screen.getByText(/Showing 1.*of 1 pull requests/i)).toBeInTheDocument();
  });

  it("switches to Recovery Time tab and renders upcoming PR placeholder", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API}/metrics/deployment-frequency/details`, () =>
        HttpResponse.json(DETAILS_FIXTURE),
      ),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Deployment Frequency Details")).toBeInTheDocument();
    });

    const recoveryTab = screen.getByRole("tab", { name: "Recovery Time" });
    await user.click(recoveryTab);

    expect(screen.getByText("Recovery Time Details")).toBeInTheDocument();
    expect(screen.getByText("Recovery Time drill-down coming soon")).toBeInTheDocument();

    const switchBtn = screen.getByRole("button", { name: "Switch to Deployment Frequency" });
    await user.click(switchBtn);

    expect(screen.getByText("Deployment Frequency Details")).toBeInTheDocument();
  });

  it("provides back link navigation to /dashboard", async () => {
    server.use(
      http.get(`${API}/metrics/deployment-frequency/details`, () =>
        HttpResponse.json(DETAILS_FIXTURE),
      ),
    );

    renderPage();

    const backLink = screen.getByRole("link", { name: /Back to Dashboard/i });
    expect(backLink).toHaveAttribute("href", "/dashboard");
  });

  it("renders metric trend chart with summary data", async () => {
    server.use(
      http.get(`${API}/metrics/deployment-frequency/details`, () =>
        HttpResponse.json(DETAILS_FIXTURE),
      ),
      http.get(`${API}/metrics/summary`, () =>
        HttpResponse.json({
          workspaceId: "ws-1",
          projectId: null,
          repositoryId: null,
          repositoryCount: 1,
          periodStart: "2026-08-01T00:00:00Z",
          periodEnd: "2026-08-31T00:00:00Z",
          timezone: "UTC",
          calculationVersion: "dora-v3",
          deploymentFrequency: {
            value: 4.5,
            unit: "deployments/week",
            sampleSize: 18,
            rating: "HIGH",
            dimensions: { total_deployments: 18, period_days: 30 },
          },
          changeLeadTime: { value: 0, unit: "hours", sampleSize: 0, rating: "UNKNOWN", dimensions: {} },
          recoveryTime: { value: 0, unit: "hours", sampleSize: 0, rating: "UNKNOWN", dimensions: {} },
          changeFailureRate: { value: 0, unit: "percent", sampleSize: 0, rating: "UNKNOWN", dimensions: {} },
          calculatedAt: "2026-08-23T12:00:00Z",
          stale: false,
        }),
      ),
      http.get(`${API}/metrics/series`, () =>
        HttpResponse.json({
          workspaceId: "ws-1",
          projectId: null,
          repositoryId: null,
          from: "2026-08-01T00:00:00Z",
          to: "2026-08-31T00:00:00Z",
          timezone: "UTC",
          series: [
            {
              metricType: "DEPLOYMENT_FREQUENCY",
              periodStart: "2026-08-20T00:00:00Z",
              value: 3,
              unit: "deployments/week",
              sampleSize: 3,
              dimensions: {},
            },
          ],
        }),
      ),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("High")).toBeInTheDocument();
    });
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("deployments/week")).toBeInTheDocument();
    expect(screen.getByText(/18 samples in range/i)).toBeInTheDocument();
  });
});
