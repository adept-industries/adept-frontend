import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router";
import { router } from "./router";
import { AuthContext } from "../auth/AuthContext";
import type { AuthContextValue } from "../auth/AuthContext";
import { ProjectContext } from "../features/projects/ProjectContext";

function renderAppAt(path: string, authenticated = false) {
  const ctx: AuthContextValue = {
    state: authenticated
      ? {
          status: "authenticated",
          user: { id: "u1", email: "dev@adept.dev", displayName: "Dev", emailVerified: true, hasPassword: true },
          currentMembership: {
            id: "m1",
            workspaceId: "ws1",
            workspaceName: "Adept HQ",
            workspaceSlug: "adept-hq",
            timezone: "UTC",
            role: "MANAGER",
          },
          workspaces: [],
          generation: 1,
        }
      : { status: "anonymous" },
    actions: {} as AuthContextValue["actions"],
  };

  const projectCtx = {
    projects: [],
    selectedProject: null,
    loading: false,
    error: null,
    select: () => {},
    reload: async () => {},
  };

  const memoryRouter = createMemoryRouter(router.routes, { initialEntries: [path] });

  return render(
    <AuthContext.Provider value={ctx}>
      <ProjectContext.Provider value={projectCtx}>
        <RouterProvider router={memoryRouter} />
      </ProjectContext.Provider>
    </AuthContext.Provider>,
  );
}

describe("Root / routing", () => {
  it("renders LandingPage at / for anonymous visitors without redirecting to login", () => {
    renderAppAt("/", false);

    expect(screen.getByText(/Turn DevOps Signals into/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /^Sign In$/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /^Deploy Free/i })[0]).toBeInTheDocument();
  });

  it("renders LandingPage at / for authenticated users without forcing redirect to dashboard", () => {
    renderAppAt("/", true);

    expect(screen.getByText(/Turn DevOps Signals into/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Console/i })).toBeInTheDocument();
  });
});
