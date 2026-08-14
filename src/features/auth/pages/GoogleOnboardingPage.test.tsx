// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ApiError, localProblem } from "../../../api/problem.js";
import { AuthContext, type AuthContextValue } from "../../../auth/AuthContext.js";
import type { AuthState } from "../../../auth/types.js";
import { GoogleOnboardingPage } from "./GoogleOnboardingPage.js";

const authenticatedState: AuthState = {
  status: "authenticated",
  generation: 1,
  user: { id: "u", email: "google@example.com", displayName: "Google User", emailVerified: true, hasPassword: false },
  currentMembership: {
    id: "m",
    workspaceId: "w",
    workspaceName: "Adept Team",
    workspaceSlug: "adept-team",
    timezone: "UTC",
    role: "MANAGER",
  },
  workspaces: [{ id: "w", name: "Adept Team", slug: "adept-team", timezone: "UTC", role: "MANAGER" }],
};

function renderPage(completeGoogleOnboarding: AuthContextValue["actions"]["completeGoogleOnboarding"]) {
  const value: AuthContextValue = {
    state: { status: "anonymous" },
    actions: { completeGoogleOnboarding } as AuthContextValue["actions"],
  };
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={["/google/onboarding"]}>
        <Routes>
          <Route path="/google/onboarding" element={<GoogleOnboardingPage />} />
          <Route path="/dashboard" element={<div>Dashboard reached</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("GoogleOnboardingPage", () => {
  it("creates the workspace and enters the authenticated app", async () => {
    const user = userEvent.setup();
    const complete = vi.fn().mockResolvedValue(authenticatedState);
    renderPage(complete);

    await user.type(screen.getByRole("textbox", { name: "Workspace name" }), "Adept Team");
    await user.selectOptions(screen.getByRole("combobox", { name: "Timezone" }), "UTC");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    expect(complete).toHaveBeenCalledWith({ workspaceName: "Adept Team", timezone: "UTC" });
    expect(await screen.findByText("Dashboard reached")).toBeInTheDocument();
  });

  it("offers a new Google attempt when the onboarding cookie expires", async () => {
    const user = userEvent.setup();
    const complete = vi.fn().mockRejectedValue(new ApiError(localProblem(
      401,
      "GOOGLE_SIGNUP_SESSION_INVALID",
      "Google signup expired",
      "Please start again.",
    )));
    renderPage(complete);

    await user.type(screen.getByRole("textbox", { name: "Workspace name" }), "Adept Team");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    expect(await screen.findByText("Your Google signup session expired. Start again with Google.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Start again with Google" })).toHaveAttribute(
      "href",
      "/api/v1/auth/google/start",
    );
  });
});
