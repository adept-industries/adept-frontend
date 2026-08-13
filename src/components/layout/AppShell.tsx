import type { ReactNode } from "react";
import { useContext, useState } from "react";
import { Link } from "react-router";
import { AuthContext } from "../../auth/AuthContext";
import { WorkspaceSwitcher } from "../../features/workspaces/WorkspaceSwitcher";
import { useAuth } from "../../auth/AuthProvider";
import logoPath from "../../assets/logo.png";
import { ProjectSelector } from "../../features/projects/ProjectSelector";
import {
  dashboardThemePreference,
  type DashboardTheme,
} from "../../lib/dashboardThemePreference";

interface AppShellProps {
  children: ReactNode;
}

interface AppShellNavProps {
  theme: DashboardTheme;
  onToggleTheme: () => void;
}

function AppShellNav({ theme, onToggleTheme }: AppShellNavProps) {
  const { state, actions } = useAuth();

  if (state.status !== "authenticated") return null;

  const { currentMembership } = state;
  const isManager = currentMembership.role === "MANAGER";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
      <ProjectSelector />

      {isManager && (
        <Link
          to="/dashboard/projects"
          id="nav-projects-link"
          className="button-link"
        >
          Manage Projects
        </Link>
      )}

      <button
        id="dashboard-theme-toggle"
        type="button"
        className="icon-button"
        onClick={onToggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
          </svg>
        )}
      </button>

      {isManager && (
        <Link
          to="/dashboard/settings"
          id="nav-settings-link"
          className="button-link icon-button"
          aria-label="Workspace settings"
          title="Settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </Link>
      )}

      <button
        id="nav-logout-btn"
        type="button"
        onClick={() => void actions.logout()}
        title="Log out"
        className="icon-button"
        aria-label="Log out"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
      </button>
    </div>
  );
}

export function AppShell({ children }: AppShellProps) {
  const ctx = useContext(AuthContext);
  const authenticatedState = ctx?.state.status === "authenticated" ? ctx.state : null;
  const [theme, setTheme] = useState<DashboardTheme>(() => dashboardThemePreference.get());

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    dashboardThemePreference.set(nextTheme);
  };

  return (
    <div
      className={`dashboard-shell ${theme}-theme`}
      data-dashboard-theme={theme}
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--bg-color)", color: "var(--text-primary)" }}
    >
      <header
        className="dashboard-header"
        style={{
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          padding: "0 2rem",
          height: "4.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", height: "100%" }}>
          <Link
            to="/dashboard"
            id="nav-logo"
            aria-label="Dashboard"
            style={{ display: "flex", alignItems: "center", textDecoration: "none", height: "100%" }}
          >
            <img src={logoPath} alt="Adept Logo" className="brand-logo" style={{ height: "3.5rem" }} />
          </Link>
          {authenticatedState && (
            <div className="dashboard-workspace-control" style={{ paddingLeft: "1rem" }}>
              <WorkspaceSwitcher
                workspaces={authenticatedState.workspaces}
                currentWorkspaceId={authenticatedState.currentMembership.workspaceId}
              />
            </div>
          )}
        </div>

        <AppShellNav theme={theme} onToggleTheme={toggleTheme} />
      </header>
      <main style={{ flex: 1, padding: "2rem 1.5rem" }}>{children}</main>
    </div>
  );
}
