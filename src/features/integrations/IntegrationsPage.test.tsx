import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../auth/AuthContext.js";
import type { AuthenticatedState } from "../../auth/types.js";
import { ProjectContext } from "../projects/ProjectContext.js";
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
        <IntegrationsPage />
      </ProjectContext.Provider>
    </AuthContext.Provider>
  );
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

    const settingsBtn = await screen.findByRole("button", { name: "Settings" });
    await user.click(settingsBtn);

    expect(await screen.findByText("Repository Settings")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Rebuild DORA Data" }));
    expect(await screen.findByRole("status")).toHaveTextContent("DORA data rebuild queued");
    expect(backfillRequests).toBe(1);

    await user.clear(screen.getByLabelText("DORA Exclusions"));
    await user.type(screen.getByLabelText("DORA Exclusions"), "*preview*, *staging*");
    const saveBtn = screen.getByRole("button", { name: /Save Settings/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.queryByText("Repository Settings")).not.toBeInTheDocument();
    });
    expect(savedSettings?.doraExclusions).toEqual(["*preview*", "*staging*"]);
  });
});
