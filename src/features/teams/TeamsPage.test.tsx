import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../auth/AuthContext.js";
import type { AuthenticatedState } from "../../auth/types.js";
import { ProjectContext } from "../projects/ProjectContext.js";
import type { ProjectResponse } from "../projects/api.js";
import { renderWithProviders } from "../../test/renderWithProviders.js";
import { server } from "../../test/server.js";
import { TeamsPage } from "./TeamsPage.js";
import type { ChatMessage, ProjectTeam } from "./types.js";

const mockProjects: ProjectResponse[] = [
  {
    id: "proj-1",
    workspaceId: "ws-1",
    name: "Platform Core",
    description: "Core backend services",
    repositories: [],
    jiraProjects: [],
  },
  {
    id: "proj-2",
    workspaceId: "ws-1",
    name: "Web Portal",
    description: "Customer portal app",
    repositories: [],
    jiraProjects: [],
  },
];

const mockTeam: ProjectTeam = {
  projectId: "proj-1",
  projectName: "Platform Core",
  projectDescription: "Core backend services",
  manager: {
    membershipId: "mem-mgr",
    userId: "user-1",
    displayName: "Alice Manager",
    email: "alice@example.com",
    role: "MANAGER",
  },
  members: [
    {
      membershipId: "mem-mgr",
      userId: "user-1",
      displayName: "Alice Manager",
      email: "alice@example.com",
      role: "MANAGER",
    },
    {
      membershipId: "mem-lead",
      userId: "user-2",
      displayName: "Bob Lead",
      email: "bob@example.com",
      role: "LEAD",
    },
  ],
};

const mockMessages: ChatMessage[] = [
  {
    id: "msg-1",
    projectId: "proj-1",
    content: "Welcome to Platform Core team chat!",
    createdAt: "2026-09-27T10:00:00Z",
    sender: {
      membershipId: "mem-mgr",
      userId: "user-1",
      displayName: "Alice Manager",
      email: "alice@example.com",
      role: "MANAGER",
    },
  },
];

function authenticatedState(role: "MANAGER" | "LEAD" = "MANAGER"): AuthenticatedState {
  return {
    status: "authenticated",
    generation: 1,
    user: {
      id: "user-1",
      email: "alice@example.com",
      displayName: "Alice Manager",
      emailVerified: true,
      hasPassword: true,
    },
    currentMembership: {
      id: "mem-mgr",
      workspaceId: "ws-1",
      workspaceName: "Acme Corp",
      workspaceSlug: "acme-corp",
      timezone: "UTC",
      role,
    },
    workspaces: [{ id: "ws-1", name: "Acme Corp", slug: "acme-corp", timezone: "UTC", role }],
  };
}

function renderTeamsPage(projects = mockProjects, role: "MANAGER" | "LEAD" = "MANAGER") {
  const state = authenticatedState(role);
  const actions = {
    logout: vi.fn(),
  } as unknown as AuthContextValue["actions"];

  return renderWithProviders(
    <AuthContext.Provider value={{ state, actions }}>
      <ProjectContext.Provider
        value={{
          projects,
          selectedProject: projects[0] ?? null,
          loading: false,
          error: null,
          select: vi.fn(),
          reload: vi.fn().mockResolvedValue(undefined),
        }}
      >
        <TeamsPage />
      </ProjectContext.Provider>
    </AuthContext.Provider>,
    { initialPath: "/dashboard/teams" },
  );
}

describe("TeamsPage", () => {
  beforeEach(() => {
    document.cookie = "XSRF-TOKEN=test-csrf; Path=/";
    server.use(
      http.get("/api/v1/projects/:projectId/team", () => {
        return HttpResponse.json(mockTeam);
      }),
      http.get("/api/v1/projects/:projectId/messages", () => {
        return HttpResponse.json(mockMessages);
      }),
      http.post("/api/v1/projects/:projectId/messages", async ({ request }) => {
        const body = (await request.json()) as { content: string };
        const newMsg: ChatMessage = {
          id: "msg-2",
          projectId: "proj-1",
          content: body.content,
          createdAt: new Date().toISOString(),
          sender: {
            membershipId: "mem-mgr",
            userId: "user-1",
            displayName: "Alice Manager",
            email: "alice@example.com",
            role: "MANAGER",
          },
        };
        return HttpResponse.json(newMsg, { status: 201 });
      }),
    );
  });

  it("renders teams sidebar and channels with project names", async () => {
    renderTeamsPage();

    expect(screen.getByRole("heading", { name: "Teams" })).toBeInTheDocument();
    const channelsSidebar = screen.getByLabelText("Team chats");
    expect(within(channelsSidebar).getByText("Platform Core")).toBeInTheDocument();
    expect(within(channelsSidebar).getByText("Web Portal")).toBeInTheDocument();
  });

  it("displays team members and roles in header", async () => {
    renderTeamsPage();

    await waitFor(() => {
      const membersChips = screen.getByLabelText("Team members");
      expect(within(membersChips).getByText("Alice Manager")).toBeInTheDocument();
      expect(within(membersChips).getByText("Bob Lead")).toBeInTheDocument();
    });
  });

  it("displays message history in chat pane", async () => {
    renderTeamsPage();

    await waitFor(() => {
      expect(
        screen.getByText("Welcome to Platform Core team chat!"),
      ).toBeInTheDocument();
    });
  });

  it("sends a new chat message when user submits form", async () => {
    const user = userEvent.setup();
    renderTeamsPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Message Platform Core/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Message Platform Core/i);
    await user.type(input, "Let us review PR #42 today");

    const sendBtn = screen.getByRole("button", { name: /Send/i });
    await user.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText("Let us review PR #42 today")).toBeInTheDocument();
    });
  });
});
