import { describe, expect, it } from "vitest";
import { beforeEach } from "vitest";
import { accessTokenStore } from "./accessTokenStore";
import { workspacePreference } from "../lib/workspacePreference";
import {
  clearActionToken,
  captureActionToken,
  consumeActionToken,
  hasActionToken,
} from "../features/auth/actionTokenHandoff";

// ─── accessTokenStore ────────────────────────────────────────────────────────

describe("accessTokenStore", () => {
  it("stores and clears a token only in memory", () => {
    accessTokenStore.set("tok123");
    expect(accessTokenStore.get()).toBe("tok123");
    accessTokenStore.clear();
    expect(accessTokenStore.get()).toBeNull();
  });

  it("keeps only canonical workspace UUID preferences", () => {
    const canonical = "3b3448e9-5470-42a9-ab00-915fec326d97";
    workspacePreference.set(canonical);
    expect(workspacePreference.get()).toBe(canonical);

    localStorage.setItem("adept.currentWorkspaceId", canonical.toUpperCase());
    expect(workspacePreference.get()).toBeNull();
    expect(localStorage.getItem("adept.currentWorkspaceId")).toBeNull();
  });
});

// ─── actionTokenHandoff ───────────────────────────────────────────────────────

describe("actionTokenHandoff", () => {
  beforeEach(() => {
    clearActionToken();
  });

  it("consumes a token exactly once (StrictMode-safe)", () => {
    // Simulate a fragment present in the URL.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, hash: "#token=abc123", pathname: "/verify-email", search: "" },
    });

    captureActionToken("verify-email");
    expect(hasActionToken()).toBe(true);

    const first = consumeActionToken();
    expect(first).toBe("abc123");

    // Second call (StrictMode double-invoke) returns null.
    const second = consumeActionToken();
    expect(second).toBeNull();
  });
});

// ─── ProtectedRoute (basic guards) ───────────────────────────────────────────

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthContext } from "./AuthContext";
import type { AuthContextValue } from "./AuthContext";
import type { AuthState } from "./types";
import { ProtectedRoute } from "./ProtectedRoute";

function makeAuthCtx(status: AuthState["status"]): AuthContextValue {
  const state: AuthState =
    status === "authenticated"
      ? {
          status: "authenticated",
          user: { id: "u1", email: "a@b.com", displayName: "A", emailVerified: true, hasPassword: true },
          currentMembership: {
            id: "m1", workspaceId: "ws1", workspaceName: "W", workspaceSlug: "w-abc",
            timezone: "UTC", role: "MANAGER",
          },
          workspaces: [],
          generation: 1,
        }
      : status === "anonymous"
        ? { status: "anonymous" }
        : status === "workspaceRequired"
          ? { status: "workspaceRequired", user: { id: "u1", email: "a@b.com", displayName: "A", emailVerified: true, hasPassword: true }, workspaces: [] }
          : { status: "bootstrapping" };

  return {
    state,
    actions: {} as AuthContextValue["actions"],
  };
}

function renderRoute(authStatus: AuthState["status"]) {
  const ctx = makeAuthCtx(authStatus);
  return render(
    <AuthContext.Provider value={ctx}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/login" element={<div>Login</div>} />
          <Route path="/select-workspace" element={<div>Select</div>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Protected content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("ProtectedRoute", () => {
  it("renders children when authenticated", () => {
    renderRoute("authenticated");
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("redirects anonymous users to login", () => {
    renderRoute("anonymous");
    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("redirects workspaceRequired users to select-workspace", () => {
    renderRoute("workspaceRequired");
    expect(screen.getByText("Select")).toBeInTheDocument();
  });

  it("shows LoadingScreen during bootstrap", () => {
    renderRoute("bootstrapping");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
