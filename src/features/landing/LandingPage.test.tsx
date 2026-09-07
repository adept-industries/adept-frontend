import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { LandingPage } from "./LandingPage";
import { AuthContext } from "../../auth/AuthContext";
import type { AuthContextValue } from "../../auth/AuthContext";

function renderLanding(authenticated = false) {
  const ctx: AuthContextValue = {
    state: authenticated
      ? {
          status: "authenticated",
          user: { id: "u1", email: "test@adept.dev", displayName: "Dev", emailVerified: true, hasPassword: true },
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

  return render(
    <AuthContext.Provider value={ctx}>
      <MemoryRouter initialEntries={["/"]}>
        <LandingPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("LandingPage", () => {
  it("renders brand header, hero headline, and DORA telemetry showcase", () => {
    renderLanding(false);

    const banner = screen.getByRole("banner");
    expect(within(banner).getByText("ADEPT")).toBeInTheDocument();
    expect(screen.getByText(/Turn DevOps Signals into Unstoppable/i)).toBeInTheDocument();
    expect(screen.getByText("18.4 / wk")).toBeInTheDocument();
    expect(screen.getByText("Deployment Frequency")).toBeInTheDocument();
    expect(screen.getByText("Mean Time to Recovery")).toBeInTheDocument();
  });

  it("shows Sign In and Get Started buttons in header for anonymous visitors", () => {
    renderLanding(false);

    const banner = screen.getByRole("banner");
    expect(within(banner).getByRole("link", { name: /^Sign In$/i })).toBeInTheDocument();
    expect(within(banner).getByRole("link", { name: /^Get Started/i })).toBeInTheDocument();
  });

  it("shows Console button in header for authenticated users", () => {
    renderLanding(true);

    const banner = screen.getByRole("banner");
    expect(within(banner).getByRole("link", { name: /^Console/i })).toBeInTheDocument();
  });

  it("renders feature bento cards and pricing sections", () => {
    renderLanding(false);

    expect(screen.getByText("Automated 4 DORA Metrics Calculation")).toBeInTheDocument();
    expect(screen.getByText("JIT-Fine PR Review Risk Engine")).toBeInTheDocument();
    expect(screen.getByText("Predictable Plans for")).toBeInTheDocument();
    expect(screen.getByText("Community")).toBeInTheDocument();
    expect(screen.getByText("Pro Team")).toBeInTheDocument();
  });
});
