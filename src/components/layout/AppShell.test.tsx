import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router";
import { AuthContext, type AuthContextValue } from "../../auth/AuthContext";
import { ProjectContext, type ProjectContextValue } from "../../features/projects/ProjectContext";
import { dashboardThemePreference } from "../../lib/dashboardThemePreference";
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
      hasPassword: true,
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

function renderShell(value: AuthContextValue = authValue) {
  return render(
    <AuthContext.Provider value={value}>
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

  it("starts dark and updates dynamically when theme preference changes", async () => {
    const { container } = renderShell();
    const shell = container.querySelector(".dashboard-shell");
    expect(shell).toHaveClass("dark-theme");

    dashboardThemePreference.set("light");
    await waitFor(() => {
      expect(shell).toHaveClass("light-theme");
    });
    expect(localStorage.getItem("adept.dashboardTheme")).toBe("light");
  });

  it("renders authenticated user displayName and initials in sidebar", () => {
    const { container } = renderShell();
    const userName = container.querySelector(".sidebar-user-name");
    const avatar = container.querySelector(".sidebar-avatar");
    expect(userName).toHaveTextContent("Manager");
    expect(avatar).toHaveTextContent("MA");
  });

  it("shows Manager navigation as one flat ordered list", () => {
    const { container } = renderShell();
    const navigation = screen.getByRole("navigation");

    expect(within(navigation).getAllByRole("link").map((link) => link.textContent?.trim())).toEqual([
      "Dashboard",
      "Integrations",
      "Projects",
      "Alerts",
      "Workspaces",
    ]);
    expect(container.querySelector(".sidebar-nav-divider")).not.toBeInTheDocument();
    expect(container.querySelector(".sidebar-nav-section-label")).not.toBeInTheDocument();
  });

  it("shows flat ordered Lead navigation without exposing Integrations", () => {
    const leadValue: AuthContextValue = {
      ...authValue,
      state: authValue.state.status === "authenticated"
        ? {
            ...authValue.state,
            currentMembership: {
              ...authValue.state.currentMembership,
              role: "LEAD",
            },
            workspaces: authValue.state.workspaces.map((workspace) => ({
              ...workspace,
              role: "LEAD" as const,
            })),
          }
        : authValue.state,
    };

    const { container } = renderShell(leadValue);
    const navigation = screen.getByRole("navigation");

    expect(within(navigation).getAllByRole("link").map((link) => link.textContent?.trim())).toEqual([
      "Dashboard",
      "Projects",
      "Alerts",
      "Workspaces",
    ]);
    expect(screen.queryByRole("link", { name: "Integrations" })).not.toBeInTheDocument();
    expect(container.querySelector(".sidebar-nav-divider")).not.toBeInTheDocument();
    expect(container.querySelector(".sidebar-nav-section-label")).not.toBeInTheDocument();
  });
});
