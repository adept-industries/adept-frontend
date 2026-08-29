import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../../auth/AuthContext.js";
import type { AuthenticatedState } from "../../../auth/types.js";
import { localProblem } from "../../../api/problem.js";
import { ProjectContext } from "../../projects/ProjectContext.js";
import { renderWithProviders } from "../../../test/renderWithProviders.js";
import { server } from "../../../test/server.js";
import { WorkspaceSettingsPage } from "./WorkspaceSettingsPage.js";

const workspace = {
  id: "ws-1",
  name: "Acme",
  slug: "acme-abc123",
  timezone: "UTC",
  role: "MANAGER" as const,
  membershipId: "mem-1",
};

function authenticatedState(hasPassword: boolean): AuthenticatedState {
  return {
    status: "authenticated",
    generation: 1,
    user: {
      id: "user-1",
      email: "manager@example.com",
      displayName: "Manager",
      emailVerified: true,
      hasPassword,
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

function renderPage(hasPassword: boolean, suppliedState?: AuthenticatedState) {
  const state = suppliedState ?? authenticatedState(hasPassword);
  const actions = {
    reauthenticateWithPassword: vi.fn().mockResolvedValue(state),
    selectWorkspace: vi.fn().mockResolvedValue(state),
    refresh: vi.fn().mockRejectedValue(new Error("no remaining workspace")),
    invalidateSession: vi.fn(),
    updateCurrentWorkspace: vi.fn(),
  } as unknown as AuthContextValue["actions"];

  renderWithProviders(
    <AuthContext.Provider value={{ state, actions }}>
      <ProjectContext.Provider value={{
        projects: [],
        selectedProject: null,
        loading: false,
        error: null,
        select: vi.fn(),
        reload: vi.fn().mockResolvedValue(undefined),
      }}>
        <WorkspaceSettingsPage />
      </ProjectContext.Provider>
    </AuthContext.Provider>,
    { initialPath: "/dashboard/settings" },
  );
  return actions;
}

function leadState(): AuthenticatedState {
  return {
    status: "authenticated",
    generation: 1,
    user: {
      id: "user-2",
      email: "lead@example.com",
      displayName: "Lead",
      emailVerified: true,
      hasPassword: true,
    },
    currentMembership: {
      id: "mem-2",
      workspaceId: "ws-2",
      workspaceName: "Delivery",
      workspaceSlug: "delivery-abc123",
      timezone: "UTC",
      role: "LEAD",
    },
    workspaces: [
      { id: "ws-1", name: "Personal", slug: "personal-abc123", timezone: "UTC", role: "MANAGER" },
      { id: "ws-2", name: "Delivery", slug: "delivery-abc123", timezone: "UTC", role: "LEAD" },
    ],
  };
}

async function openAndSubmitDeletion() {
  const user = userEvent.setup();
  await screen.findByRole("heading", { name: "Workspace Settings" });
  await user.click(screen.getByRole("button", { name: "Delete this workspace" }));
  fireEvent.change(screen.getByLabelText("Workspace slug"), {
    target: { value: workspace.slug },
  });
  await user.click(screen.getByRole("button", { name: "Confirm delete" }));
  return user;
}

describe("WorkspaceSettingsPage recent authentication", () => {
  afterEach(cleanup);

  beforeEach(() => {
    document.cookie = "XSRF-TOKEN=test-csrf; Path=/";
    server.use(
      http.get("/api/v1/workspaces/current", () => HttpResponse.json(workspace)),
    );
  });

  it("reauthenticates a password user and retries with only the confirmation slug", async () => {
    const deletionBodies: unknown[] = [];
    server.use(
      http.delete("/api/v1/workspaces/current", async ({ request }) => {
        deletionBodies.push(await request.json());
        if (deletionBodies.length === 1) {
          return HttpResponse.json(
            localProblem(403, "REAUTHENTICATION_REQUIRED", "Reauthentication required", "Verify again."),
            { status: 403, headers: { "content-type": "application/problem+json" } },
          );
        }
        return HttpResponse.json({ workspaceId: workspace.id, status: "DELETING" }, { status: 202 });
      }),
    );
    const actions = renderPage(true);
    const user = await openAndSubmitDeletion();

    const password = await screen.findByLabelText("Your current password");
    fireEvent.change(password, { target: { value: "Correct-password-123!" } });
    await user.click(screen.getByRole("button", { name: "Verify and delete" }));

    await waitFor(() => expect(actions.reauthenticateWithPassword).toHaveBeenCalledWith({
      password: "Correct-password-123!",
    }));
    await waitFor(() => expect(deletionBodies).toEqual([
      { confirmationSlug: workspace.slug },
      { confirmationSlug: workspace.slug },
    ]));
  });

  it("offers Google verification to a Google-only user", async () => {
    server.use(
      http.delete("/api/v1/workspaces/current", () => HttpResponse.json(
        localProblem(403, "REAUTHENTICATION_REQUIRED", "Reauthentication required", "Verify again."),
        { status: 403, headers: { "content-type": "application/problem+json" } },
      )),
    );
    renderPage(false);
    await openAndSubmitDeletion();

    expect(await screen.findByRole("button", { name: "Verify with Google" })).toBeVisible();
    expect(screen.queryByLabelText("Your current password")).not.toBeInTheDocument();
  });
});

describe("WorkspaceSettingsPage role-aware workspace access", () => {
  afterEach(cleanup);

  beforeEach(() => {
    document.cookie = "XSRF-TOKEN=test-csrf; Path=/";
  });

  it("shows every workspace membership and lets a Manager switch workspace", async () => {
    const state = authenticatedState(true);
    state.workspaces = [
      ...state.workspaces,
      { id: "ws-2", name: "Delivery", slug: "delivery-abc123", timezone: "UTC", role: "LEAD" },
    ];
    server.use(
      http.get("/api/v1/workspaces/current", () => HttpResponse.json(workspace)),
    );

    const actions = renderPage(true, state);
    const memberships = await screen.findByRole("list", { name: "Workspace memberships" });

    expect(within(memberships).getByText("Acme")).toBeVisible();
    expect(within(memberships).getByText("Manager")).toBeVisible();
    expect(within(memberships).getByText("Delivery")).toBeVisible();
    expect(within(memberships).getByText("Lead")).toBeVisible();
    const generalSettingsHeading = await screen.findByRole("heading", { name: "General Settings" });
    const createWorkspaceHeading = screen.getByRole("heading", { name: "Create another workspace" });
    const workspaceMembershipsHeading = screen.getByRole("heading", { name: "Your workspaces" });
    expect(createWorkspaceHeading.compareDocumentPosition(workspaceMembershipsHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(workspaceMembershipsHeading.compareDocumentPosition(generalSettingsHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(document.getElementById("settings-theme-toggle-btn")).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Switch to Delivery" }));
    expect(actions.selectWorkspace).toHaveBeenCalledWith("ws-2");
  });

  it("lets a Lead create a workspace without exposing Manager settings", async () => {
    const state = leadState();
    let currentSettingsRequested = false;
    server.use(
      http.get("/api/v1/workspaces/current", () => {
        currentSettingsRequested = true;
        return HttpResponse.json(workspace);
      }),
      http.post("/api/v1/workspaces", () => HttpResponse.json({
        id: "ws-created",
        name: "Lead Owned",
        slug: "lead-owned-abc123",
        timezone: "UTC",
        role: "MANAGER",
      }, { status: 201 })),
    );

    const actions = renderPage(true, state);
    const memberships = await screen.findByRole("list", { name: "Workspace memberships" });
    expect(within(memberships).getByText("Delivery")).toBeVisible();
    expect(within(memberships).getByText("Lead")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "General Settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Danger Zone" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Workspace name" })).not.toBeInTheDocument();

    const user = userEvent.setup();
    const createButton = screen.getByRole("button", { name: "Create workspace" });
    expect(createButton).toHaveAttribute("aria-expanded", "false");
    await user.click(createButton);
    expect(screen.getByRole("button", { name: "Collapse workspace" })).toHaveAttribute("aria-expanded", "true");
    await user.type(screen.getByRole("textbox", { name: "Workspace name" }), "Lead Owned");
    await user.click(screen.getByRole("button", { name: "Create and switch" }));

    await waitFor(() => expect(actions.selectWorkspace).toHaveBeenCalledWith("ws-created"));
    expect(currentSettingsRequested).toBe(false);
  });
});
