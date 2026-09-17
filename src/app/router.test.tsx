import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "./router";
import { AuthContext } from "../auth/AuthContext";
import type { AuthContextValue } from "../auth/AuthContext";
import { ProjectContext } from "../features/projects/ProjectContext";

type AuthTestState = "anonymous" | "authenticated" | "workspaceRequired";

function renderAppAt(path: string, authState: AuthTestState | boolean = "anonymous") {
  const normalizedState: AuthTestState =
    typeof authState === "boolean" ? (authState ? "authenticated" : "anonymous") : authState;

  const state =
    normalizedState === "authenticated"
      ? {
          status: "authenticated" as const,
          user: { id: "u1", email: "dev@adept.dev", displayName: "Dev", emailVerified: true, hasPassword: true },
          currentMembership: {
            id: "m1",
            workspaceId: "ws1",
            workspaceName: "Adept HQ",
            workspaceSlug: "adept-hq",
            timezone: "UTC",
            role: "MANAGER" as const,
          },
          workspaces: [{ id: "ws1", name: "Adept HQ", slug: "adept-hq", timezone: "UTC", role: "MANAGER" as const }],
          generation: 1,
        }
      : normalizedState === "workspaceRequired"
        ? {
            status: "workspaceRequired" as const,
            user: { id: "u1", email: "dev@adept.dev", displayName: "Dev", emailVerified: true, hasPassword: true },
            workspaces: [{ id: "ws1", name: "Adept HQ", slug: "adept-hq", timezone: "UTC", role: "MANAGER" as const }],
          }
        : { status: "anonymous" as const };

  const ctx: AuthContextValue = {
    state,
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
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={testQueryClient}>
      <AuthContext.Provider value={ctx}>
        <ProjectContext.Provider value={projectCtx}>
          <RouterProvider router={memoryRouter} />
        </ProjectContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("Root / routing", () => {
  it("renders LandingPage at / for anonymous visitors without redirecting to login", () => {
    renderAppAt("/", "anonymous");

    expect(screen.getByRole("heading", { level: 1, name: /Know what’s shipping/ })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /^Log In$/i })[0]).toBeInTheDocument();
  });

  it("redirects authenticated users from / to /dashboard", () => {
    renderAppAt("/", "authenticated");

    expect(screen.getByRole("heading", { level: 1, name: /^Dashboard$/i })).toBeInTheDocument();
  });

  it("renders LandingPage at /landing for authenticated visitors without redirecting", () => {
    renderAppAt("/landing", "authenticated");

    expect(screen.getByRole("heading", { level: 1, name: /Know what’s shipping/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("redirects users requiring workspace selection from / to /select-workspace", () => {
    renderAppAt("/", "workspaceRequired");

    expect(screen.getByRole("heading", { name: /Select workspace/i })).toBeInTheDocument();
  });
});
