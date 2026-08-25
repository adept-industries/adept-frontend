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
import { useProjects } from "../features/projects/useProjects";
import { DoraMetricsSection } from "../features/metrics/DoraMetricsSection";

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
      <DoraMetricsSection selectedProjectId={selectedProject?.id ?? null} />

      {/* Projects section */}
      {projects.length > 0 ? (
        <>
          <h2 className="dash-section-title">Your Projects</h2>
          <div className="dash-projects-grid">
            {projects.map((project, i) => (
              <div
                key={project.id}
                className="project-card"
                style={{ animationDelay: `${0.05 + i * 0.05}s` }}
              >
                <div className="project-card-header">
                  <h3 className="project-card-name">{project.name}</h3>
                  <span className="project-card-badge">Active</span>
                </div>
                <div className="project-card-repos">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {project.repositories.length} {project.repositories.length === 1 ? "repository" : "repositories"}
                </div>
                {project.repositories.length > 0 && (
                  <ul style={{ margin: 0, padding: "0 0 0 1rem", listStyle: "disc", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                    {project.repositories.slice(0, 3).map((repo) => (
                      <li key={repo.id} style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                        <code style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{repo.fullName}</code>
                      </li>
                    ))}
                    {project.repositories.length > 3 && (
                      <li style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                        +{project.repositories.length - 3} more
                      </li>
                    )}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="dash-empty">
          <div className="dash-empty-icon">📂</div>
          <h2 className="dash-empty-title">No projects yet</h2>
          <p className="dash-empty-desc">
            A Manager can create a project and attach repositories after GitHub synchronization.
            Once set up, DORA metrics will appear here.
          </p>
        </div>
      )}
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
