// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../auth/AuthContext.js";
import { OnboardingTour, OnboardingTourProvider } from "./OnboardingTour.js";

function TourHarness() {
  const location = useLocation();
  return <OnboardingTour pathname={location.pathname} />;
}

function renderTour(onboardingComplete: boolean) {
  const value: AuthContextValue = {
    state: {
      status: "authenticated",
      generation: 1,
      user: {
        id: "user-1",
        email: "new-user@example.com",
        displayName: "New User",
        emailVerified: true,
        hasPassword: true,
        onboardingComplete,
      },
      currentMembership: {
        id: "membership-1",
        workspaceId: "workspace-1",
        workspaceName: "Workspace",
        workspaceSlug: "workspace",
        timezone: "UTC",
        role: "MANAGER",
      },
      workspaces: [],
    },
    actions: { completeOnboarding: vi.fn() } as unknown as AuthContextValue["actions"],
  };

  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <OnboardingTourProvider>
          <div id="dash-title" />
          <div id="sidebar-nav-dashboard" />
          <div id="sidebar-nav-integrations" />
          <div id="connect-github-btn" />
          <div id="github-integration-card" />
          <TourHarness />
        </OnboardingTourProvider>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("OnboardingTour", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("prompts new users and starts the first step beside its page target", async () => {
    const user = userEvent.setup();
    renderTour(false);
    const dashboardNavItem = document.getElementById("sidebar-nav-dashboard");
    expect(dashboardNavItem).not.toBeNull();
    vi.spyOn(dashboardNavItem!, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 100, 40, 24));

    expect(await screen.findByRole("region", { name: "Getting started" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start tour" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Start on your dashboard, step 1 of 11" })).toBeInTheDocument();
    });
    expect(screen.getByRole("dialog")).toHaveStyle({ "--pointer-x": "106px" });

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog", { name: "Go to Integrations, step 2 of 11" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Connect GitHub and Jira, step 3 of 11" })).toBeInTheDocument();
    });
  });

  it("does not show the first-time prompt for completed accounts", () => {
    renderTour(true);

    expect(screen.queryByRole("region", { name: "Getting started" })).not.toBeInTheDocument();
  });
});
