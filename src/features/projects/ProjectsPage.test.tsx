import { screen, waitFor } from "@testing-library/react";
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

function authenticatedState(role: "MANAGER" | "LEAD" = "MANAGER"): AuthenticatedState {
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
      role,
    },
    workspaces: [{ id: "ws-1", name: "Acme", slug: "acme-abc123", timezone: "UTC", role }],
  };
}

function renderProjectsPage(
  projects: ProjectResponse[] = [],
  role: "MANAGER" | "LEAD" = "MANAGER",
) {
  const state = authenticatedState(role);
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
    server.use(
      http.get("/api/v1/jira/projects", () => HttpResponse.json([])),
    );
  });

  it("keeps the project creation form collapsed until requested", async () => {
    server.use(
      http.get("/api/v1/repositories", () => HttpResponse.json([])),
    );

    renderProjectsPage();

    expect(screen.queryByRole("textbox", { name: "Project name" })).not.toBeInTheDocument();
    const user = userEvent.setup();
    const createButton = screen.getByRole("button", { name: "Create project" });
    expect(createButton).toHaveAttribute("aria-expanded", "false");

    await user.click(createButton);

    expect(screen.getByRole("textbox", { name: "Project name" })).toBeVisible();
    const collapseButton = screen.getByRole("button", { name: "Collapse project" });
    expect(collapseButton).toHaveAttribute("aria-expanded", "true");

    await user.click(collapseButton);

    expect(screen.queryByRole("textbox", { name: "Project name" })).not.toBeInTheDocument();
  });

  it("creates a project with tracked repositories and Jira mappings in one request", async () => {
    const user = userEvent.setup();
    let createBody: unknown;
    let trackingOnly: string | null = null;

    server.use(
      http.get("/api/v1/repositories", ({ request }) => {
        trackingOnly = new URL(request.url).searchParams.get("trackingOnly");
        return HttpResponse.json([
          {
            id: "repo-1",
            workspaceId: "ws-1",
            name: "api",
            fullName: "acme/api",
            trackingEnabled: true,
            archived: false,
            visibility: "PRIVATE",
          },
          {
            id: "repo-untracked",
            workspaceId: "ws-1",
            name: "legacy",
            fullName: "acme/legacy",
            trackingEnabled: false,
            archived: false,
            visibility: "PRIVATE",
          },
        ]);
      }),
      http.get("/api/v1/jira/projects", () => HttpResponse.json([
        {
          id: "jira-core",
          workspaceId: "ws-1",
          jiraIntegrationId: "jira-1",
          jiraProjectId: "10001",
          projectKey: "CORE",
          projectName: "Core Project",
          projectType: "software",
          trackingEnabled: true,
          lastSyncedAt: "2026-08-29T00:00:00Z",
        },
        {
          id: "jira-legacy",
          workspaceId: "ws-1",
          jiraIntegrationId: "jira-1",
          jiraProjectId: "10002",
          projectKey: "LEGACY",
          projectName: "Legacy Project",
          projectType: "software",
          trackingEnabled: false,
          lastSyncedAt: "2026-08-29T00:00:00Z",
        },
      ])),
      http.get("/api/v1/repositories/repo-1/lead-assignments", () => HttpResponse.json([])),
      http.get("/api/v1/repositories/repo-1/lead-candidates", () => HttpResponse.json([])),
      http.post("/api/v1/projects", async ({ request }) => {
        createBody = await request.json();
        return HttpResponse.json({
          id: "project-new",
          workspaceId: "ws-1",
          name: "Delivery",
          description: "",
          repositories: [],
        }, { status: 201 });
      }),
    );

    renderProjectsPage();

    await user.click(screen.getByRole("button", { name: "Create project" }));
    await user.click(await screen.findByRole("checkbox", { name: /acme\/api/i }));
    expect(screen.queryByText("acme/legacy")).not.toBeInTheDocument();
    await user.click(await screen.findByRole("checkbox", {
      name: "Map [CORE] Core Project to acme/api",
    }));
    expect(screen.queryByRole("checkbox", {
      name: "Map [LEGACY] Legacy Project to acme/api",
    })).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Project name" }), "Delivery");
    await user.click(screen.getByRole("button", { name: "Create Project" }));

    await waitFor(() => expect(createBody).toEqual({
      name: "Delivery",
      repositories: [{ repositoryId: "repo-1", jiraProjectIds: ["jira-core"] }],
    }));
    expect(trackingOnly).toBe("true");
  });

  it("preserves and updates repository Jira mappings while editing a project", async () => {
    const user = userEvent.setup();
    let configurationBody: unknown;
    const project: ProjectResponse = {
      id: "project-1",
      workspaceId: "ws-1",
      name: "Delivery",
      description: "Core delivery",
      repositories: [{
        id: "repo-1",
        fullName: "acme/api",
        trackingEnabled: true,
        archived: false,
        jiraProjects: [
          {
            id: "jira-core",
            projectKey: "CORE",
            projectName: "Core Project",
            trackingEnabled: true,
          },
          {
            id: "jira-disabled",
            projectKey: "DISABLED",
            projectName: "Disabled Project",
            trackingEnabled: false,
          },
        ],
      }],
    };

    server.use(
      http.get("/api/v1/repositories", () => HttpResponse.json([{
        id: "repo-1",
        workspaceId: "ws-1",
        name: "api",
        fullName: "acme/api",
        trackingEnabled: true,
        archived: false,
        visibility: "PRIVATE",
      }])),
      http.get("/api/v1/jira/projects", () => HttpResponse.json([
        {
          id: "jira-core",
          projectKey: "CORE",
          projectName: "Core Project",
          trackingEnabled: true,
        },
        {
          id: "jira-ops",
          projectKey: "OPS",
          projectName: "Operations",
          trackingEnabled: true,
        },
        {
          id: "jira-disabled",
          projectKey: "DISABLED",
          projectName: "Disabled Project",
          trackingEnabled: false,
        },
      ])),
      http.get("/api/v1/repositories/repo-1/lead-assignments", () => HttpResponse.json([])),
      http.get("/api/v1/repositories/repo-1/lead-candidates", () => HttpResponse.json([])),
      http.patch("/api/v1/projects/project-1", () => HttpResponse.json(project)),
      http.put("/api/v1/projects/project-1/configuration", async ({ request }) => {
        configurationBody = await request.json();
        return HttpResponse.json(project);
      }),
    );

    renderProjectsPage([project]);

    await user.click(screen.getByRole("button", { name: "Edit project" }));
    const coreMapping = await screen.findByRole("checkbox", {
      name: "Map [CORE] Core Project to acme/api",
    });
    expect(coreMapping).toBeChecked();
    expect(screen.queryByRole("checkbox", {
      name: "Map [DISABLED] Disabled Project to acme/api",
    })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", {
      name: "Map [OPS] Operations to acme/api",
    }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(configurationBody).toEqual({
      repositories: [{
        repositoryId: "repo-1",
        jiraProjectIds: ["jira-core", "jira-ops"],
      }],
    }));
  });

  it("shows a Lead only their scoped project content without Manager controls", () => {
    const scopedProjects = [
      {
        id: "proj-lead",
        workspaceId: "ws-1",
        name: "API Delivery",
        description: "Lead-scoped delivery project",
        repositories: [
          {
            id: "repo-api",
            fullName: "acme/api",
            trackingEnabled: true,
            archived: false,
            jiraProjects: [{
              id: "jira-api",
              projectKey: "API",
              projectName: "API Delivery",
              trackingEnabled: true,
            }],
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    renderProjectsPage(scopedProjects, "LEAD");

    expect(screen.getByRole("heading", { name: "Projects" })).toBeVisible();
    expect(screen.getByText("View projects containing repositories assigned to you.")).toBeVisible();
    expect(screen.getByRole("heading", { name: "API Delivery" })).toBeVisible();
    expect(screen.getByText("acme/api")).toBeVisible();
    expect(screen.getByText("[API] API Delivery")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Create Project" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create project" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit project" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add \/ Invite Lead/i })).not.toBeInTheDocument();
  });

  it("explains when a Lead has no assigned projects", () => {
    renderProjectsPage([], "LEAD");

    expect(screen.getByText(
      "No assigned projects yet. Projects appear here when a Manager assigns you to a tracked repository.",
    )).toBeVisible();
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
            jiraProjects: [],
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
            jiraProjects: [],
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

    const emailTabBtn = screen.getByRole("button", { name: /Work Email/i });
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
            jiraProjects: [],
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
