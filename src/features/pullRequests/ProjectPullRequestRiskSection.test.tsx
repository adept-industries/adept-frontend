import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../auth/AuthContext.js";
import type { AuthenticatedState } from "../../auth/types.js";
import { renderWithProviders } from "../../test/renderWithProviders.js";
import { server } from "../../test/server.js";
import { ProjectPullRequestRiskSection } from "./ProjectPullRequestRiskSection.js";

const API = "/api/v1";

function authenticatedState(role: "MANAGER" | "LEAD" = "MANAGER"): AuthenticatedState {
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
      id: "mem-1",
      workspaceId: "ws-1",
      workspaceName: "Acme",
      workspaceSlug: "acme-abc123",
      timezone: "UTC",
      role,
    },
    workspaces: [{
      id: "ws-1",
      name: "Acme",
      slug: "acme-abc123",
      timezone: "UTC",
      role,
    }],
  };
}

function renderSection(role: "MANAGER" | "LEAD" = "MANAGER") {
  const actions = { logout: vi.fn() } as unknown as AuthContextValue["actions"];
  return renderWithProviders(
    <AuthContext.Provider value={{ state: authenticatedState(role), actions }}>
      <ProjectPullRequestRiskSection selectedProjectId="project-1" />
    </AuthContext.Provider>,
  );
}

const RISK_PAGE = {
  displayLabel: "Estimated review risk",
  disclaimer: "This score helps prioritize code review. It does not prove that the pull request contains a defect.",
  modelName: "jitfine-expert-pr-risk-mvp",
  modelVersion: "jitfine-expert-pr-risk-mvp-v1",
  featureSchemaVersion: "jitfine-pr-features-v1",
  stalledBefore: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  items: [
    {
      pullRequestId: "pr-1",
      repositoryId: "repo-1",
      repositoryFullName: "acme/api",
      number: 42,
      title: "Protect workspace authorization",
      draft: false,
      authorLogin: "octocat",
      url: "https://github.com/acme/api/pull/42",
      openedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
      stalled: true,
      riskScore: 0.62,
      riskLevel: "CRITICAL" as const,
      thresholdUsed: 0.4,
      topFactors: [
        { feature: "la", value: 180, globalImportance: 0.3, explanationType: "global_model_importance" },
        { feature: "nf", value: 12, globalImportance: 0.2, explanationType: "global_model_importance" },
      ],
      predictedAt: new Date().toISOString(),
    },
  ],
  page: 0,
  size: 10,
  totalElements: 1,
  totalPages: 1,
};

describe("ProjectPullRequestRiskSection", () => {
  it("shows project pull requests with their risk, stalled state, and safe model inputs", async () => {
    server.use(
      http.get(`${API}/projects/:projectId/pull-request-risks`, () => HttpResponse.json(RISK_PAGE)),
    );

    renderSection();

    expect(await screen.findByRole("link", { name: /Protect workspace authorization/ })).toHaveAttribute(
      "href",
      "https://github.com/acme/api/pull/42",
    );
    expect(screen.getByText("acme/api #42")).toBeVisible();
    expect(screen.getByText("Stalled")).toBeVisible();
    expect(screen.getByLabelText("critical risk, 62%")).toBeVisible();
    expect(screen.getByText(/Lines added: 180/)).toBeVisible();
    expect(screen.getByText(RISK_PAGE.disclaimer)).toBeVisible();
  });

  it("sends the selected stalled and risk filters to the API", async () => {
    const requests: URL[] = [];
    server.use(
      http.get(`${API}/projects/:projectId/pull-request-risks`, ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json({ ...RISK_PAGE, items: [], totalElements: 0, totalPages: 0 });
      }),
    );
    const user = userEvent.setup();

    renderSection();
    await screen.findByText("No scored open pull requests");
    await user.selectOptions(screen.getByLabelText("Risk"), "HIGH");
    await user.click(screen.getByRole("button", { name: "Stalled over 48 hours" }));

    await waitFor(() => {
      const latest = requests.at(-1)!;
      expect(latest.searchParams.get("riskLevel")).toBe("HIGH");
      expect(latest.searchParams.get("stalledOnly")).toBe("true");
      expect(latest.searchParams.get("page")).toBe("0");
    });
  });

  it("allows only Managers to queue scoring for existing open pull requests", async () => {
    document.cookie = "XSRF-TOKEN=test-csrf; Path=/";
    let rebuildCalls = 0;
    server.use(
      http.get(`${API}/projects/:projectId/pull-request-risks`, () =>
        HttpResponse.json({ ...RISK_PAGE, items: [], totalElements: 0, totalPages: 0 })),
      http.post(`${API}/projects/:projectId/pull-request-risks/rebuild`, () => {
        rebuildCalls += 1;
        return HttpResponse.json({
          modelVersion: "jitfine-expert-pr-risk-mvp-v1",
          queuedRepositories: 2,
          alreadyQueuedRepositories: 0,
        }, { status: 202 });
      }),
    );
    const user = userEvent.setup();

    renderSection("MANAGER");
    await user.click(await screen.findByRole("button", { name: "Score open PRs" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Risk scoring queued for 2 repositories");
    expect(rebuildCalls).toBe(1);
  });

  it("keeps the scoring action hidden from Leads", async () => {
    server.use(
      http.get(`${API}/projects/:projectId/pull-request-risks`, () => HttpResponse.json(RISK_PAGE)),
    );

    renderSection("LEAD");

    await screen.findByRole("link", { name: /Protect workspace authorization/ });
    expect(screen.queryByRole("button", { name: "Score open PRs" })).not.toBeInTheDocument();
  });

  it("keeps API failures distinct from an empty review queue", async () => {
    server.use(
      http.get(`${API}/projects/:projectId/pull-request-risks`, () =>
        HttpResponse.json({ detail: "Risk service unavailable" }, { status: 503 })),
    );

    renderSection();

    expect(await screen.findByRole("alert")).toHaveTextContent("Pull requests could not be loaded");
    expect(screen.queryByText("No scored open pull requests")).not.toBeInTheDocument();
  });
});
