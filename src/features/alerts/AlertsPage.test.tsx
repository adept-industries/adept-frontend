import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../auth/AuthContext.js";
import type { AuthenticatedState } from "../../auth/types.js";
import { ProjectContext } from "../projects/ProjectContext.js";
import { renderWithProviders } from "../../test/renderWithProviders.js";
import { server } from "../../test/server.js";
import { AlertsPage } from "./AlertsPage.js";
import type { AlertRuleResponse } from "./api.js";

const mockRepo = {
  id: "repo-1",
  workspaceId: "ws-1",
  githubIntegrationId: "gh-1",
  githubRepoId: 101,
  ownerLogin: "acme",
  name: "service-a",
  fullName: "acme/service-a",
  defaultBranch: "main",
  visibility: "PRIVATE" as const,
  trackingEnabled: true,
  archived: false,
  settings: {
    deploymentSignal: "WORKFLOW_RUN" as const,
    productionBranchPatterns: ["main"],
    productionEnvironmentPatterns: ["production"],
    deploymentWorkflowNamePatterns: ["deploy*"],
    incidentSource: "BOTH" as const,
    doraExclusions: [],
    defaultMetricGranularity: "WEEK" as const,
    backfillDays: 90,
  },
  lastSyncedAt: "2026-08-30T00:00:00Z",
};

const mockRule: AlertRuleResponse = {
  id: "rule-1",
  workspaceId: "ws-1",
  repositoryId: "repo-1",
  repositoryFullName: "acme/service-a",
  name: "High CFR Alert",
  metricType: "CHANGE_FAILURE_RATE_PERCENT",
  comparator: "GT",
  thresholdValue: 15.0,
  evaluationWindowMinutes: 1440,
  cooldownMinutes: 60,
  channel: "EMAIL",
  destination: "manager@example.com",
  enabled: true,
  createdAt: "2026-08-30T00:00:00Z",
  updatedAt: "2026-08-30T00:00:00Z",
};

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

function renderAlertsPage(role: "MANAGER" | "LEAD" = "MANAGER") {
  const state = authenticatedState(role);
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
        <AlertsPage />
      </ProjectContext.Provider>
    </AuthContext.Provider>
  );
}

describe("AlertsPage", () => {
  beforeEach(() => {
    document.cookie = "XSRF-TOKEN=test-csrf; Path=/";
    server.use(
      http.get("/api/v1/alert-rules", () => {
        return HttpResponse.json([mockRule]);
      }),
      http.get("/api/v1/repositories", () => {
        return HttpResponse.json([mockRepo]);
      })
    );
  });

  it("renders existing alert rules and filter toolbar", async () => {
    renderAlertsPage();

    expect(await screen.findByText("High CFR Alert")).toBeInTheDocument();
    expect(screen.getAllByText("acme/service-a").length).toBeGreaterThan(0);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("manager@example.com")).toBeInTheDocument();
  });

  it("creates an alert rule through the modal dialog", async () => {
    const user = userEvent.setup();
    let createdPayload: unknown = null;

    server.use(
      http.post("/api/v1/alert-rules", async ({ request }) => {
        createdPayload = await request.json();
        return HttpResponse.json({
          ...mockRule,
          id: "rule-2",
          name: "New Rule",
        }, { status: 201 });
      })
    );

    renderAlertsPage();

    const newBtn = await screen.findByRole("button", { name: "+ New Alert Rule" });
    await user.click(newBtn);

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Rule Name/i);
    await user.type(nameInput, "New Lead Time Alert");

    const submitBtn = screen.getByRole("button", { name: "Create Rule" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(createdPayload).toBeTruthy();
    });
    expect((createdPayload as { name: string }).name).toBe("New Lead Time Alert");
  });

  it("allows updating an existing alert rule", async () => {
    const user = userEvent.setup();
    let updatedPayload: unknown = null;

    server.use(
      http.patch("/api/v1/alert-rules/:id", async ({ request }) => {
        updatedPayload = await request.json();
        return HttpResponse.json({
          ...mockRule,
          name: "Updated Name",
        });
      })
    );

    renderAlertsPage();

    const editBtn = await screen.findByRole("button", { name: "Edit" });
    await user.click(editBtn);

    const nameInput = screen.getByLabelText(/Rule Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Name");

    const saveBtn = screen.getByRole("button", { name: "Save Changes" });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(updatedPayload).toBeTruthy();
    });
    expect((updatedPayload as { name: string }).name).toBe("Updated Name");
  });

  it("allows deleting an alert rule", async () => {
    const user = userEvent.setup();
    let deleted = false;
    vi.spyOn(window, "confirm").mockReturnValue(true);

    server.use(
      http.delete("/api/v1/alert-rules/:id", () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      })
    );

    renderAlertsPage();

    const deleteBtn = await screen.findByRole("button", { name: "Delete" });
    await user.click(deleteBtn);

    await waitFor(() => {
      expect(deleted).toBe(true);
    });
  });
});
