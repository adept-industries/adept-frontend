/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Navigate } from "react-router";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { WorkspaceRoute } from "../auth/WorkspaceRoute";
import { RoleRoute } from "../auth/RoleRoute";
import { PublicOnlyRoute } from "../auth/PublicOnlyRoute";
import { WorkspaceSelectionRoute } from "../auth/WorkspaceSelectionRoute";
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
import { captureActionToken, clearActionToken } from "../features/auth/actionTokenHandoff";
import { ProjectsPage } from "../features/projects/ProjectsPage";
import { useProjects } from "../features/projects/useProjects";

/**
 * Dashboard — placeholder until Phase 3 content arrives.
 * Wrapped in AppShell which provides navigation/logout.
 */
function Dashboard() {
  const { selectedProject, projects, error } = useProjects();
  return (
    <AppShell>
      <section aria-labelledby="dash-title" style={{ maxWidth: "600px", margin: "0 auto" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginBottom: "0.25rem" }}>Phase 2</p>
        <h1 id="dash-title" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Dashboard</h1>
        {error && <p role="alert">{error}</p>}
        {selectedProject ? (
          <>
            <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem" }}>
              Viewing <strong style={{ color: "var(--text-primary)" }}>{selectedProject.name}</strong>.
              DORA metrics will be filtered to this project&apos;s repositories.
            </p>
            <p>{selectedProject.repositories.length} linked repositories</p>
          </>
        ) : (
          <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem" }}>
            {projects.length === 0
              ? "No visible projects yet. A Manager can create one and attach repositories after GitHub synchronization."
              : "Select a project to filter this dashboard."}
          </p>
        )}
      </section>
    </AppShell>
  );
}

/**
 * Router is created once outside React state to avoid recreation on re-renders.
 */
export const router = createBrowserRouter([
  // ── Public account pages ────────────────────────────────────────────────────
  { path: "/signup", element: <PublicOnlyRoute><SignupPage /></PublicOnlyRoute> },
  { path: "/login", element: <PublicOnlyRoute><LoginPage /></PublicOnlyRoute> },
  { path: "/check-email", element: <CheckEmailPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  {
    path: "/verify-email",
    loader: () => { captureActionToken("verify-email"); return null; },
    element: <VerifyEmailPage />,
  },
  {
    path: "/reset-password",
    loader: () => { captureActionToken("reset-password"); return null; },
    element: <ResetPasswordPage />,
  },

  // ── Workspace selection ─────────────────────────────────────────────────────
  // Available in workspaceRequired state (ProtectedRoute allows it).
  {
    path: "/select-workspace",
    element: (
      <WorkspaceSelectionRoute>
        <SelectWorkspacePage />
      </WorkspaceSelectionRoute>
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
          <RoleRoute allowedRoles={["MANAGER"]}>
            <WorkspaceSettingsPage />
          </RoleRoute>
        </WorkspaceRoute>
      </ProtectedRoute>
    ),
  },

  {
    path: "/dashboard/projects",
    element: (
      <ProtectedRoute>
        <WorkspaceRoute>
          <RoleRoute allowedRoles={["MANAGER"]}>
            <ProjectsPage />
          </RoleRoute>
        </WorkspaceRoute>
      </ProtectedRoute>
    ),
  },

  // ── Catch-all ───────────────────────────────────────────────────────────────
  { path: "*", element: <NotFoundPage /> },
]);

router.subscribe((routerState) => {
  const activePath = routerState.navigation.location?.pathname ?? routerState.location.pathname;
  if (!["/verify-email", "/reset-password"].includes(activePath)) {
    clearActionToken();
  }
});
