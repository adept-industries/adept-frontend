/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Navigate } from "react-router";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { WorkspaceRoute } from "../auth/WorkspaceRoute";
import { RoleRoute } from "../auth/RoleRoute";
import { CheckEmailPage } from "../features/auth/pages/CheckEmailPage";
import { ForgotPasswordPage } from "../features/auth/pages/ForgotPasswordPage";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { ResetPasswordPage } from "../features/auth/pages/ResetPasswordPage";
import { SignupPage } from "../features/auth/pages/SignupPage";
import { VerifyEmailPage } from "../features/auth/pages/VerifyEmailPage";
import { SelectWorkspacePage } from "../features/workspaces/pages/SelectWorkspacePage";
import { WorkspaceSettingsPage } from "../features/workspaces/pages/WorkspaceSettingsPage";
import { AppShell } from "../components/layout/AppShell";
import { NotFoundPage } from "../components/ui/NotFoundPage";

/**
 * Dashboard — placeholder until Phase 3 content arrives.
 * Wrapped in AppShell which provides navigation/logout.
 */
function Dashboard() {
  return (
    <AppShell>
      <section aria-labelledby="dash-title" style={{ maxWidth: "600px", margin: "0 auto" }}>
        <p style={{ color: "#6b7280", fontSize: "0.8rem", marginBottom: "0.25rem" }}>Phase 2</p>
        <h1 id="dash-title" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Dashboard</h1>
        <p style={{ color: "#6b7280", marginTop: "0.5rem" }}>
          You are authenticated and in your workspace. More features arrive in Phase 3.
        </p>
      </section>
    </AppShell>
  );
}

/**
 * Router is created once outside React state to avoid recreation on re-renders.
 */
export const router = createBrowserRouter([
  // ── Public account pages ────────────────────────────────────────────────────
  { path: "/signup", element: <SignupPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/check-email", element: <CheckEmailPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/verify-email", element: <VerifyEmailPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },

  // ── Workspace selection ─────────────────────────────────────────────────────
  // Available in workspaceRequired state (ProtectedRoute allows it).
  {
    path: "/select-workspace",
    element: (
      <ProtectedRoute>
        <SelectWorkspacePage />
      </ProtectedRoute>
    ),
  },

  // ── Root redirect ────────────────────────────────────────────────────────────
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <WorkspaceRoute>
          <Navigate to="/dashboard" replace />
        </WorkspaceRoute>
      </ProtectedRoute>
    ),
  },

  // ── Protected dashboard ─────────────────────────────────────────────────────
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <WorkspaceRoute>
          <Dashboard />
        </WorkspaceRoute>
      </ProtectedRoute>
    ),
  },

  // ── Settings — MANAGER only ─────────────────────────────────────────────────
  {
    path: "/dashboard/settings",
    element: (
      <ProtectedRoute>
        <WorkspaceRoute>
          <RoleRoute role="MANAGER">
            <WorkspaceSettingsPage />
          </RoleRoute>
        </WorkspaceRoute>
      </ProtectedRoute>
    ),
  },

  // ── Catch-all ───────────────────────────────────────────────────────────────
  { path: "*", element: <NotFoundPage /> },
]);
