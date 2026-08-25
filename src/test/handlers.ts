import { http, HttpResponse } from "msw";

const API = "/api/v1";

/**
 * Default MSW handlers for application API routes.
 * Tests override specific handlers with server.use(...).
 */
export const handlers = [
  // CSRF seed
  http.get(`${API}/auth/csrf`, () => new HttpResponse(null, { status: 204 })),

  // Signup
  http.post(`${API}/auth/signup`, () =>
    HttpResponse.json({ user: null, workspace: null, emailVerificationRequired: true }, { status: 201 }),
  ),

  // Login — returns a workspace-scoped session by default.
  http.post(`${API}/auth/login`, () =>
    HttpResponse.json({
      accessToken: "test.access.token",
      expiresInSeconds: 900,
      workspaceSelectionRequired: false,
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
      workspaces: [
        { id: "ws-1", name: "Acme", slug: "acme-abc123", timezone: "UTC", role: "MANAGER" },
      ],
    }),
  ),

  // Password reauthentication — rotates the session and keeps the workspace.
  http.post(`${API}/auth/reauthenticate/password`, () =>
    HttpResponse.json({
      accessToken: "test.reauthenticated.token",
      expiresInSeconds: 900,
      workspaceSelectionRequired: false,
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
      workspaces: [
        { id: "ws-1", name: "Acme", slug: "acme-abc123", timezone: "UTC", role: "MANAGER" },
      ],
    }),
  ),

  http.post(`${API}/auth/google/reauthentication/start`, () =>
    HttpResponse.json({ authorizationUrl: "/api/v1/auth/google/authorization/google" }),
  ),

  // Google onboarding — returns the same workspace-scoped session shape.
  http.post(`${API}/auth/google/onboarding`, () =>
    HttpResponse.json({
      accessToken: "test.access.token",
      expiresInSeconds: 900,
      workspaceSelectionRequired: false,
      user: {
        id: "user-1",
        email: "user@example.com",
        displayName: "Test User",
        emailVerified: true,
        hasPassword: false,
      },
      currentMembership: {
        id: "mem-1",
        workspaceId: "ws-1",
        workspaceName: "Acme",
        workspaceSlug: "acme-abc123",
        timezone: "UTC",
        role: "MANAGER",
      },
      workspaces: [
        { id: "ws-1", name: "Acme", slug: "acme-abc123", timezone: "UTC", role: "MANAGER" },
      ],
    }),
  ),

  // Refresh — returns the same session.
  http.post(`${API}/auth/refresh`, () =>
    HttpResponse.json({
      accessToken: "test.access.token",
      expiresInSeconds: 900,
      workspaceSelectionRequired: false,
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
      workspaces: [
        { id: "ws-1", name: "Acme", slug: "acme-abc123", timezone: "UTC", role: "MANAGER" },
      ],
    }),
  ),

  // Logout
  http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),

  // Me
  http.get(`${API}/auth/me`, () =>
    HttpResponse.json({
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
      workspaces: [
        { id: "ws-1", name: "Acme", slug: "acme-abc123", timezone: "UTC", role: "MANAGER" },
      ],
    }),
  ),

  // Resend verification
  http.post(`${API}/auth/resend-verification`, () =>
    new HttpResponse(null, { status: 202 }),
  ),

  // Forgot password
  http.post(`${API}/auth/forgot-password`, () =>
    new HttpResponse(null, { status: 202 }),
  ),

  // Verify email
  http.post(`${API}/auth/verify-email`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // Reset password
  http.post(`${API}/auth/reset-password`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // Switch workspace
  http.post(`${API}/auth/switch-workspace/:workspaceId`, () =>
    HttpResponse.json({
      accessToken: "test.access.token",
      expiresInSeconds: 900,
      workspaceSelectionRequired: false,
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
      workspaces: [
        { id: "ws-1", name: "Acme", slug: "acme-abc123", timezone: "UTC", role: "MANAGER" },
      ],
    }),
  ),

  // Restore a workspace-scoped session for an account with no active workspace.
  http.post(`${API}/auth/workspaces`, async ({ request }) => {
    const body = await request.json() as { name: string; timezone: string };
    return HttpResponse.json({
      accessToken: "test.recovered.token",
      expiresInSeconds: 900,
      workspaceSelectionRequired: false,
      user: {
        id: "user-1",
        email: "user@example.com",
        displayName: "Test User",
        emailVerified: true,
        hasPassword: true,
      },
      currentMembership: {
        id: "mem-recovered",
        workspaceId: "ws-recovered",
        workspaceName: body.name,
        workspaceSlug: "recovered-workspace-abc123",
        timezone: body.timezone,
        role: "MANAGER",
      },
      workspaces: [
        {
          id: "ws-recovered",
          name: body.name,
          slug: "recovered-workspace-abc123",
          timezone: body.timezone,
          role: "MANAGER",
        },
      ],
    }, { status: 201 });
  }),

  // Workspaces list
  http.get(`${API}/workspaces`, () =>
    HttpResponse.json([
      { id: "ws-1", name: "Acme", slug: "acme-abc123", timezone: "UTC", role: "MANAGER" },
    ]),
  ),

  // Current workspace
  http.get(`${API}/workspaces/current`, () =>
    HttpResponse.json({
      id: "ws-1",
      name: "Acme",
      slug: "acme-abc123",
      timezone: "UTC",
      role: "MANAGER",
      membershipId: "mem-1",
    }),
  ),

  // Update workspace (name / timezone only)
  http.patch(`${API}/workspaces/current`, async ({ request }) => {
    const body = await request.json() as { name?: string; timezone?: string };
    return HttpResponse.json({
      id: "ws-1",
      name: body.name ?? "Acme",
      slug: "acme-abc123",
      timezone: body.timezone ?? "UTC",
      role: "MANAGER",
      membershipId: "mem-1",
    });
  }),

  // Delete workspace
  http.delete(`${API}/workspaces/current`, () =>
    HttpResponse.json(
      { workspaceId: "ws-1", status: "DELETING" },
      { status: 202 },
    ),
  ),

  http.get(`${API}/repositories`, () =>
    HttpResponse.json([
      {
        id: "repo-1",
        workspaceId: "ws-1",
        githubIntegrationId: "github-1",
        githubRepoId: 101,
        ownerLogin: "acme",
        name: "backend",
        fullName: "acme/backend",
        defaultBranch: "main",
        visibility: "PRIVATE",
        archived: false,
        trackingEnabled: true,
        settings: null,
      },
    ]),
  ),

  // DORA metrics — summary
  http.get(`${API}/metrics/summary`, () =>
    HttpResponse.json({
      workspaceId: "ws-1",
      projectId: null,
      repositoryId: null,
      repositoryCount: 2,
      periodStart: "2026-07-24T00:00:00Z",
      periodEnd:   "2026-08-23T00:00:00Z",
      timezone: "UTC",
      calculationVersion: "dora-v3",
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
    }),
  ),

  // DORA metrics — series
  http.get(`${API}/metrics/series`, () =>
    HttpResponse.json({
      workspaceId: "ws-1",
      projectId: null,
      repositoryId: null,
      repositoryCount: 2,
      periodStart: "2026-07-24T00:00:00Z",
      periodEnd: "2026-08-23T00:00:00Z",
      timezone: "UTC",
      granularity: "DAY",
      calculationVersion: "dora-v3",
      calculatedAt: "2026-08-23T12:00:00Z",
      stale: false,
      series: [
        {
          metricType: "DEPLOYMENT_FREQUENCY",
          periodStart: "2026-08-20T00:00:00Z",
          periodEnd:   "2026-08-21T00:00:00Z",
          value: 2.0,
          unit: "deployments/day",
          sampleSize: 2,
          dimensions: {},
        },
        {
          metricType: "DEPLOYMENT_FREQUENCY",
          periodStart: "2026-08-21T00:00:00Z",
          periodEnd:   "2026-08-22T00:00:00Z",
          value: 3.0,
          unit: "deployments/day",
          sampleSize: 3,
          dimensions: {},
        },
        {
          metricType: "CHANGE_LEAD_TIME_HOURS",
          periodStart: "2026-08-20T00:00:00Z",
          periodEnd:   "2026-08-21T00:00:00Z",
          value: 2.1,
          unit: "hours",
          sampleSize: 2,
          dimensions: {},
        },
        {
          metricType: "CHANGE_LEAD_TIME_HOURS",
          periodStart: "2026-08-21T00:00:00Z",
          periodEnd:   "2026-08-22T00:00:00Z",
          value: 2.8,
          unit: "hours",
          sampleSize: 3,
          dimensions: {},
        },
        {
          metricType: "FAILED_DEPLOYMENT_RECOVERY_TIME_HOURS",
          periodStart: "2026-08-22T00:00:00Z",
          periodEnd:   "2026-08-23T00:00:00Z",
          value: 0.8,
          unit: "hours",
          sampleSize: 1,
          dimensions: {},
        },
        {
          metricType: "CHANGE_FAILURE_RATE_PERCENT",
          periodStart: "2026-08-20T00:00:00Z",
          periodEnd:   "2026-08-21T00:00:00Z",
          value: 10.0,
          unit: "percent",
          sampleSize: 10,
          dimensions: {},
        },
        {
          metricType: "CHANGE_FAILURE_RATE_PERCENT",
          periodStart: "2026-08-21T00:00:00Z",
          periodEnd:   "2026-08-22T00:00:00Z",
          value: 5.0,
          unit: "percent",
          sampleSize: 20,
          dimensions: {},
        },
      ],
    }),
  ),

  // Projects (default empty — tests override as needed)
  http.get(`${API}/projects`, () => HttpResponse.json([])),
];
