import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../../auth/AuthContext.js";
import type { AnonymousState, AuthState } from "../../../auth/types.js";
import { renderWithProviders } from "../../../test/renderWithProviders.js";
import { server } from "../../../test/server.js";
import { AcceptInvitePage } from "./AcceptInvitePage.js";

function anonymousState(): AnonymousState {
  return {
    status: "anonymous",
  };
}

function renderPage(
  initialPath = "/accept-invite#token=valid-token-123",
  state: AuthState = anonymousState()
) {
  const actions = {
    logout: vi.fn(),
  } as unknown as AuthContextValue["actions"];

  return renderWithProviders(
    <AuthContext.Provider value={{ state, actions }}>
      <AcceptInvitePage />
    </AuthContext.Provider>,
    { initialPath }
  );
}

describe("AcceptInvitePage", () => {
  beforeEach(() => {
    document.cookie = "XSRF-TOKEN=test-csrf; Path=/";
  });

  it("shows no-token error when accessed without token", async () => {
    // Reset window hash
    window.location.hash = "";
    window.location.search = "";

    renderPage("/accept-invite");

    expect(await screen.findByText(/No invitation token found/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Go to Sign in/i })).toBeInTheDocument();
  });

  it("displays preview data and completes new user acceptance flow", async () => {
    const user = userEvent.setup();
    window.location.hash = "#token=valid-token-123";

    let acceptCalledWith: Record<string, unknown> | null = null;

    server.use(
      http.get("/api/v1/invitations/preview", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("token")).toBe("valid-token-123");

        return HttpResponse.json({
          workspaceName: "Acme Platform",
          role: "LEAD",
          email: "lead.engineer@acme.com",
          repositories: ["acme/backend", "acme/frontend"],
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          existingAccount: false,
        });
      }),
      http.post("/api/v1/invitations/accept", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        acceptCalledWith = body;

        return HttpResponse.json({
          accessToken: "jwt-token-456",
          expiresInSeconds: 900,
          workspaceSelectionRequired: false,
          user: {
            id: "user-new",
            email: "lead.engineer@acme.com",
            displayName: "Jane Doe",
            emailVerified: true,
            hasPassword: true,
          },
          currentMembership: {
            id: "mem-lead",
            workspaceId: "ws-acme",
            workspaceName: "Acme Platform",
            workspaceSlug: "acme-platform",
            timezone: "UTC",
            role: "LEAD",
          },
          workspaces: [
            {
              id: "ws-acme",
              name: "Acme Platform",
              slug: "acme-platform",
              timezone: "UTC",
              role: "LEAD",
            },
          ],
        });
      })
    );

    renderPage();

    // Verify preview safe information is displayed
    expect(await screen.findByText("Join Workspace")).toBeInTheDocument();
    expect(screen.getByText("Acme Platform")).toBeInTheDocument();
    expect(screen.getByText("lead.engineer@acme.com")).toBeInTheDocument();
    expect(screen.getByText("acme/backend")).toBeInTheDocument();
    expect(screen.getByText("acme/frontend")).toBeInTheDocument();

    // Fill new user form
    const nameInput = screen.getByLabelText(/Your Name/i);
    const passwordInput = screen.getByLabelText(/^Create Password/i);
    const confirmInput = screen.getByLabelText(/Confirm Password/i);

    await user.type(nameInput, "Jane Doe");
    await user.type(passwordInput, "supersecretpass123");
    await user.type(confirmInput, "supersecretpass123");

    const submitBtn = screen.getByRole("button", { name: /Create Account & Join/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(acceptCalledWith).toEqual({
        token: "valid-token-123",
        displayName: "Jane Doe",
        password: "supersecretpass123",
      });
    });
  });

  it("handles existing user acceptance with password", async () => {
    const user = userEvent.setup();
    window.location.hash = "#token=existing-user-token";
    let acceptCalledWith: Record<string, unknown> | null = null;

    server.use(
      http.get("/api/v1/invitations/preview", () => {
        return HttpResponse.json({
          workspaceName: "Acme Platform",
          role: "LEAD",
          email: "existing.lead@acme.com",
          repositories: ["acme/backend"],
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          existingAccount: true,
        });
      }),
      http.post("/api/v1/invitations/accept", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        acceptCalledWith = body;

        return HttpResponse.json({
          accessToken: "jwt-token-789",
          expiresInSeconds: 900,
          workspaceSelectionRequired: false,
          user: {
            id: "user-existing",
            email: "existing.lead@acme.com",
            displayName: "Existing Lead",
            emailVerified: true,
            hasPassword: true,
          },
          currentMembership: {
            id: "mem-lead-2",
            workspaceId: "ws-acme",
            workspaceName: "Acme Platform",
            workspaceSlug: "acme-platform",
            timezone: "UTC",
            role: "LEAD",
          },
          workspaces: [
            {
              id: "ws-acme",
              name: "Acme Platform",
              slug: "acme-platform",
              timezone: "UTC",
              role: "LEAD",
            },
          ],
        });
      })
    );

    renderPage("/accept-invite#token=existing-user-token");

    expect(await screen.findByText(/An Adept account with email/i)).toBeInTheDocument();
    expect(screen.getAllByText("existing.lead@acme.com").length).toBeGreaterThanOrEqual(1);

    const passwordInput = screen.getByLabelText(/^Password/i);
    await user.type(passwordInput, "mypassword123");

    const submitBtn = screen.getByRole("button", { name: /Accept & Join Workspace/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(acceptCalledWith).toEqual({
        token: "existing-user-token",
        password: "mypassword123",
      });
    });
  });

  it("handles existing Google user without password by displaying Google sign-in option", async () => {
    window.location.hash = "#token=google-user-token";

    server.use(
      http.get("/api/v1/invitations/preview", () => {
        return HttpResponse.json({
          workspaceName: "Acme Platform",
          role: "LEAD",
          email: "google.lead@acme.com",
          repositories: ["acme/backend"],
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          existingAccount: true,
          hasPassword: false,
        });
      })
    );

    renderPage("/accept-invite#token=google-user-token");

    expect(await screen.findByText(/registered with Google/i)).toBeInTheDocument();
    expect(screen.getByText("Sign in with Google to Accept")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Password/i)).not.toBeInTheDocument();
  });

  it("allows currently signed-in Google user to accept without entering password", async () => {
    window.location.hash = "#token=google-user-token";

    let capturedBody: unknown = null;

    server.use(
      http.get("/api/v1/invitations/preview", () => {
        return HttpResponse.json({
          workspaceName: "Acme Platform",
          role: "LEAD",
          email: "google.lead@acme.com",
          repositories: ["acme/backend"],
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          existingAccount: true,
          hasPassword: false,
        });
      }),
      http.post("/api/v1/invitations/accept", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          kind: "authenticated",
          user: {
            id: "user-123",
            email: "google.lead@acme.com",
            displayName: "Google Lead",
            avatarUrl: null,
            status: "ACTIVE",
          },
          workspaces: [
            {
              id: "ws-1",
              name: "Acme Platform",
              slug: "acme-platform",
              role: "LEAD",
              status: "ACTIVE",
            },
          ],
          currentWorkspace: {
            id: "ws-1",
            name: "Acme Platform",
            slug: "acme-platform",
            role: "LEAD",
            status: "ACTIVE",
          },
          accessToken: "jwt-token-after-accept",
          expiresInSeconds: 900,
        });
      })
    );

    const loggedInState: AuthState = {
      status: "authenticated",
      user: {
        id: "user-123",
        email: "google.lead@acme.com",
        displayName: "Google Lead",
        emailVerified: true,
        hasPassword: false,
      },
      currentMembership: {
        id: "m-1",
        workspaceId: "personal-ws",
        workspaceSlug: "personal",
        workspaceName: "Personal",
        role: "MANAGER",
        timezone: "UTC",
      },
      workspaces: [],
      generation: 1,
    };

    renderPage("/accept-invite#token=google-user-token", loggedInState);

    expect(await screen.findByText(/You are currently signed in as/i)).toBeInTheDocument();
    const submitBtn = screen.getByRole("button", { name: /Accept & Join Workspace/i });
    expect(submitBtn).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(submitBtn);

    await waitFor(() => {
      expect(capturedBody).toEqual({
        token: "google-user-token",
      });
    });
  });

  it("renders expired invitation state when token is expired", async () => {
    window.location.hash = "#token=expired-token";

    server.use(
      http.get("/api/v1/invitations/preview", () => {
        return HttpResponse.json(
          {
            type: "https://adept.local/problems/invitation-expired",
            title: "Invitation expired",
            status: 410,
            detail: "This invitation link has expired.",
            instance: "/api/v1/invitations/preview",
            code: "INVITATION_EXPIRED",
            traceId: "trace-exp-1",
          },
          { status: 410, headers: { "Content-Type": "application/problem+json" } }
        );
      })
    );

    renderPage("/accept-invite#token=expired-token");

    expect(await screen.findByText("Invitation expired")).toBeInTheDocument();
    expect(screen.getByText(/This invitation link has expired/i)).toBeInTheDocument();
  });

  it("renders invalid invitation state when token is invalid or revoked", async () => {
    window.location.hash = "#token=invalid-token";

    server.use(
      http.get("/api/v1/invitations/preview", () => {
        return HttpResponse.json(
          {
            type: "https://adept.local/problems/invitation-invalid",
            title: "Invitation invalid",
            status: 400,
            detail: "This invitation is no longer pending.",
            instance: "/api/v1/invitations/preview",
            code: "INVITATION_INVALID",
            traceId: "trace-inv-1",
          },
          { status: 400, headers: { "Content-Type": "application/problem+json" } }
        );
      })
    );

    renderPage("/accept-invite#token=invalid-token");

    expect(await screen.findByText("Invalid invitation")).toBeInTheDocument();
    expect(screen.getByText(/This invitation is no longer pending/i)).toBeInTheDocument();
  });
});
