import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../auth/AuthContext.js";
import type { AuthenticatedState } from "../../auth/types.js";
import { renderWithProviders } from "../../test/renderWithProviders.js";
import { server } from "../../test/server.js";
import { ProjectIssuesSection } from "./ProjectIssuesSection.js";

const API = "/api/v1";

function authenticatedState(role: "MANAGER" | "LEAD"): AuthenticatedState {
  return {
    status: "authenticated",
    generation: 1,
    user: {
      id: "user-1",
      email: "user@example.com",
      displayName: "Test User",
      emailVerified: true,
      hasPassword: true,
    },
    currentMembership: {
      id: "membership-1",
      workspaceId: "workspace-1",
      workspaceName: "Adept",
      workspaceSlug: "adept-123",
      timezone: "UTC",
      role,
    },
    workspaces: [{
      id: "workspace-1",
      name: "Adept",
      slug: "adept-123",
      timezone: "UTC",
      role,
    }],
  };
}

function renderSection(role: "MANAGER" | "LEAD" = "MANAGER") {
  const actions = { logout: vi.fn() } as unknown as AuthContextValue["actions"];
  return renderWithProviders(
    <AuthContext.Provider value={{ state: authenticatedState(role), actions }}>
      <ProjectIssuesSection selectedProjectId="project-1" />
    </AuthContext.Provider>,
  );
}

const GITHUB_PAGE = {
  items: [{
    id: "github-issue-1",
    repositoryId: "repository-1",
    repositoryFullName: "adept-industries/adept-api",
    number: 75,
    title: "Protect project issue scope",
    authorLogin: "octocat",
    assigneeLogins: ["api-lead"],
    labels: ["bug", "backend"],
    commentsCount: 2,
    url: "https://github.com/adept-industries/adept-api/issues/75",
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
    updatedAt: new Date().toISOString(),
  }],
  page: 0,
  size: 10,
  totalElements: 1,
  totalPages: 1,
};

const JIRA_PAGE = {
  items: [{
    id: "jira-issue-1",
    jiraProjectId: "jira-project-1",
    jiraProjectKey: "ADEPT",
    jiraProjectName: "Adept Platform",
    issueKey: "ADEPT-42",
    summary: "Investigate production alert",
    issueType: "Bug",
    statusName: "In Progress",
    priorityName: "High",
    url: "https://adept.atlassian.net/browse/ADEPT-42",
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 3_600_000).toISOString(),
  }],
  page: 0,
  size: 10,
  totalElements: 1,
  totalPages: 1,
};

function issueHandlers() {
  return [
    http.get(`${API}/projects/:projectId/issues/github`, () => HttpResponse.json(GITHUB_PAGE)),
    http.get(`${API}/projects/:projectId/issues/jira`, () => HttpResponse.json(JIRA_PAGE)),
  ];
}

describe("ProjectIssuesSection", () => {
  it("separates GitHub and Jira issues and identifies their repository or Jira project", async () => {
    server.use(...issueHandlers());
    const user = userEvent.setup();

    renderSection();

    expect(await screen.findByRole("link", { name: /Protect project issue scope/ })).toHaveAttribute(
      "href",
      "https://github.com/adept-industries/adept-api/issues/75",
    );
    expect(screen.getByText("adept-industries/adept-api #75")).toBeVisible();
    expect(screen.getByText("Assigned to api-lead")).toBeVisible();

    await user.click(screen.getByRole("tab", { name: /Jira/ }));

    expect(await screen.findByRole("link", { name: /ADEPT-42: Investigate production alert/ })).toHaveAttribute(
      "href",
      "https://adept.atlassian.net/browse/ADEPT-42",
    );
    expect(screen.getByText("ADEPT — Adept Platform")).toBeVisible();
    expect(screen.getByText("In Progress")).toBeVisible();
    expect(screen.getByText("High")).toBeVisible();
  });

  it("allows only Managers to queue provider synchronization", async () => {
    document.cookie = "XSRF-TOKEN=test-csrf; Path=/";
    let syncCalls = 0;
    server.use(
      ...issueHandlers(),
      http.post(`${API}/projects/:projectId/issues/sync`, () => {
        syncCalls += 1;
        return HttpResponse.json({
          queuedGithubRepositories: 2,
          alreadyQueuedGithubRepositories: 0,
          queuedJiraIntegrations: 1,
          alreadyQueuedJiraIntegrations: 0,
        }, { status: 202 });
      }),
    );
    const user = userEvent.setup();

    renderSection("MANAGER");
    await user.click(await screen.findByRole("button", { name: "Sync issues" }));

    expect(await screen.findByRole("status")).toHaveTextContent("queued for 3 sources");
    expect(syncCalls).toBe(1);
  });

  it("keeps synchronization hidden from Leads while showing project Jira issues", async () => {
    server.use(...issueHandlers());
    const user = userEvent.setup();

    renderSection("LEAD");
    await user.click(await screen.findByRole("tab", { name: /Jira/ }));

    expect(await screen.findByText("ADEPT — Adept Platform")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Sync issues" })).not.toBeInTheDocument();
  });

  it("uses independent pagination for the active provider", async () => {
    const githubRequests: URL[] = [];
    server.use(
      http.get(`${API}/projects/:projectId/issues/github`, ({ request }) => {
        const url = new URL(request.url);
        githubRequests.push(url);
        const page = Number(url.searchParams.get("page"));
        return HttpResponse.json({
          ...GITHUB_PAGE,
          page,
          totalElements: 11,
          totalPages: 2,
          items: page === 0 ? GITHUB_PAGE.items : [{ ...GITHUB_PAGE.items[0], id: "github-issue-2", number: 76 }],
        });
      }),
      http.get(`${API}/projects/:projectId/issues/jira`, () => HttpResponse.json(JIRA_PAGE)),
    );
    const user = userEvent.setup();

    renderSection();
    await user.click(await screen.findByRole("button", { name: "Next" }));

    await waitFor(() => expect(githubRequests.at(-1)?.searchParams.get("page")).toBe("1"));
    expect(screen.getByText("Page 2 of 2")).toBeVisible();
  });

  it("keeps provider failures distinct from an empty issue list", async () => {
    server.use(
      http.get(`${API}/projects/:projectId/issues/github`, () =>
        HttpResponse.json({ detail: "GitHub issue service unavailable" }, { status: 503 })),
      http.get(`${API}/projects/:projectId/issues/jira`, () => HttpResponse.json(JIRA_PAGE)),
    );

    renderSection();

    expect(await screen.findByRole("alert")).toHaveTextContent("GitHub issues could not be loaded");
    expect(screen.queryByText("No open GitHub issues")).not.toBeInTheDocument();
  });
});
