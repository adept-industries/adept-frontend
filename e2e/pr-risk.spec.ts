import { expect, test } from "@playwright/test";

const WORKSPACE_ID = "30000000-0000-4000-8000-000000000011";
const PROJECT_ID = "60000000-0000-4000-8000-000000000011";
const REPOSITORY_ID = "40000000-0000-4000-8000-000000000011";

test("dashboard shows project pull-request risks and provider issues", async ({ page }) => {
  const membership = {
    id: "20000000-0000-4000-8000-000000000011",
    workspaceId: WORKSPACE_ID,
    workspaceName: "Review Workspace",
    workspaceSlug: "review-workspace",
    timezone: "UTC",
    role: "MANAGER",
  };
  const user = {
    id: "10000000-0000-4000-8000-000000000011",
    email: "review@example.com",
    displayName: "Review Manager",
    emailVerified: true,
    hasPassword: true,
  };
  const workspace = {
    id: WORKSPACE_ID,
    name: "Review Workspace",
    slug: "review-workspace",
    timezone: "UTC",
    role: "MANAGER",
  };

  await page.route("**/api/v1/auth/csrf", (route) => route.fulfill({
    status: 204,
    headers: { "set-cookie": "XSRF-TOKEN=review-e2e-csrf; Path=/; SameSite=Lax" },
  }));
  await page.route("**/api/v1/auth/refresh", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      accessToken: "review-e2e-access-token",
      expiresInSeconds: 900,
      workspaceSelectionRequired: false,
      user,
      currentMembership: membership,
      workspaces: [workspace],
    }),
  }));
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ user, currentMembership: membership, workspaces: [workspace] }),
  }));
  await page.route("**/api/v1/projects", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([{
      id: PROJECT_ID,
      workspaceId: WORKSPACE_ID,
      name: "Adept Platform",
      jiraProjects: [],
      repositories: [{
        id: REPOSITORY_ID,
        fullName: "adept-industries/adept-api",
        trackingEnabled: true,
        archived: false,
        jiraProjects: [],
      }],
    }]),
  }));
  await page.route("**/api/v1/metrics/summary?*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      repositoryId: null,
      repositoryCount: 1,
      periodStart: "2026-08-01T00:00:00Z",
      periodEnd: "2026-08-30T00:00:00Z",
      timezone: "UTC",
      calculationVersion: "dora-v3",
      deploymentFrequency: { value: 0, unit: "deployments/week", sampleSize: 0, rating: "UNKNOWN", dimensions: {} },
      changeLeadTime: { value: 0, unit: "hours", sampleSize: 0, rating: "UNKNOWN", dimensions: {} },
      recoveryTime: { value: 0, unit: "hours", sampleSize: 0, rating: "UNKNOWN", dimensions: {} },
      changeFailureRate: { value: 0, unit: "percent", sampleSize: 0, rating: "UNKNOWN", dimensions: {} },
      calculatedAt: null,
      stale: false,
    }),
  }));
  await page.route("**/api/v1/metrics/series?*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      repositoryId: null,
      repositoryCount: 1,
      periodStart: "2026-08-01T00:00:00Z",
      periodEnd: "2026-08-30T00:00:00Z",
      timezone: "UTC",
      granularity: "DAY",
      calculationVersion: "dora-v3",
      calculatedAt: null,
      stale: false,
      series: [],
    }),
  }));
  await page.route(`**/api/v1/projects/${PROJECT_ID}/pull-request-risks?*`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      displayLabel: "Estimated review risk",
      disclaimer: "This score helps prioritize code review. It does not prove that the pull request contains a defect.",
      modelName: "jitfine-expert-pr-risk-mvp",
      modelVersion: "jitfine-expert-pr-risk-mvp-v1",
      featureSchemaVersion: "jitfine-pr-features-v1",
      stalledBefore: "2026-08-28T00:00:00Z",
      items: [{
        pullRequestId: "70000000-0000-4000-8000-000000000011",
        repositoryId: REPOSITORY_ID,
        repositoryFullName: "adept-industries/adept-api",
        number: 74,
        title: "Expose project pull request risks",
        draft: false,
        authorLogin: "adept-reviewer",
        url: "https://github.com/adept-industries/adept-api/pull/74",
        openedAt: "2026-08-26T00:00:00Z",
        stalled: true,
        riskScore: 0.47,
        riskLevel: "CRITICAL",
        thresholdUsed: 0.4,
        topFactors: [{ feature: "nf", value: 9, globalImportance: 0.31, explanationType: "global_model_importance" }],
        predictedAt: "2026-08-30T08:00:00Z",
      }],
      page: 0,
      size: 10,
      totalElements: 1,
      totalPages: 1,
    }),
  }));
  await page.route(`**/api/v1/projects/${PROJECT_ID}/issues/github?*`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      items: [{
        id: "80000000-0000-4000-8000-000000000011",
        repositoryId: REPOSITORY_ID,
        repositoryFullName: "adept-industries/adept-api",
        number: 81,
        title: "Correct project issue authorization",
        authorLogin: "adept-reviewer",
        assigneeLogins: ["api-lead"],
        labels: ["bug"],
        commentsCount: 2,
        url: "https://github.com/adept-industries/adept-api/issues/81",
        createdAt: "2026-08-29T08:00:00Z",
        updatedAt: "2026-08-30T08:00:00Z",
      }],
      page: 0,
      size: 10,
      totalElements: 1,
      totalPages: 1,
    }),
  }));
  await page.route(`**/api/v1/projects/${PROJECT_ID}/issues/jira?*`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      items: [{
        id: "90000000-0000-4000-8000-000000000011",
        jiraProjectId: "90000000-0000-4000-8000-000000000012",
        jiraProjectKey: "ADEPT",
        jiraProjectName: "Adept Platform",
        issueKey: "ADEPT-81",
        summary: "Investigate issue synchronization",
        issueType: "Bug",
        statusName: "In Progress",
        priorityName: "High",
        url: "https://adept.atlassian.net/browse/ADEPT-81",
        createdAt: "2026-08-29T08:00:00Z",
        updatedAt: "2026-08-30T08:00:00Z",
      }],
      page: 0,
      size: 10,
      totalElements: 1,
      totalPages: 1,
    }),
  }));

  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Pull request review queue" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Expose project pull request risks/ })).toBeVisible();
  await expect(page.getByText("adept-industries/adept-api #74")).toBeVisible();
  await expect(page.getByText("Stalled", { exact: true })).toBeVisible();
  await expect(page.getByLabel("critical risk, 47%")).toBeVisible();
  await expect(page.getByRole("button", { name: "Score open PRs" })).toBeVisible();

  await expect(page.getByRole("heading", { name: "Open issues" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Correct project issue authorization/ })).toBeVisible();
  await expect(page.getByText("adept-industries/adept-api #81")).toBeVisible();
  await page.getByRole("tab", { name: /Jira/ }).click();
  await expect(page.getByRole("link", { name: /ADEPT-81: Investigate issue synchronization/ })).toBeVisible();
  await expect(page.getByText("ADEPT — Adept Platform")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sync issues" })).toBeVisible();
});
