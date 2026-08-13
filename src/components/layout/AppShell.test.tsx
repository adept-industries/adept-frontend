import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router";
import { AuthContext, type AuthContextValue } from "../../auth/AuthContext";
import { ProjectContext, type ProjectContextValue } from "../../features/projects/ProjectContext";
import { AppShell } from "./AppShell";

const authValue: AuthContextValue = {
  state: {
    status: "authenticated",
    generation: 1,
    user: {
      id: "10000000-0000-0000-0000-000000000001",
      email: "manager@example.com",
      displayName: "Manager",
      emailVerified: true,
    },
    currentMembership: {
      id: "20000000-0000-0000-0000-000000000001",
      workspaceId: "30000000-0000-0000-0000-000000000001",
      workspaceName: "Workspace",
      workspaceSlug: "workspace",
      timezone: "UTC",
      role: "MANAGER",
    },
    workspaces: [{
      id: "30000000-0000-0000-0000-000000000001",
      name: "Workspace",
      slug: "workspace",
      timezone: "UTC",
      role: "MANAGER",
    }],
  },
  actions: {} as AuthContextValue["actions"],
};

const projectValue: ProjectContextValue = {
  projects: [],
  selectedProject: null,
  loading: false,
  error: null,
  select: () => undefined,
  reload: () => Promise.resolve(),
};

function renderShell() {
  return render(
    <AuthContext.Provider value={authValue}>
      <ProjectContext.Provider value={projectValue}>
        <MemoryRouter>
          <AppShell>Dashboard content</AppShell>
        </MemoryRouter>
      </ProjectContext.Provider>
    </AuthContext.Provider>,
  );
}

describe("AppShell theme", () => {
  beforeEach(() => {
    localStorage.removeItem("adept.dashboardTheme");
  });

  it("starts dark and persists light mode after toggling", async () => {
    const user = userEvent.setup();
    renderShell();

    const toggle = screen.getByRole("button", { name: "Switch to light mode" });
    const shell = toggle.closest(".dashboard-shell");
    expect(shell).toHaveClass("dark-theme");

    await user.click(toggle);

    expect(shell).toHaveClass("light-theme");
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
    expect(localStorage.getItem("adept.dashboardTheme")).toBe("light");
  });
});
