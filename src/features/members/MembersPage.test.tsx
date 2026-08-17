import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../auth/AuthContext.js";
import type { AuthenticatedState } from "../../auth/types.js";
import { ProjectContext } from "../projects/ProjectContext.js";
import { renderWithProviders } from "../../test/renderWithProviders.js";
import { server } from "../../test/server.js";
import { MembersPage } from "./MembersPage.js";

function authenticatedState(): AuthenticatedState {
  return {
    status: "authenticated",
    generation: 1,
    user: {
      id: "user-1",
      email: "manager@example.com",
      displayName: "Manager",
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

function renderPage() {
  const state = authenticatedState();
  const actions = {
    logout: vi.fn(),
  } as unknown as AuthContextValue["actions"];

  return renderWithProviders(
    <AuthContext.Provider value={{ state, actions }}>
      <ProjectContext.Provider
        value={{
          projects: [],
          selectedProject: null,
          loading: false,
          error: null,
          select: vi.fn(),
          reload: vi.fn(),
        }}
      >
        <MembersPage />
      </ProjectContext.Provider>
    </AuthContext.Provider>
  );
}

describe("MembersPage", () => {
  beforeEach(() => {
    document.cookie = "XSRF-TOKEN=test-csrf; Path=/";
  });

  it("renders repository selector and allows looking up an existing member", async () => {
    const user = userEvent.setup();

    server.use(
      http.get("/api/v1/repositories", () => {
        return HttpResponse.json([
          {
            id: "repo-1",
            workspaceId: "ws-1",
            githubIntegrationId: "gh-1",
            githubRepoId: 101,
            ownerLogin: "acme",
            name: "web-app",
            fullName: "acme/web-app",
            defaultBranch: "main",
            visibility: "PRIVATE",
            archived: false,
            trackingEnabled: true,
            settings: {
              deploymentSignal: "WORKFLOW_RUN",
              productionBranchPatterns: ["main"],
              productionEnvironmentPatterns: ["production"],
              deploymentWorkflowNamePatterns: ["deploy"],
              releaseTagPatterns: [],
              incidentSource: "BOTH",
              doraExclusions: [],
              defaultMetricGranularity: "WEEK",
              backfillDays: 90,
            },
            lastSyncedAt: new Date().toISOString(),
          },
        ]);
      }),
      http.get("/api/v1/repositories/repo-1/lead-candidates", () => {
        return HttpResponse.json([]);
      }),
      http.post("/api/v1/workspaces/current/members/lookup", async ({ request }) => {
        const body = (await request.json()) as { email: string };
        return HttpResponse.json({
          email: body.email,
          existingUser: true,
          emailVerified: true,
          assignableAsLead: true,
        });
      })
    );

    renderPage();

    expect(await screen.findByText("Members & Lead Assignments")).toBeInTheDocument();
    expect(await screen.findByText("acme/web-app (Tracked)")).toBeInTheDocument();

    const emailInput = screen.getByLabelText(/Lead Email/i);
    await user.type(emailInput, "engineer@example.com");

    const lookupBtn = screen.getByRole("button", { name: /Lookup/i });
    await user.click(lookupBtn);

    expect(await screen.findByText(/Existing Member:/i)).toBeInTheDocument();
    expect(screen.getByText(/can be assigned directly as a repository Lead/i)).toBeInTheDocument();
  });

  it("assigns a Lead by email and supports target-specific unassignment", async () => {
    const user = userEvent.setup();

    server.use(
      http.get("/api/v1/repositories", () => {
        return HttpResponse.json([
          {
            id: "repo-1",
            workspaceId: "ws-1",
            githubIntegrationId: "gh-1",
            githubRepoId: 101,
            ownerLogin: "acme",
            name: "web-app",
            fullName: "acme/web-app",
            defaultBranch: "main",
            visibility: "PRIVATE",
            archived: false,
            trackingEnabled: true,
            settings: {
              deploymentSignal: "WORKFLOW_RUN",
              productionBranchPatterns: ["main"],
              productionEnvironmentPatterns: ["production"],
              deploymentWorkflowNamePatterns: ["deploy"],
              releaseTagPatterns: [],
              incidentSource: "BOTH",
              doraExclusions: [],
              defaultMetricGranularity: "WEEK",
              backfillDays: 90,
            },
            lastSyncedAt: new Date().toISOString(),
          },
        ]);
      }),
      http.get("/api/v1/repositories/repo-1/lead-candidates", () => {
        return HttpResponse.json([]);
      }),
      http.post("/api/v1/repositories/repo-1/lead-assignments", async ({ request }) => {
        const body = (await request.json()) as { email: string };
        return HttpResponse.json({
          assignmentId: "asgn-123",
          repositoryId: "repo-1",
          invitationId: "inv-456",
          email: body.email,
          role: "LEAD",
          status: "PENDING",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        });
      }),
      http.delete("/api/v1/repositories/repo-1/lead-assignments/asgn-123", () => {
        return new HttpResponse(null, { status: 204 });
      })
    );

    renderPage();

    const emailInput = await screen.findByLabelText(/Lead Email/i);
    await user.type(emailInput, "newlead@example.com");

    const assignBtn = screen.getByRole("button", { name: /Assign as Lead/i });
    await user.click(assignBtn);

    expect(await screen.findByText(/Invitation sent to newlead@example.com for acme\/web-app/i)).toBeInTheDocument();
    expect(screen.getByText("newlead@example.com")).toBeInTheDocument();

    const unassignBtn = screen.getByRole("button", { name: /Unassign/i });
    await user.click(unassignBtn);

    await waitFor(() => {
      expect(screen.getByText(/Unassigned newlead@example.com from acme\/web-app/i)).toBeInTheDocument();
    });
  });

  it("handles GitHub contributor candidates with and without public email (fallback input)", async () => {
    const user = userEvent.setup();

    server.use(
      http.get("/api/v1/repositories", () => {
        return HttpResponse.json([
          {
            id: "repo-1",
            workspaceId: "ws-1",
            githubIntegrationId: "gh-1",
            githubRepoId: 101,
            ownerLogin: "acme",
            name: "web-app",
            fullName: "acme/web-app",
            defaultBranch: "main",
            visibility: "PRIVATE",
            archived: false,
            trackingEnabled: true,
            settings: {
              deploymentSignal: "WORKFLOW_RUN",
              productionBranchPatterns: ["main"],
              productionEnvironmentPatterns: ["production"],
              deploymentWorkflowNamePatterns: ["deploy"],
              releaseTagPatterns: [],
              incidentSource: "BOTH",
              doraExclusions: [],
              defaultMetricGranularity: "WEEK",
              backfillDays: 90,
            },
            lastSyncedAt: new Date().toISOString(),
          },
        ]);
      }),
      http.get("/api/v1/repositories/repo-1/lead-candidates", () => {
        return HttpResponse.json([
          {
            githubUserId: "gh-101",
            login: "alice-dev",
            avatarUrl: "https://example.com/alice.png",
            permission: "MAINTAIN",
            publicEmail: "alice@example.com",
          },
          {
            githubUserId: "gh-102",
            login: "bob-private",
            avatarUrl: null,
            permission: "WRITE",
            publicEmail: null,
          },
        ]);
      }),
      http.post("/api/v1/repositories/repo-1/lead-assignments", async ({ request }) => {
        const body = (await request.json()) as { email: string };
        return HttpResponse.json({
          assignmentId: `asgn-${body.email}`,
          repositoryId: "repo-1",
          invitationId: null,
          email: body.email,
          role: "LEAD",
          status: "ACTIVE",
          expiresAt: null,
        });
      })
    );

    renderPage();

    // Alice has public email
    expect(await screen.findByText("@alice-dev")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    const aliceAssignBtn = screen.getByRole("button", { name: /Assign alice@example.com as Lead/i });
    await user.click(aliceAssignBtn);

    expect(await screen.findByText(/alice@example.com \(@alice-dev\) assigned as Lead/i)).toBeInTheDocument();

    // Bob has NO public email — UI fallback input is rendered
    expect(screen.getByText("@bob-private")).toBeInTheDocument();
    expect(screen.getByText("No public email on GitHub")).toBeInTheDocument();

    const bobEmailInput = screen.getByLabelText(/Work email for bob-private/i);
    await user.type(bobEmailInput, "bob.work@example.com");

    const inviteBobBtn = screen.getByRole("button", { name: "Invite" });
    await user.click(inviteBobBtn);

    expect(await screen.findByText(/bob.work@example.com \(@bob-private\) assigned as Lead/i)).toBeInTheDocument();
  });
});
