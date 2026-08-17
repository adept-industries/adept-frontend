import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../auth/AuthContext.js";
import type { AuthenticatedState } from "../../auth/types.js";
import { ProjectContext } from "./ProjectContext.js";
import type { ProjectResponse } from "./api.js";
import { renderWithProviders } from "../../test/renderWithProviders.js";
import { server } from "../../test/server.js";
import { ProjectsPage } from "./ProjectsPage.js";

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

function renderProjectsPage(projects: ProjectResponse[] = []) {
  const state = authenticatedState();
  const actions = {
    logout: vi.fn(),
  } as unknown as AuthContextValue["actions"];

  return renderWithProviders(
    <AuthContext.Provider value={{ state, actions }}>
      <ProjectContext.Provider
        value={{
          projects,
          selectedProject: projects[0] ?? null,
          loading: false,
          error: null,
          select: vi.fn(),
          reload: vi.fn(),
        }}
      >
        <ProjectsPage />
      </ProjectContext.Provider>
    </AuthContext.Provider>
  );
}

describe("ProjectsPage with Lead Assignments", () => {
  beforeEach(() => {
    document.cookie = "XSRF-TOKEN=test-csrf; Path=/";
  });

  it("renders projects with attached repositories and assigned leads", async () => {
    const mockProjects = [
      {
        id: "proj-1",
        workspaceId: "ws-1",
        name: "Backend Core",
        description: "Core services and APIs",
        repositories: [
          {
            id: "repo-1",
            fullName: "acme/api-core",
            trackingEnabled: true,
            archived: false,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    server.use(
      http.get("/api/v1/repositories", () => {
        return HttpResponse.json([
          {
            id: "repo-1",
            workspaceId: "ws-1",
            fullName: "acme/api-core",
            trackingEnabled: true,
            visibility: "PRIVATE",
          },
        ]);
      }),
      http.get("/api/v1/repositories/repo-1/lead-assignments", () => {
        return HttpResponse.json([
          {
            assignmentId: "asgn-1",
            repositoryId: "repo-1",
            invitationId: null,
            email: "lead@example.com",
            role: "LEAD",
            status: null,
            expiresAt: null,
          },
        ]);
      }),
      http.get("/api/v1/repositories/repo-1/lead-candidates", () => {
        return HttpResponse.json([]);
      })
    );

    renderProjectsPage(mockProjects);

    expect(await screen.findByRole("heading", { name: "Backend Core" })).toBeInTheDocument();
    expect(screen.getAllByText("acme/api-core").length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText("lead@example.com")).toBeInTheDocument();
    expect(screen.getByText("Active Lead")).toBeInTheDocument();
  });

  it("allows assigning a lead by work email to an attached repository", async () => {
    const user = userEvent.setup();
    const mockProjects = [
      {
        id: "proj-1",
        workspaceId: "ws-1",
        name: "Mobile App",
        description: "",
        repositories: [
          {
            id: "repo-1",
            fullName: "acme/mobile-app",
            trackingEnabled: true,
            archived: false,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    server.use(
      http.get("/api/v1/repositories", () => {
        return HttpResponse.json([
          {
            id: "repo-1",
            workspaceId: "ws-1",
            fullName: "acme/mobile-app",
            trackingEnabled: true,
            visibility: "PRIVATE",
          },
        ]);
      }),
      http.get("/api/v1/repositories/repo-1/lead-assignments", () => {
        return HttpResponse.json([]);
      }),
      http.get("/api/v1/repositories/repo-1/lead-candidates", () => {
        return HttpResponse.json([]);
      }),
      http.post("/api/v1/repositories/repo-1/lead-assignments", async ({ request }) => {
        const body = (await request.json()) as { email: string };
        return HttpResponse.json({
          assignmentId: "asgn-new",
          repositoryId: "repo-1",
          invitationId: "inv-1",
          email: body.email,
          role: "LEAD",
          status: "PENDING",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        });
      })
    );

    renderProjectsPage(mockProjects);

    const addLeadBtn = await screen.findByRole("button", { name: /\+ Add \/ Invite Lead/i });
    await user.click(addLeadBtn);

    const emailTabBtn = screen.getByRole("button", { name: /Option 2: Work Email/i });
    await user.click(emailTabBtn);

    const emailInput = screen.getByLabelText(/Lead Work Email/i);
    await user.type(emailInput, "engineer@example.com");

    const submitBtn = screen.getByRole("button", { name: /Send Lead Invitation/i });
    await user.click(submitBtn);

    expect(await screen.findByText(/Lead invitation sent to engineer@example.com/i)).toBeInTheDocument();
  });

  it("allows assigning a lead directly from GitHub contributor with public email", async () => {
    const user = userEvent.setup();
    const mockProjects = [
      {
        id: "proj-1",
        workspaceId: "ws-1",
        name: "Web Portal",
        description: "",
        repositories: [
          {
            id: "repo-1",
            fullName: "acme/web-portal",
            trackingEnabled: true,
            archived: false,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    server.use(
      http.get("/api/v1/repositories", () => {
        return HttpResponse.json([
          {
            id: "repo-1",
            workspaceId: "ws-1",
            fullName: "acme/web-portal",
            trackingEnabled: true,
            visibility: "PRIVATE",
          },
        ]);
      }),
      http.get("/api/v1/repositories/repo-1/lead-assignments", () => {
        return HttpResponse.json([]);
      }),
      http.get("/api/v1/repositories/repo-1/lead-candidates", () => {
        return HttpResponse.json([
          {
            githubUserId: "gh-1",
            login: "octocat",
            avatarUrl: "https://example.com/octocat.png",
            permission: "ADMIN",
            publicEmail: "octocat@github.com",
          },
        ]);
      }),
      http.post("/api/v1/repositories/repo-1/lead-assignments", async ({ request }) => {
        const body = (await request.json()) as { email: string };
        return HttpResponse.json({
          assignmentId: "asgn-octo",
          repositoryId: "repo-1",
          invitationId: "inv-2",
          email: body.email,
          role: "LEAD",
          status: "PENDING",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        });
      })
    );

    renderProjectsPage(mockProjects);

    const addLeadBtn = await screen.findByRole("button", { name: /\+ Add \/ Invite Lead/i });
    await user.click(addLeadBtn);

    expect(await screen.findByText("@octocat")).toBeInTheDocument();
    expect(screen.getByText("(octocat@github.com)")).toBeInTheDocument();

    const assignCandidateBtn = screen.getByRole("button", { name: /Assign as Lead/i });
    await user.click(assignCandidateBtn);

    expect(await screen.findByText(/Lead invitation sent to octocat@github.com/i)).toBeInTheDocument();
  });
});
