// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { AuthContext, type AuthContextValue } from "../../../auth/AuthContext.js";
import { LoginPage } from "./LoginPage.js";

describe("LoginPage Google feedback", () => {
  it("explains an existing-email conflict without silently linking accounts", () => {
    const value: AuthContextValue = {
      state: { status: "anonymous" },
      actions: {} as AuthContextValue["actions"],
    };
    render(
      <AuthContext.Provider value={value}>
        <MemoryRouter initialEntries={["/login?google_error=account_exists"]}>
          <LoginPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(screen.getByText("An Adept account already uses this email. Sign in with your password.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Continue with Google" })).toHaveAttribute(
      "href",
      "/api/v1/auth/google/start",
    );
  });
});
