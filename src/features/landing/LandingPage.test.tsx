import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  it("explains the product and renders the dashboard preview", () => {
    renderLanding();

    expect(screen.getByRole("heading", { level: 1, name: /Know what’s shipping.*See what needs attention/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Adept home" })).toHaveAttribute("href", "/");
    const preview = screen.getByRole("figure", { name: "Example dashboard" });
    for (const metric of ["Deployment Frequency", "Change Lead Time", "Recovery Time", "Change Failure Rate"]) {
      expect(within(preview).getByText(metric)).toBeInTheDocument();
    }
    expect(within(preview).getByText("14.5")).toBeInTheDocument();
    expect(within(preview).getByText("0.2h")).toBeInTheDocument();
    expect(within(preview).getByText("0.3h")).toBeInTheDocument();
    expect(within(preview).getByText("3.1%")).toBeInTheDocument();
    expect(within(preview).getAllByText(/Elite/i)).toHaveLength(4);
    expect(within(preview).getByText("All repositories")).toBeInTheDocument();
    expect(within(preview).getByRole("group", { name: "Time range" })).toBeInTheDocument();
    expect(within(preview).getByText("Last 7 Days")).toBeInTheDocument();
    expect(within(preview).getByText("Last 30 Days")).toBeInTheDocument();
    expect(within(preview).getByText("Last 90 Days")).toBeInTheDocument();
    expect(within(preview).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(preview).queryByRole("button", { name: "Last 30 Days" })).not.toBeInTheDocument();
    expect(screen.queryByText("Illustrative data, not live metrics")).not.toBeInTheDocument();
  });

  it("links anonymous visitors to login and signup", () => {
    renderLanding();

    expect(within(screen.getByRole("banner")).getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    const signupLinks = screen.getAllByRole("link", { name: "Create account" });
    expect(signupLinks).toHaveLength(2);
    for (const link of signupLinks) expect(link).toHaveAttribute("href", "/signup");
  });

  it("links existing users to their dashboard instead of signup", () => {
    renderLanding(true);

    expect(within(screen.getByRole("banner")).getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    for (const link of screen.getAllByRole("link", { name: "Open dashboard" })) {
      expect(link).toHaveAttribute("href", "/dashboard");
    }
    expect(screen.queryByRole("link", { name: "Create account" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  });

  it("only links to in-page sections that exist", () => {
    const { container } = renderLanding();

    for (const link of screen.getAllByRole("link")) {
      const href = link.getAttribute("href");
      if (href?.startsWith("#")) {
        expect(container.querySelector(href)).toBeInTheDocument();
      }
    }
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Footer navigation" })).toBeInTheDocument();
  });

  it("links to the Adept GitHub organization with proper attributes", () => {
    renderLanding();

    const githubLinks = screen.getAllByRole("link", { name: /Adept on GitHub/i });
    expect(githubLinks).toHaveLength(2);
    for (const link of githubLinks) {
      expect(link).toHaveAttribute("href", "https://github.com/adept-industries");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer");
    }
  });

  it("covers the actual features and the three setup steps", () => {
    renderLanding();

    for (const feature of ["Understand delivery", "Prioritize reviews", "Keep issues in view", "Set useful alerts"]) {
      expect(screen.getByRole("heading", { name: feature })).toBeInTheDocument();
    }
    const setup = screen.getByRole("region", { name: "Start with one project." });
    expect(within(setup).getAllByRole("listitem")).toHaveLength(3);
  });

  it("includes practical GitHub, Jira, deployment, risk, and access FAQs", () => {
    renderLanding();
    const faq = screen.getByRole("region", { name: "Common questions" });
    const questions = [
      "How do I connect GitHub?",
      "Can I use private GitHub repositories?",
      "Do I need to change my deployment workflow?",
      "Why aren’t there any DORA metrics yet?",
      "What does a pull request’s risk score mean?",
      "How does Jira work with Adept?",
      "Which repositories can my team see?",
    ];

    for (const question of questions) {
      const summary = within(faq).getByText(question);
      expect(summary.tagName).toBe("SUMMARY");
      expect(summary.closest("details")).not.toHaveAttribute("open");
    }
    expect(within(faq).getByText(/merging a PR alone does not create a deployment sample/)).toBeInTheDocument();
    expect(within(faq).getByText(/not proof of a bug, a security scan/)).toBeInTheDocument();
    expect(within(faq).getByText(/Jira is optional/)).toBeInTheDocument();
  });

  it("opens and closes FAQ answers without navigating away", async () => {
    const user = userEvent.setup();
    renderLanding();
    const summary = screen.getByText("How do I connect GitHub?");
    const details = summary.closest("details");

    await user.click(summary);
    expect(details).toHaveAttribute("open");
    await user.click(summary);
    expect(details).not.toHaveAttribute("open");
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("does not advertise trials, fabricated results, or unsupported integrations", () => {
    const { container } = renderLanding();

    expect(container).not.toHaveTextContent(/free trial|credit card|4\.2x|65%|85%|SLA governance|Slack|SAML|secrets persisted|connected & verified|operational —|REST \/ GraphQL/i);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
