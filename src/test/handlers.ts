import { http, HttpResponse } from "msw";

const API = "/api/v1";

/**
 * Default MSW handlers for all Phase 2 API routes.
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
];
