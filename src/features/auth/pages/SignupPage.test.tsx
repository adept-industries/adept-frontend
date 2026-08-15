// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../../auth/AuthContext.js";
import { SignupPage } from "./SignupPage.js";

describe("SignupPage", () => {
  afterEach(() => {
    cleanup();
  });
  it("renders both Password and Confirm password fields", () => {
    const value: AuthContextValue = {
      state: { status: "anonymous" },
      actions: {
        signup: vi.fn(),
      } as unknown as AuthContextValue["actions"],
    };

    render(
      <AuthContext.Provider value={value}>
        <MemoryRouter>
          <SignupPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Confirm password/i)).toBeInTheDocument();
  });

  it("shows an error when passwords do not match", async () => {
    const user = userEvent.setup();
    const signupMock = vi.fn();
    const value: AuthContextValue = {
      state: { status: "anonymous" },
      actions: {
        signup: signupMock,
      } as unknown as AuthContextValue["actions"],
    };

    render(
      <AuthContext.Provider value={value}>
        <MemoryRouter>
          <SignupPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    await user.type(screen.getByLabelText(/^Work email/i), "user@example.com");
    await user.type(screen.getByLabelText(/^Full name/i), "Jane Doe");
    await user.type(screen.getByLabelText(/^Workspace name/i), "Acme");
    await user.type(screen.getByLabelText(/^Password/i), "securepassword123");
    await user.type(screen.getByLabelText(/^Confirm password/i), "differentpassword");

    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
    expect(signupMock).not.toHaveBeenCalled();
  });

  it("shows an error when password is too short", async () => {
    const user = userEvent.setup();
    const signupMock = vi.fn();
    const value: AuthContextValue = {
      state: { status: "anonymous" },
      actions: {
        signup: signupMock,
      } as unknown as AuthContextValue["actions"],
    };

    render(
      <AuthContext.Provider value={value}>
        <MemoryRouter>
          <SignupPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    await user.type(screen.getByLabelText(/^Work email/i), "user@example.com");
    await user.type(screen.getByLabelText(/^Full name/i), "Jane Doe");
    await user.type(screen.getByLabelText(/^Workspace name/i), "Acme");
    await user.type(screen.getByLabelText(/^Password/i), "short");
    await user.type(screen.getByLabelText(/^Confirm password/i), "short");

    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Password must be at least 12 characters.")).toBeInTheDocument();
    expect(signupMock).not.toHaveBeenCalled();
  });

  it("submits the form when passwords match and meet requirements", async () => {
    const user = userEvent.setup();
    const signupMock = vi.fn().mockResolvedValue({
      status: "authenticated",
      workspace: { id: "ws-1", name: "Acme", slug: "acme" },
    });
    const value: AuthContextValue = {
      state: { status: "anonymous" },
      actions: {
        signup: signupMock,
      } as unknown as AuthContextValue["actions"],
    };

    render(
      <AuthContext.Provider value={value}>
        <MemoryRouter>
          <SignupPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    await user.type(screen.getByLabelText(/^Work email/i), "user@example.com");
    await user.type(screen.getByLabelText(/^Full name/i), "Jane Doe");
    await user.type(screen.getByLabelText(/^Workspace name/i), "Acme");
    await user.type(screen.getByLabelText(/^Password/i), "securepassword123");
    await user.type(screen.getByLabelText(/^Confirm password/i), "securepassword123");

    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(signupMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@example.com",
        password: "securepassword123",
        displayName: "Jane Doe",
        workspaceName: "Acme",
      }),
    );
  });
});
