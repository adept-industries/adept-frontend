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
    expect(within(banner).getByText("Adept")).toBeInTheDocument();
    expect(within(banner).getByText("v2.5 Live")).toBeInTheDocument();
    expect(screen.getByText(/Turn DevOps Signals into/i)).toBeInTheDocument();
    expect(screen.getByText("Unstoppable Engineering Velocity")).toBeInTheDocument();
    expect(screen.getByText("3.5")).toBeInTheDocument();
    expect(screen.getByText("Deployment Frequency")).toBeInTheDocument();
    expect(screen.getByText("Change Lead Time")).toBeInTheDocument();
    expect(screen.getByText("Recovery Time")).toBeInTheDocument();
    expect(screen.getByText("Change Failure Rate")).toBeInTheDocument();
  });

  it("shows Sign In and Deploy Free buttons in header for anonymous visitors", () => {
    renderLanding(false);

    const banner = screen.getByRole("banner");
    expect(within(banner).getByRole("link", { name: /^Sign In$/i })).toBeInTheDocument();
    expect(within(banner).getByRole("link", { name: /^Deploy Free/i })).toBeInTheDocument();
  });

  it("shows Console button in header for authenticated users", () => {
    renderLanding(true);

    const banner = screen.getByRole("banner");
    expect(within(banner).getByRole("link", { name: /^Console/i })).toBeInTheDocument();
  });

  it("renders ecosystem integrations, core value pillars, and ROI metrics", () => {
    renderLanding(false);

    // Integrations
    expect(screen.getByText("GitHub App")).toBeInTheDocument();
    expect(screen.getByText("Atlassian Jira")).toBeInTheDocument();

    // Value Pillars
    expect(screen.getByText("Zero-Secret-Leak Sync")).toBeInTheDocument();
    expect(screen.getByText("JIT-Fine Risk Engine")).toBeInTheDocument();
    expect(screen.getByText("Proactive SLA Governance")).toBeInTheDocument();
    expect(screen.getByText("Multi-Tenant Scoping")).toBeInTheDocument();

    // ROI Metrics
    expect(screen.getByText("4.2x")).toBeInTheDocument();
    expect(screen.getByText("Faster Deploy Cadence")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
    expect(screen.getByText("Shorter PR Review Latency")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("MTTR Reduction")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("Secrets Persisted")).toBeInTheDocument();

    // Bottom CTA & Footer
    expect(screen.getByText("Ready to Elevate Your Team’s Engineering Velocity?")).toBeInTheDocument();
    expect(screen.getByText(/Operational — Lightsail ap-south-1/i)).toBeInTheDocument();
  });
});
