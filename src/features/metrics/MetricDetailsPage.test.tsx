import { screen, waitFor, within } from "@testing-library/react";
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

const RECOVERY_FIXTURE = {
  workspaceId: "ws-1",
  projectId: null,
  repositoryId: null,
  repositoryCount: 1,
  rangeStart: "2026-09-01T00:00:00Z",
  rangeEnd: "2026-09-08T00:00:00Z",
  timezone: "UTC",
  page: 0,
  size: 20,
  totalElements: 2,
  totalPages: 1,
  items: [
    {
      incidentId: "inc-1",
      title: "Checkout returns 500s",
      source: "GITHUB",
      severity: "SEV1",
      repositoryId: "repo-1",
      repositoryName: "engine",
      repositoryFullName: "acme/engine",
      detectedAt: "2026-09-02T10:00:00Z",
      resolvedAt: "2026-09-02T12:30:00Z",
      recoveryDurationSeconds: 9000,
      failedDeployment: {
        id: "dep-fail",
        commitSha: "bad0001ffffffff",
        environment: "production",
        finishedAt: "2026-09-02T09:58:00Z",
      },
      recoveryDeployment: {
        id: "dep-fix",
        commitSha: "good002eeeeeeee",
        environment: "production",
        finishedAt: "2026-09-02T12:30:00Z",
      },
    },
    {
      incidentId: "inc-2",
      title: "Queue backlog",
      source: "MANUAL",
      severity: "UNKNOWN",
      repositoryId: "repo-1",
      repositoryName: "engine",
      repositoryFullName: "acme/engine",
      detectedAt: "2026-09-05T08:00:00Z",
      resolvedAt: "2026-09-05T08:45:00Z",
      recoveryDurationSeconds: 2700,
      failedDeployment: null,
      recoveryDeployment: null,
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

  it("switches to Change Failure Rate tab and renders upcoming PR placeholder", async () => {
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

    const cfrTab = screen.getByRole("tab", { name: "Change Failure Rate" });
    await user.click(cfrTab);

    expect(screen.getByText("Change Failure Rate Details")).toBeInTheDocument();
    expect(screen.getByText("Change Failure Rate drill-down coming soon")).toBeInTheDocument();

    const switchBtn = screen.getByRole("button", { name: "Switch to Deployment Frequency" });
    await user.click(switchBtn);

    expect(screen.getByText("Deployment Frequency Details")).toBeInTheDocument();
  });

  it("renders resolved incidents on the Recovery Time tab with correlated deployments", async () => {
    const requests: URL[] = [];
    server.use(
      http.get(`${API}/metrics/recovery-time/details`, ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json(RECOVERY_FIXTURE);
      }),
    );

    renderPage("/dashboard/metrics/details?metric=FAILED_DEPLOYMENT_RECOVERY_TIME_HOURS&projectId=proj-1&preset=7d");

    expect(screen.getByText("Recovery Time Details")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Checkout returns 500s")).toBeInTheDocument();
    });

    const table = screen.getByRole("table", { name: /Resolved incidents/i });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(3);

    const linkedRow = rows[1];
    expect(within(linkedRow).getByText("GitHub")).toBeInTheDocument();
    expect(within(linkedRow).getByText("SEV1")).toBeInTheDocument();
    expect(within(linkedRow).getByText("acme/engine")).toBeInTheDocument();
    expect(within(linkedRow).getByText("2h 30m")).toBeInTheDocument();
    expect(within(linkedRow).getByRole("link", { name: /bad0001/ })).toHaveAttribute(
      "href",
      "https://github.com/acme/engine/commit/bad0001ffffffff",
    );
    expect(within(linkedRow).getByRole("link", { name: /good002/ })).toHaveAttribute(
      "href",
      "https://github.com/acme/engine/commit/good002eeeeeeee",
    );

    const manualRow = rows[2];
    expect(within(manualRow).getByText("Manual")).toBeInTheDocument();
    expect(within(manualRow).getByText("Unknown")).toBeInTheDocument();
    expect(within(manualRow).getByText("45m")).toBeInTheDocument();
    expect(within(manualRow).queryByRole("link")).not.toBeInTheDocument();

    expect(screen.getByText(/Showing 1.*of 2 incidents/i)).toBeInTheDocument();

    const lastRequest = requests.at(-1)!;
    expect(lastRequest.searchParams.get("projectId")).toBe("proj-1");
    expect(lastRequest.searchParams.get("page")).toBe("0");
    expect(lastRequest.searchParams.get("size")).toBe("20");
    expect(lastRequest.searchParams.get("from")).toBeTruthy();
    expect(lastRequest.searchParams.get("to")).toBeTruthy();
  });

  it("explains that open incidents are excluded from recovery time", async () => {
    server.use(
      http.get(`${API}/metrics/recovery-time/details`, () =>
        HttpResponse.json({ ...RECOVERY_FIXTURE, items: [], totalElements: 0, totalPages: 0 }),
      ),
    );

    renderPage("/dashboard/metrics/details?metric=FAILED_DEPLOYMENT_RECOVERY_TIME_HOURS");

    const notice = screen.getByRole("note");
    expect(notice).toHaveTextContent(/Only resolved incidents are counted/i);
    expect(notice).toHaveTextContent(/Open incidents are excluded/i);
    expect(within(notice).getByRole("link", { name: "Alerts" })).toHaveAttribute(
      "href",
      "/dashboard/alerts",
    );

    await waitFor(() => {
      expect(screen.getByText("No resolved incidents")).toBeInTheDocument();
    });
  });

  it("requests the next page of resolved incidents", async () => {
    const user = userEvent.setup();
    const pages: string[] = [];
    server.use(
      http.get(`${API}/metrics/recovery-time/details`, ({ request }) => {
        const page = new URL(request.url).searchParams.get("page") ?? "0";
        pages.push(page);
        return HttpResponse.json({
          ...RECOVERY_FIXTURE,
          page: Number(page),
          totalElements: 42,
          totalPages: 3,
        });
      }),
    );

    renderPage("/dashboard/metrics/details?metric=FAILED_DEPLOYMENT_RECOVERY_TIME_HOURS");

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    });
    expect(pages).toContain("1");
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
