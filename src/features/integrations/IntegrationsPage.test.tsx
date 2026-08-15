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
  });

  it("opens repository settings modal and allows saving new settings", async () => {
    const user = userEvent.setup();

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
            lastSyncedAt: new Date().toISOString(),
          },
        ]);
      }),
      http.get("/api/v1/jira/projects", () => HttpResponse.json([])),
      http.patch("/api/v1/repositories/repo-1", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
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
          trackingEnabled: false,
          settings: body.settings,
          lastSyncedAt: new Date().toISOString(),
        });
      })
    );

    renderPage();

    const settingsBtn = await screen.findByRole("button", { name: /Settings/i });
    await user.click(settingsBtn);

    expect(await screen.findByText("Repository Settings")).toBeInTheDocument();
    const saveBtn = screen.getByRole("button", { name: /Save Settings/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.queryByText("Repository Settings")).not.toBeInTheDocument();
    });
  });
});
