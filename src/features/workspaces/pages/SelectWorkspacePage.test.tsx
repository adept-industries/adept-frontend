// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../../auth/AuthContext.js";
import type { AuthState } from "../../../auth/types.js";
import { SelectWorkspacePage } from "./SelectWorkspacePage.js";

const accountUser = {
  id: "user-1",
  email: "user@example.com",
  displayName: "Test User",
  emailVerified: true,
  hasPassword: true,
};

const recoveredState: AuthState = {
  status: "authenticated",
  generation: 1,
  user: accountUser,
  currentMembership: {
    id: "membership-1",
    workspaceId: "workspace-1",
    workspaceName: "Recovered Workspace",
    workspaceSlug: "recovered-workspace-abc123",
    timezone: "UTC",
    role: "MANAGER",
  },
  workspaces: [{
    id: "workspace-1",
    name: "Recovered Workspace",
    slug: "recovered-workspace-abc123",
    timezone: "UTC",
    role: "MANAGER",
  }],
};

function renderEmptyWorkspaceSession(
  createWorkspace: AuthContextValue["actions"]["createWorkspace"],
) {
  const value: AuthContextValue = {
    state: {
      status: "workspaceRequired",
      user: accountUser,
      workspaces: [],
    },
    actions: { createWorkspace } as AuthContextValue["actions"],
  };
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={["/select-workspace"]}>
        <Routes>
          <Route path="/select-workspace" element={<SelectWorkspacePage />} />
          <Route path="/dashboard" element={<div>Dashboard reached</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("SelectWorkspacePage", () => {
  it("lets a signed-in account with no workspaces create one", async () => {
    const user = userEvent.setup();
    const createWorkspace = vi.fn().mockResolvedValue(recoveredState);
    renderEmptyWorkspaceSession(createWorkspace);

    expect(screen.getByText(/account is active, but it does not currently have a workspace/i))
      .toBeVisible();
    await user.type(screen.getByRole("textbox", { name: "Workspace name" }), "Recovered Workspace");
    await user.selectOptions(screen.getByRole("combobox", { name: "Timezone" }), "UTC");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    expect(createWorkspace).toHaveBeenCalledWith({
      name: "Recovered Workspace",
      timezone: "UTC",
    });
    expect(await screen.findByText("Dashboard reached")).toBeInTheDocument();
  });
});
