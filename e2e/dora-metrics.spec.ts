import { expect, test, type Page } from "@playwright/test";

const WORKSPACE_ID = "30000000-0000-4000-8000-000000000001";
const REPOSITORY_ID = "40000000-0000-4000-8000-000000000001";
const CSRF_TOKEN = "dora-e2e-csrf";

const session = {
  accessToken: "dora-e2e-access-token",
  expiresInSeconds: 900,
  workspaceSelectionRequired: false,
  user: {
    id: "10000000-0000-4000-8000-000000000001",
    email: "dora-user@example.com",
    displayName: "DORA User",
    emailVerified: true,
    hasPassword: true,
  },
  currentMembership: {
    id: "20000000-0000-4000-8000-000000000001",
    workspaceId: WORKSPACE_ID,
    workspaceName: "DORA Workspace",
    workspaceSlug: "dora-workspace",
    timezone: "UTC",
    role: "MANAGER",
  },
  workspaces: [{
    id: WORKSPACE_ID,
    name: "DORA Workspace",
    slug: "dora-workspace",
    timezone: "UTC",
    role: "MANAGER",
  }],
};

const metric = (value: number, unit: string, sampleSize: number, rating: string) => ({
  value,
  unit,
  sampleSize,
  rating,
  dimensions: {},
});

async function mockAuthenticatedDashboard(page: Page, requestedSummaries: URL[]) {
  await page.route("**/api/v1/auth/csrf", (route) => route.fulfill({
    status: 204,
    headers: { "set-cookie": `XSRF-TOKEN=${CSRF_TOKEN}; Path=/; SameSite=Lax` },
  }));
  await page.route("**/api/v1/auth/refresh", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(session),
  }));
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      user: session.user,
      currentMembership: session.currentMembership,
      workspaces: session.workspaces,
    }),
  }));
  await page.route("**/api/v1/projects", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "[]",
  }));
  await page.route("**/api/v1/repositories?*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([{
      id: REPOSITORY_ID,
      workspaceId: WORKSPACE_ID,
      githubIntegrationId: "50000000-0000-4000-8000-000000000001",
      githubRepoId: 42,
      ownerLogin: "adept",
      name: "engine",
      fullName: "adept/engine",
      defaultBranch: "main",
      visibility: "PRIVATE",
      archived: false,
      trackingEnabled: true,
      settings: {},
      lastSyncedAt: "2026-08-25T08:00:00Z",
    }]),
  }));
  await page.route("**/api/v1/metrics/summary?*", (route) => {
    requestedSummaries.push(new URL(route.request().url()));
    const repositoryId = new URL(route.request().url()).searchParams.get("repositoryId");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        workspaceId: WORKSPACE_ID,
        projectId: null,
        repositoryId,
        repositoryCount: repositoryId ? 1 : 2,
        periodStart: "2026-07-26T00:00:00Z",
        periodEnd: "2026-08-25T00:00:00Z",
        timezone: "UTC",
        calculationVersion: "dora-v3",
        deploymentFrequency: metric(4.5, "deployments/week", 18, "HIGH"),
        changeLeadTime: {
          ...metric(2.4, "hours", 14, "HIGH"),
          dimensions: { mean: 3.1, p50: 2.4, p75: 4.2, p90: 5.8 },
        },
        recoveryTime: metric(0.8, "hours", 2, "ELITE"),
        changeFailureRate: {
          ...metric(5.26, "percent", 19, "HIGH"),
          dimensions: { failed_deployments: 1, total_deployments: 19 },
        },
        calculatedAt: "2026-08-25T08:00:00Z",
        stale: false,
      }),
    });
  });
  await page.route("**/api/v1/metrics/series?*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      workspaceId: WORKSPACE_ID,
      projectId: null,
      repositoryId: null,
      repositoryCount: 2,
      periodStart: "2026-07-26T00:00:00Z",
      periodEnd: "2026-08-25T00:00:00Z",
      timezone: "UTC",
      granularity: "DAY",
      calculationVersion: "dora-v3",
      calculatedAt: "2026-08-25T08:00:00Z",
      stale: false,
      series: [],
    }),
  }));
}

test("dashboard renders contract-backed DORA values", async ({ page }) => {
  const requestedSummaries: URL[] = [];
  await mockAuthenticatedDashboard(page, requestedSummaries);

  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "DORA Metrics" })).toBeVisible();
  await expect(page.getByText("4.5", { exact: true })).toBeVisible();
  await expect(page.getByText("2.4h", { exact: true })).toBeVisible();
  await expect(page.getByText("0.8h", { exact: true })).toBeVisible();
  await expect(page.getByText("5.3%", { exact: true })).toBeVisible();
  await expect(page.getByText("Median time to restore service")).toBeVisible();
  await expect(page.getByLabel("Metric calculation status")).not.toContainText("dora-v3");

  await expect(page.getByRole("group", { name: "Time range" })).toBeVisible();
  await expect(page.getByLabel("Repository")).toHaveCount(0);
});
