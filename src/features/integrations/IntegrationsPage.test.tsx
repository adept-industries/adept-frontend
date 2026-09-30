import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../auth/AuthContext.js";
import type { AuthenticatedState } from "../../auth/types.js";
import { ProjectContext } from "../projects/ProjectContext.js";
import type { ProjectResponse } from "../projects/api.js";
import { renderWithProviders } from "../../test/renderWithProviders.js";
import { server } from "../../test/server.js";
import { IntegrationsPage } from "./IntegrationsPage.js";

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
      onboardingComplete: true,
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

function renderPage(projects: ProjectResponse[] = [], reload = vi.fn()) {
  const state = authenticatedState();
  const actions = {
    logout: vi.fn(),
  } as unknown as AuthContextValue["actions"];

  const result = renderWithProviders(
    <AuthContext.Provider value={{ state, actions }}>
      <ProjectContext.Provider
        value={{
          projects,
          selectedProject: null,
          loading: false,
          error: null,
          select: vi.fn(),
          reload,
        }}
      >
        <IntegrationsPage />
      </ProjectContext.Provider>
    </AuthContext.Provider>
  );

  return {
    ...result,
    reload,
  };
}

function jiraIntegration(lastSyncedAt: string, projectCount = 1) {
  return {
    id: "jira-1",
    workspaceId: "ws-1",
    cloudId: "cloud-1",
    siteUrl: "https://acme.atlassian.net",
    displayName: "Acme Jira",
    status: "ACTIVE",
    lastSyncedAt,
    projectCount,
  };
}

function jiraProject(id: string, projectKey: string, projectName: string) {
  return {
    id,
    workspaceId: "ws-1",
    jiraIntegrationId: "jira-1",
    jiraProjectId: id,
    projectKey,
    projectName,
    projectType: "software",
    trackingEnabled: false,
    lastSyncedAt: "2026-08-29T00:00:00Z",
  };
}

function repository(id: string, name: string) {
  return {
    id,
    workspaceId: "ws-1",
    githubIntegrationId: "gh-1",
    githubRepoId: id === "repo-1" ? 999 : 1_000,
    ownerLogin: "acme-org",
    name,
    fullName: `acme-org/${name}`,
    defaultBranch: "main",
    visibility: "PRIVATE",
    archived: false,
    trackingEnabled: false,
    settings: {
      deploymentSignal: "WORKFLOW_RUN",
      productionBranchPatterns: ["main"],
      productionEnvironmentPatterns: ["production"],
      deploymentWorkflowNamePatterns: ["*deploy*"],
      releaseTagPatterns: ["v*"],
      incidentSource: "BOTH",
      doraExclusions: [],
      defaultMetricGranularity: "WEEK",
      backfillDays: 90,
    },
    lastSyncedAt: "2026-08-29T00:00:00Z",
  };
}

describe("IntegrationsPage", () => {
  beforeEach(() => {
    document.cookie = "XSRF-TOKEN=test-csrf; Path=/";
  });

  it("renders GitHub and Jira connection cards and repository table", async () => {
    server.use(
      http.get("/api/v1/integrations/github", () => {
        return HttpResponse.json({
          id: "gh-1",
          workspaceId: "ws-1",
          installationId: 12345,
          accountLogin: "acme-org",
          accountType: "ORGANIZATION",
          repositorySelection: "ALL",
          status: "ACTIVE",
          lastSyncedAt: new Date().toISOString(),
          repositoryCount: 2,
        });
      }),
      http.get("/api/v1/integrations/jira", () => {
        return HttpResponse.json({
          id: "jira-1",
          workspaceId: "ws-1",
          cloudId: "cloud-1",
          siteUrl: "https://acme.atlassian.net",
          displayName: "Acme Jira",
          status: "ACTIVE",
          lastSyncedAt: new Date().toISOString(),
          projectCount: 1,
        });
      }),
      http.get("/api/v1/repositories", () => {
        return HttpResponse.json([
          {
            id: "repo-1",
            workspaceId: "ws-1",
            githubIntegrationId: "gh-1",
            githubRepoId: 999,
            ownerLogin: "acme-org",
            name: "core-service",
            fullName: "acme-org/core-service",
            defaultBranch: "main",
            visibility: "PRIVATE",
            archived: false,
            trackingEnabled: true,
            settings: {
              deploymentSignal: "WORKFLOW_RUN",
              productionBranchPatterns: ["main"],
              productionEnvironmentPatterns: ["production"],
              deploymentWorkflowNamePatterns: ["*deploy*"],
              releaseTagPatterns: ["v*"],
              incidentSource: "BOTH",
              doraExclusions: [],
              defaultMetricGranularity: "WEEK",
              backfillDays: 90,
            },
            lastSyncedAt: new Date().toISOString(),
          },
        ]);
      }),
      http.get("/api/v1/jira/projects", () => {
        return HttpResponse.json([
          {
            id: "jp-1",
            workspaceId: "ws-1",
            jiraIntegrationId: "jira-1",
            jiraProjectId: "10001",
            projectKey: "ACME",
            projectName: "Core Project",
            projectType: "software",
            trackingEnabled: true,
            lastSyncedAt: new Date().toISOString(),
          },
        ]);
      })
    );

    renderPage();

    expect(await screen.findByText("Integrations & Repositories")).toBeInTheDocument();
    expect(await screen.findByText("acme-org")).toBeInTheDocument();
    expect(await screen.findByText("Acme Jira")).toBeInTheDocument();
    expect(await screen.findByText("acme-org/core-service")).toBeInTheDocument();
    expect(await screen.findByText("[ACME] Core Project")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Map Jira" })).not.toBeInTheDocument();
  });

  it("shows success feedback and refreshes repositories after GitHub sync", async () => {
    const user = userEvent.setup();
    const beforeSync = "2026-08-29T00:00:00Z";
    const afterSync = "2026-08-29T00:01:00Z";
    let syncRequested = false;
    let syncRequests = 0;

    server.use(
      http.get("/api/v1/integrations/github", () => HttpResponse.json({
        id: "gh-1",
        workspaceId: "ws-1",
        installationId: 12345,
        accountLogin: "acme-org",
        accountType: "ORGANIZATION",
        repositorySelection: "ALL",
        status: "ACTIVE",
        lastSyncedAt: syncRequested ? afterSync : beforeSync,
        repositoryCount: syncRequested ? 2 : 1,
      })),
      http.get("/api/v1/repositories", () => HttpResponse.json(
        syncRequested
          ? [repository("repo-1", "core-service"), repository("repo-2", "web-app")]
          : [repository("repo-1", "core-service")],
      )),
      http.get("/api/v1/integrations/jira", () => HttpResponse.json(null)),
      http.get("/api/v1/jira/projects", () => HttpResponse.json([])),
      http.post("/api/v1/integrations/github/gh-1/sync", () => {
        syncRequests += 1;
        syncRequested = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderPage();

    expect(await screen.findByText("acme-org/core-service")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Sync Repositories" }));

    expect(await screen.findByRole("status")).toHaveTextContent("GitHub repositories synchronized successfully.");
    expect(screen.getByText("acme-org/web-app")).toBeVisible();
    expect(screen.getByRole("button", { name: "Sync Repositories" })).toBeEnabled();
    expect(syncRequests).toBe(1);
  });

  it("disables manual DORA rebuild for an untracked repository", async () => {
    server.use(
      http.get("/api/v1/integrations/github", () => HttpResponse.json(null)),
      http.get("/api/v1/integrations/jira", () => HttpResponse.json(null)),
      http.get("/api/v1/repositories", () =>
        HttpResponse.json([repository("repo-1", "core-service")])),
      http.get("/api/v1/jira/projects", () => HttpResponse.json([])),
    );

    renderPage();

    const rebuild = await screen.findByRole("button", { name: "Rebuild DORA" });
    expect(rebuild).toBeDisabled();
    expect(rebuild).toHaveAttribute(
      "title",
      "Enable tracking before rebuilding DORA data",
    );
  });

  it("syncs Jira projects and refreshes the catalog after engine completion", async () => {
    const user = userEvent.setup();
    const beforeSync = "2026-08-29T00:00:00Z";
    const afterSync = "2026-08-29T00:01:00Z";
    let syncRequested = false;
    let syncRequests = 0;

    server.use(
      http.get("/api/v1/integrations/github", () => HttpResponse.json(null)),
      http.get("/api/v1/repositories", () => HttpResponse.json([])),
      http.get("/api/v1/integrations/jira", () => HttpResponse.json(
        jiraIntegration(syncRequested ? afterSync : beforeSync, syncRequested ? 2 : 1),
      )),
      http.get("/api/v1/jira/projects", () => HttpResponse.json(
        syncRequested
          ? [
              jiraProject("jp-1", "CORE", "Core Project"),
              jiraProject("jp-2", "OPS", "Operations"),
            ]
          : [jiraProject("jp-1", "CORE", "Core Project")],
      )),
      http.post("/api/v1/integrations/jira/jira-1/sync", () => {
        syncRequests += 1;
        syncRequested = true;
        return new HttpResponse(null, { status: 202 });
      }),
    );

    renderPage();

    expect(await screen.findByText("[CORE] Core Project")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Sync Jira Projects" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Jira projects synchronized successfully.");
    expect(screen.getByText("[OPS] Operations")).toBeVisible();
    expect(screen.getByRole("button", { name: "Sync Jira Projects" })).toBeEnabled();
    expect(syncRequests).toBe(1);
  });

  it("disables Jira actions while a sync request is pending", async () => {
    const user = userEvent.setup();
    const beforeSync = "2026-08-29T00:00:00Z";
    const afterSync = "2026-08-29T00:01:00Z";
    let syncCompleted = false;
    let releaseSync!: () => void;
    const syncGate = new Promise<void>((resolve) => {
      releaseSync = resolve;
    });

    server.use(
      http.get("/api/v1/integrations/github", () => HttpResponse.json(null)),
      http.get("/api/v1/repositories", () => HttpResponse.json([])),
      http.get("/api/v1/integrations/jira", () => HttpResponse.json(
        jiraIntegration(syncCompleted ? afterSync : beforeSync),
      )),
      http.get("/api/v1/jira/projects", () => HttpResponse.json([
        jiraProject("jp-1", "CORE", "Core Project"),
      ])),
      http.post("/api/v1/integrations/jira/jira-1/sync", async () => {
        await syncGate;
        syncCompleted = true;
        return new HttpResponse(null, { status: 202 });
      }),
    );

    renderPage();

    await screen.findByText("[CORE] Core Project");
    await user.click(screen.getByRole("button", { name: "Sync Jira Projects" }));

    expect(screen.getByRole("button", { name: "Syncing..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeDisabled();

    releaseSync();

    expect(await screen.findByRole("status")).toHaveTextContent("Jira projects synchronized successfully.");
  });

  it("shows a Jira sync request failure and restores the action", async () => {
    const user = userEvent.setup();

    server.use(
      http.get("/api/v1/integrations/github", () => HttpResponse.json(null)),
      http.get("/api/v1/repositories", () => HttpResponse.json([])),
      http.get("/api/v1/integrations/jira", () => HttpResponse.json(
        jiraIntegration("2026-08-29T00:00:00Z"),
      )),
      http.get("/api/v1/jira/projects", () => HttpResponse.json([])),
      http.post("/api/v1/integrations/jira/jira-1/sync", () => HttpResponse.json({
        type: "about:blank",
        title: "Provider unavailable",
        status: 502,
        detail: "Jira provider unavailable.",
        code: "PROVIDER_UNAVAILABLE",
        traceId: "trace-jira-sync",
      }, {
        status: 502,
        headers: { "content-type": "application/problem+json" },
      })),
    );

    renderPage();

    await user.click(await screen.findByRole("button", { name: "Sync Jira Projects" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Jira provider unavailable.");
    expect(screen.getByRole("button", { name: "Sync Jira Projects" })).toBeEnabled();
  });

  it("opens repository settings modal and allows saving new settings", async () => {
    const user = userEvent.setup();
    let savedSettings: Record<string, unknown> | undefined;
    let backfillRequests = 0;

    server.use(
      http.get("/api/v1/integrations/github", () => HttpResponse.json(null)),
      http.get("/api/v1/integrations/jira", () => HttpResponse.json(null)),
      http.get("/api/v1/repositories", () => {
        return HttpResponse.json([
          {
            id: "repo-1",
            workspaceId: "ws-1",
            githubIntegrationId: "gh-1",
            githubRepoId: 999,
            ownerLogin: "acme-org",
            name: "core-service",
            fullName: "acme-org/core-service",
            defaultBranch: "main",
            visibility: "PRIVATE",
            archived: false,
            trackingEnabled: true,
            settings: {
              deploymentSignal: "WORKFLOW_RUN",
              productionBranchPatterns: ["main"],
              productionEnvironmentPatterns: ["production"],
              deploymentWorkflowNamePatterns: ["*deploy*"],
              releaseTagPatterns: ["v*"],
              incidentSource: "BOTH",
              doraExclusions: [],
              defaultMetricGranularity: "WEEK",
              backfillDays: 90,
            },
            lastSyncedAt: new Date().toISOString(),
          },
        ]);
      }),
      http.get("/api/v1/jira/projects", () => HttpResponse.json([])),
      http.patch("/api/v1/repositories/repo-1", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        savedSettings = body.settings as Record<string, unknown>;
        return HttpResponse.json({
          id: "repo-1",
          workspaceId: "ws-1",
          githubIntegrationId: "gh-1",
          githubRepoId: 999,
          ownerLogin: "acme-org",
          name: "core-service",
          fullName: "acme-org/core-service",
          defaultBranch: "main",
          visibility: "PRIVATE",
          archived: false,
          trackingEnabled: true,
          settings: body.settings,
          lastSyncedAt: new Date().toISOString(),
        });
      }),
      http.post("/api/v1/repositories/repo-1/backfill", () => {
        backfillRequests += 1;
        return new HttpResponse(null, { status: 202 });
      })
    );

    renderPage();

    const rebuildBtn = await screen.findByRole("button", { name: "Rebuild DORA" });
    await user.click(rebuildBtn);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "DORA rebuild queued for acme-org/core-service.",
    );
    expect(backfillRequests).toBe(1);

    await user.click(screen.getByRole("button", { name: "Settings" }));
    const modalHeading = await screen.findByText("Repository Settings");
    const modal = modalHeading.closest(".modal-card");
    expect(modal).not.toBeNull();
    expect(within(modal as HTMLElement).queryByRole("button", { name: /Rebuild DORA/i }))
      .not.toBeInTheDocument();

    const signal = screen.getByRole("combobox", { name: "Deployment Signal Type" });
    const workflow = screen.getByRole("button", { name: "Deployment Workflow Name Patterns" });
    expect(workflow).toHaveAccessibleDescription(/workflow name.*not a job or step name/);
    const exampleToggle = screen.getByText("See example");
    const example = exampleToggle.closest("details");
    expect(example).not.toHaveAttribute("open");
    await user.click(exampleToggle);
    expect(example).toHaveAttribute("open");
    expect(example).toHaveTextContent(/name: CI.*job called deploy.*enter CI/);
    await user.click(exampleToggle);
    expect(example).not.toHaveAttribute("open");
    await user.click(screen.getByRole("button", { name: "Remove *deploy*" }));
    await user.click(workflow);
    await user.click(await screen.findByRole("checkbox", { name: "CI" }));
    await user.selectOptions(signal, "DEPLOYMENT");
    expect(screen.queryByRole("button", { name: "Deployment Workflow Name Patterns" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Production Branch Patterns" })).not.toBeInTheDocument();
    const environments = screen.getByRole("button", { name: "Production Environment Patterns" });
    expect(environments).toHaveAccessibleDescription(/environments.*production/);
    await user.click(environments);
    await user.click(await screen.findByRole("checkbox", { name: "live" }));

    // Exploring both signals keeps the repository's configured values intact.
    await user.selectOptions(signal, "WORKFLOW_RUN");
    expect(screen.getByRole("button", { name: "Remove CI" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove main" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Production Environment Patterns" })).not.toBeInTheDocument();
    await user.selectOptions(signal, "DEPLOYMENT");
    expect(screen.getByRole("button", { name: "Remove production" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove live" })).toBeInTheDocument();

    await user.clear(screen.getByLabelText("DORA Exclusions"));
    await user.type(screen.getByLabelText("DORA Exclusions"), "*preview*, *staging*");
    const saveBtn = screen.getByRole("button", { name: /Save Settings/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.queryByText("Repository Settings")).not.toBeInTheDocument();
    });
    expect(savedSettings?.deploymentSignal).toBe("DEPLOYMENT");
    expect(savedSettings?.productionBranchPatterns).toEqual(["main"]);
    expect(savedSettings?.deploymentWorkflowNamePatterns).toEqual(["CI"]);
    expect(savedSettings?.productionEnvironmentPatterns).toEqual(["production", "live"]);
    expect(savedSettings?.doraExclusions).toEqual(["*preview*", "*staging*"]);
    expect(backfillRequests).toBe(1);
  });

  it("renders tip for adding/removing repos and places deleted repositories at the bottom", async () => {
    server.use(
      http.get("/api/v1/integrations/github", () =>
        HttpResponse.json({
          id: "gh-1",
          workspaceId: "ws-1",
          installationId: 12345,
          accountLogin: "acme-org",
          accountType: "ORGANIZATION",
          repositorySelection: "ALL",
          status: "ACTIVE",
          lastSyncedAt: "2026-08-29T12:00:00Z",
          repositoryCount: 1,
        })
      ),
      http.get("/api/v1/integrations/jira", () => HttpResponse.json(null)),
      http.get("/api/v1/jira/projects", () => HttpResponse.json([])),
      http.get("/api/v1/repositories", () =>
        HttpResponse.json([
          {
            ...repository("repo-1", "zebra-service"),
            fullName: "acme-org/zebra-service",
            trackingEnabled: true,
            lastSyncedAt: "2026-08-29T12:00:00Z",
          },
          {
            ...repository("repo-2", "aaa-deleted-repo"),
            fullName: "acme-org/aaa-deleted-repo",
            trackingEnabled: false,
            lastSyncedAt: "2026-08-28T00:00:00Z",
          },
        ])
      ),
    );

    renderPage();

    expect(screen.getByText(/To add or remove repositories, update access in/)).toBeInTheDocument();
    expect(await screen.findByText("DELETED ON GITHUB")).toBeInTheDocument();

    const rows = screen.getAllByRole("row");
    // Row 0 is the table header; row 1 is zebra-service (active); row 2 is aaa-deleted-repo (deleted at bottom)
    expect(rows[1]).toHaveTextContent("acme-org/zebra-service");
    expect(rows[2]).toHaveTextContent("acme-org/aaa-deleted-repo");

    const checkboxes = screen.getAllByRole("checkbox");
    const deletedCheckbox = checkboxes[1];
    expect(deletedCheckbox).toBeDisabled();
    expect(deletedCheckbox).toHaveAttribute(
      "title",
      "Repository was deleted or removed on GitHub",
    );
  });

  it("confirms and releases when untracking a repository linked to an active project", async () => {
    const user = userEvent.setup();
    const patchCalled = vi.fn();
    server.use(
      http.get("/api/v1/integrations/github", () =>
        HttpResponse.json({
          id: "gh-1",
          workspaceId: "ws-1",
          installationId: 12345,
          accountLogin: "acme-org",
          accountType: "ORGANIZATION",
          repositorySelection: "ALL",
          status: "ACTIVE",
          lastSyncedAt: "2026-08-29T12:00:00Z",
          repositoryCount: 1,
        })
      ),
      http.get("/api/v1/integrations/jira", () => HttpResponse.json(null)),
      http.get("/api/v1/jira/projects", () => HttpResponse.json([])),
      http.get("/api/v1/repositories", () =>
        HttpResponse.json([
          {
            ...repository("repo-1", "zebra-service"),
            fullName: "acme-org/zebra-service",
            trackingEnabled: true,
            lastSyncedAt: "2026-08-29T12:00:00Z",
          },
        ])
      ),
      http.patch("/api/v1/repositories/repo-1", () => {
        patchCalled();
        return HttpResponse.json({
          ...repository("repo-1", "zebra-service"),
          fullName: "acme-org/zebra-service",
          trackingEnabled: false,
          lastSyncedAt: "2026-08-29T12:00:00Z",
        });
      })
    );

    const mockProject: ProjectResponse = {
      id: "project-1",
      name: "Alpha Project",
      workspaceId: "ws-1",
      repositories: [
        {
          id: "repo-1",
          fullName: "acme-org/zebra-service",
          archived: false,
          trackingEnabled: true,
          jiraProjects: [],
        },
      ],
      jiraProjects: [],
    };

    const { reload } = renderPage([mockProject]);

    const checkbox = await screen.findByRole("checkbox");
    expect(checkbox).toBeChecked();

    await user.click(checkbox);

    // Confirmation modal should appear listing Alpha Project
    expect(screen.getByRole("heading", { name: "Release Repository from Active Projects?" })).toBeInTheDocument();
    expect(screen.getByText("Alpha Project")).toBeInTheDocument();

    // Patch should not have been called yet
    expect(patchCalled).not.toHaveBeenCalled();

    // User cancels
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelBtn);

    expect(screen.queryByRole("heading", { name: "Release Repository from Active Projects?" })).not.toBeInTheDocument();
    expect(patchCalled).not.toHaveBeenCalled();

    // User clicks again and confirms
    await user.click(checkbox);
    const confirmBtn = screen.getByRole("button", { name: "Release & Untrack" });
    await user.click(confirmBtn);

    expect(patchCalled).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });

  it("confirms and releases when untracking a Jira project linked to an active project", async () => {
    const user = userEvent.setup();
    const putCalled = vi.fn();
    server.use(
      http.get("/api/v1/integrations/github", () => HttpResponse.json(null)),
      http.get("/api/v1/repositories", () => HttpResponse.json([])),
      http.get("/api/v1/integrations/jira", () => HttpResponse.json(jiraIntegration("2026-08-29T12:00:00Z"))),
      http.get("/api/v1/jira/projects", () =>
        HttpResponse.json([
          {
            ...jiraProject("jira-1", "JIRA-KEY", "Jira Test Project"),
            trackingEnabled: true,
          },
        ])
      ),
      http.patch("/api/v1/jira/projects/jira-1", () => {
        putCalled();
        return HttpResponse.json({
          ...jiraProject("jira-1", "JIRA-KEY", "Jira Test Project"),
          trackingEnabled: false,
        });
      })
    );

    const mockProject: ProjectResponse = {
      id: "project-1",
      name: "Beta Project",
      workspaceId: "ws-1",
      repositories: [],
      jiraProjects: [
        {
          id: "jira-1",
          projectKey: "JIRA-KEY",
          projectName: "Jira Test Project",
          trackingEnabled: true,
        },
      ],
    };

    const { reload } = renderPage([mockProject]);

    const checkbox = await screen.findByRole("checkbox");
    expect(checkbox).toBeChecked();

    await user.click(checkbox);

    // Confirmation modal should appear listing Beta Project
    expect(screen.getByRole("heading", { name: "Release Jira Project from Active Projects?" })).toBeInTheDocument();
    expect(screen.getByText("Beta Project")).toBeInTheDocument();

    // Put should not have been called yet
    expect(putCalled).not.toHaveBeenCalled();

    // User cancels
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelBtn);

    expect(screen.queryByRole("heading", { name: "Release Jira Project from Active Projects?" })).not.toBeInTheDocument();
    expect(putCalled).not.toHaveBeenCalled();

    // User clicks again and confirms
    await user.click(checkbox);
    const confirmBtn = screen.getByRole("button", { name: "Release & Untrack" });
    await user.click(confirmBtn);

    expect(putCalled).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });

  it("confirms and releases when disconnecting GitHub with repositories linked to an active project", async () => {
    const user = userEvent.setup();
    const deleteCalled = vi.fn();
    server.use(
      http.get("/api/v1/integrations/github", () =>
        HttpResponse.json({
          id: "gh-1",
          workspaceId: "ws-1",
          installationId: 12345,
          accountLogin: "acme-org",
          accountType: "ORGANIZATION",
          repositorySelection: "ALL",
          status: "ACTIVE",
          lastSyncedAt: "2026-08-29T12:00:00Z",
          repositoryCount: 1,
        })
      ),
      http.get("/api/v1/integrations/jira", () => HttpResponse.json(null)),
      http.get("/api/v1/jira/projects", () => HttpResponse.json([])),
      http.get("/api/v1/repositories", () =>
        HttpResponse.json([
          {
            ...repository("repo-1", "zebra-service"),
            fullName: "acme-org/zebra-service",
            trackingEnabled: true,
            lastSyncedAt: "2026-08-29T12:00:00Z",
          },
        ])
      ),
      http.delete("/api/v1/integrations/github/gh-1", () => {
        deleteCalled();
        return HttpResponse.json({});
      })
    );

    const mockProject: ProjectResponse = {
      id: "project-1",
      name: "Gamma Project",
      workspaceId: "ws-1",
      repositories: [
        {
          id: "repo-1",
          fullName: "acme-org/zebra-service",
          archived: false,
          trackingEnabled: true,
          jiraProjects: [],
        },
      ],
      jiraProjects: [],
    };

    const { reload } = renderPage([mockProject]);

    const disconnectBtn = await screen.findByRole("button", { name: "Disconnect" });
    await user.click(disconnectBtn);

    // Confirmation modal should appear listing Gamma Project
    expect(screen.getByRole("heading", { name: "Disconnect GitHub and Release Repositories?" })).toBeInTheDocument();
    expect(screen.getByText("Gamma Project")).toBeInTheDocument();

    expect(deleteCalled).not.toHaveBeenCalled();

    // User cancels
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelBtn);

    expect(screen.queryByRole("heading", { name: "Disconnect GitHub and Release Repositories?" })).not.toBeInTheDocument();
    expect(deleteCalled).not.toHaveBeenCalled();

    // User clicks again and confirms
    await user.click(disconnectBtn);
    const confirmBtn = screen.getByRole("button", { name: "Disconnect & Release" });
    await user.click(confirmBtn);

    expect(deleteCalled).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });

  it("confirms and releases when disconnecting Jira with Jira projects linked to an active project", async () => {
    const user = userEvent.setup();
    const deleteCalled = vi.fn();
    server.use(
      http.get("/api/v1/integrations/github", () => HttpResponse.json(null)),
      http.get("/api/v1/repositories", () => HttpResponse.json([])),
      http.get("/api/v1/integrations/jira", () => HttpResponse.json(jiraIntegration("2026-08-29T12:00:00Z"))),
      http.get("/api/v1/jira/projects", () =>
        HttpResponse.json([
          {
            ...jiraProject("jira-1", "JIRA-KEY", "Jira Test Project"),
            trackingEnabled: true,
          },
        ])
      ),
      http.delete("/api/v1/integrations/jira/jira-1", () => {
        deleteCalled();
        return HttpResponse.json({});
      })
    );

    const mockProject: ProjectResponse = {
      id: "project-1",
      name: "Delta Project",
      workspaceId: "ws-1",
      repositories: [],
      jiraProjects: [
        {
          id: "jira-1",
          projectKey: "JIRA-KEY",
          projectName: "Jira Test Project",
          trackingEnabled: true,
        },
      ],
    };

    const { reload } = renderPage([mockProject]);

    const disconnectBtn = await screen.findByRole("button", { name: "Disconnect" });
    await user.click(disconnectBtn);

    // Confirmation modal should appear listing Delta Project
    expect(screen.getByRole("heading", { name: "Disconnect Jira and Release Projects?" })).toBeInTheDocument();
    expect(screen.getByText("Delta Project")).toBeInTheDocument();

    expect(deleteCalled).not.toHaveBeenCalled();

    // User cancels
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelBtn);

    expect(screen.queryByRole("heading", { name: "Disconnect Jira and Release Projects?" })).not.toBeInTheDocument();
    expect(deleteCalled).not.toHaveBeenCalled();

    // User clicks again and confirms
    await user.click(disconnectBtn);
    const confirmBtn = screen.getByRole("button", { name: "Disconnect & Release" });
    await user.click(confirmBtn);

    expect(deleteCalled).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });

  it("disables tracking checkboxes when GitHub or Jira integration is not ACTIVE", async () => {
    server.use(
      http.get("/api/v1/integrations/github", () =>
        HttpResponse.json({
          id: "gh-1",
          workspaceId: "ws-1",
          installationId: 12345,
          accountLogin: "acme-org",
          accountType: "ORGANIZATION",
          repositorySelection: "ALL",
          status: "REVOKED",
          lastSyncedAt: "2026-08-29T00:00:00Z",
          repositoryCount: 1,
        })
      ),
      http.get("/api/v1/integrations/jira", () =>
        HttpResponse.json({
          ...jiraIntegration("2026-08-29T00:00:00Z"),
          status: "REVOKED",
        })
      ),
      http.get("/api/v1/jira/projects", () =>
        HttpResponse.json([jiraProject("jira-1", "JIRA-KEY", "Jira Test Project")])
      ),
      http.get("/api/v1/repositories", () =>
        HttpResponse.json([{
          ...repository("repo-1", "zebra-service"),
          lastSyncedAt: "2026-08-29T00:00:00Z",
        }])
      )
    );

    renderPage();

    const checkboxes = await screen.findAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);

    // Repo tracking checkbox
    expect(checkboxes[0]).toBeDisabled();
    expect(checkboxes[0]).toHaveAttribute("title", "Connect or reconnect GitHub App to track repositories");

    // Jira tracking checkbox
    expect(checkboxes[1]).toBeDisabled();
    expect(checkboxes[1]).toHaveAttribute("title", "Connect or reconnect Jira Cloud to track projects");
  });

  it("warns when attempting to track an unconfigured repository and dismisses the warning when clicking anywhere", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/api/v1/integrations/github", () =>
        HttpResponse.json({
          id: "gh-1",
          workspaceId: "ws-1",
          installationId: 12345,
          accountLogin: "acme-org",
          accountType: "ORGANIZATION",
          repositorySelection: "ALL",
          status: "ACTIVE",
          lastSyncedAt: "2026-08-29T12:00:00Z",
          repositoryCount: 1,
        })
      ),
      http.get("/api/v1/integrations/jira", () => HttpResponse.json(null)),
      http.get("/api/v1/jira/projects", () => HttpResponse.json([])),
      http.get("/api/v1/repositories", () =>
        HttpResponse.json([
          {
            ...repository("repo-1", "zebra-service"),
            trackingEnabled: false,
            lastSyncedAt: "2026-08-29T12:00:00Z",
            settings: {
              ...repository("repo-1", "zebra-service").settings,
              deploymentWorkflowNamePatterns: [],
            },
          },
        ])
      )
    );

    renderPage();

    const checkbox = await screen.findByRole("checkbox");
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    // Red warning tooltip appears above Settings button
    expect(
      screen.getByText(/in Settings before enabling tracking/i)
    ).toBeInTheDocument();

    // Clicking anywhere dismisses the warning tooltip
    await user.click(document.body);
    expect(
      screen.queryByText(/in Settings before enabling tracking/i)
    ).not.toBeInTheDocument();
  });
});
