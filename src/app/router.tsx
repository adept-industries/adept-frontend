/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Navigate } from "react-router";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { WorkspaceRoute } from "../auth/WorkspaceRoute";
import { RoleRoute } from "../auth/RoleRoute";
import { PublicOnlyRoute } from "../auth/PublicOnlyRoute";
import { WorkspaceSelectionRoute } from "../auth/WorkspaceSelectionRoute";
import { CheckEmailPage } from "../features/auth/pages/CheckEmailPage";
import { ForgotPasswordPage } from "../features/auth/pages/ForgotPasswordPage";
import { GoogleOnboardingPage } from "../features/auth/pages/GoogleOnboardingPage";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { ResetPasswordPage } from "../features/auth/pages/ResetPasswordPage";
import { SignupPage } from "../features/auth/pages/SignupPage";
import { VerifyEmailPage } from "../features/auth/pages/VerifyEmailPage";
import { SelectWorkspacePage } from "../features/workspaces/pages/SelectWorkspacePage";
import { WorkspaceSettingsPage } from "../features/workspaces/pages/WorkspaceSettingsPage";
import { AppShell } from "../components/layout/AppShell";
import { NotFoundPage } from "../components/ui/NotFoundPage";
import { captureActionToken, clearActionToken } from "../features/auth/actionTokenHandoff";
import { AcceptInvitePage } from "../features/auth/pages/AcceptInvitePage";
import { IntegrationsPage } from "../features/integrations/IntegrationsPage";
import { ProjectsPage } from "../features/projects/ProjectsPage";
import { AlertsPage } from "../features/alerts/AlertsPage";
import { useProjects } from "../features/projects/useProjects";
import { DoraMetricsSection } from "../features/metrics/DoraMetricsSection";
import { ProjectPullRequestRiskSection } from "../features/pullRequests/ProjectPullRequestRiskSection";
import { ProjectIssuesSection } from "../features/issues/ProjectIssuesSection";

import { useContext } from "react";
import { AuthContext } from "../auth/AuthContext";
import { WorkspaceSwitcher } from "../features/workspaces/WorkspaceSwitcher";
import { ProjectSelector } from "../features/projects/ProjectSelector";

/**
 * Dashboard with scoped DORA metrics and project context.
 * Wrapped in AppShell which provides the floating sidebar navigation.
 */
function Dashboard() {
  const { selectedProject, projects, error } = useProjects();
  const ctx = useContext(AuthContext);
  const authenticatedState = ctx?.state.status === "authenticated" ? ctx.state : null;



  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <AppShell>
      {/* Welcome header with inline controls */}
      <div className="dash-header-row">
        <div className="dash-welcome">
          <p className="dash-welcome-eyebrow">{dateStr}</p>
          <h1 id="dash-title" className="dash-welcome-title">Dashboard</h1>
          <p className="dash-welcome-sub">
            {selectedProject
              ? <>Viewing <strong style={{ color: "var(--text-primary)" }}>{selectedProject.name}</strong> — DORA metrics filtered to this project.</>
              : projects.length > 0
                ? "Select a project to filter this dashboard."
                : "Welcome! Get started by creating a project and connecting your repositories."}
          </p>
        </div>

        {authenticatedState && (
            <div className="dash-inline-controls">
              <WorkspaceSwitcher
                workspaces={authenticatedState.workspaces}
                currentWorkspaceId={authenticatedState.currentMembership.workspaceId}
              />
              <div className="topbar-divider" aria-hidden="true" />
              <ProjectSelector />
            </div>
        )}
      </div>

      {error && <p role="alert" style={{ color: "var(--danger-color)", marginBottom: "1rem" }}>{error}</p>}

      {/* DORA Metrics Section */}
      <DoraMetricsSection
        selectedProjectId={selectedProject?.id ?? null}
        repositories={selectedProject?.repositories.filter(
          (repository) => repository.trackingEnabled && !repository.archived,
        ) ?? []}
      />

      {/* Open pull requests, scoped by the API to the current Manager or Lead. */}
      <ProjectPullRequestRiskSection selectedProjectId={selectedProject?.id ?? null} />

      {/* Provider issues use the same Manager/Lead project scope enforced by the API. */}
      <ProjectIssuesSection selectedProjectId={selectedProject?.id ?? null} />
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
  { path: "/google/onboarding", element: <PublicOnlyRoute><GoogleOnboardingPage /></PublicOnlyRoute> },
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
  {
    path: "/accept-invite",
    loader: () => { captureActionToken("accept-invite"); return null; },
    element: <AcceptInvitePage />,
  },
  {
    path: "/invitations/accept",
    loader: () => { captureActionToken("accept-invite"); return null; },
    element: <AcceptInvitePage />,
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

  // ── Workspaces — role-aware settings ────────────────────────────────────────
  {
    path: "/dashboard/settings",
    element: (
      <ProtectedRoute>
        <WorkspaceRoute>
          <RoleRoute allowedRoles={["MANAGER", "LEAD"]}>
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
          <RoleRoute allowedRoles={["MANAGER", "LEAD"]}>
            <ProjectsPage />
          </RoleRoute>
        </WorkspaceRoute>
      </ProtectedRoute>
    ),
  },

  {
    path: "/dashboard/alerts",
    element: (
      <ProtectedRoute>
        <WorkspaceRoute>
          <RoleRoute allowedRoles={["MANAGER", "LEAD"]}>
            <AlertsPage />
          </RoleRoute>
        </WorkspaceRoute>
      </ProtectedRoute>
    ),
  },

  {
    path: "/dashboard/integrations",
    element: (
      <ProtectedRoute>
        <WorkspaceRoute>
          <RoleRoute allowedRoles={["MANAGER"]}>
            <IntegrationsPage />
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
  if (!["/verify-email", "/reset-password", "/accept-invite", "/invitations/accept"].includes(activePath)) {
    clearActionToken();
  }
});
