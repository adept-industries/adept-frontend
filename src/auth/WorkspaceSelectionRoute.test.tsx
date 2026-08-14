import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { AuthContext, type AuthContextValue } from "./AuthContext.js";
import { WorkspaceSelectionRoute } from "./WorkspaceSelectionRoute.js";

describe("WorkspaceSelectionRoute", () => {
  it("renders the selector for a workspace-required session", () => {
    const value: AuthContextValue = {
      state: {
        status: "workspaceRequired",
        user: { id: "u", email: "u@example.com", displayName: "U", emailVerified: true, hasPassword: true },
        workspaces: [],
      },
      actions: {} as AuthContextValue["actions"],
    };
    render(
      <AuthContext.Provider value={value}>
        <MemoryRouter>
          <WorkspaceSelectionRoute><div>Choose a workspace</div></WorkspaceSelectionRoute>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.getByText("Choose a workspace")).toBeInTheDocument();
  });
});
