import type { ReactNode } from "react";
import { useContext, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
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

// ─── Shared SVGs ──────────────────────────────────────────────────────────────

const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
);

const LogoutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </svg>
);

const GithubNavIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

const JiraNavIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#0052CC" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M11.53 2c0 5.26 4.27 9.53 9.53 9.53V2h-9.53zm-9.53 9.53c0 5.26 4.27 9.53 9.53 9.53V11.53H2zm9.53 0c0 5.26 4.27 9.53 9.53 9.53V11.53h-9.53z" />
  </svg>
);

// ─── Desktop nav (icon-buttons) ───────────────────────────────────────────────

function DesktopNav() {
  const { state, actions } = useAuth();
  const location = useLocation();

  if (state.status !== "authenticated") return null;

  const { currentMembership } = state;
  const isManager = currentMembership.role === "MANAGER";
  const path = location.pathname;

  return (
    <nav aria-label="Main navigation" className="desktop-nav-row">
      {isManager && (
        <>
          <Link
            to="/dashboard/projects"
            id="nav-projects-link"
            className="button-link"
            style={{
              fontWeight: path.startsWith("/dashboard/projects") ? 600 : 400,
              color: path.startsWith("/dashboard/projects") ? "var(--primary-light, #818cf8)" : undefined,
            }}
          >
            Projects
          </Link>
          <Link
            to="/dashboard/integrations"
            id="nav-integrations-link"
            className="button-link"
            aria-label="Integrations"
            title="Integrations (GitHub & Jira)"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.6rem",
              padding: "0.55rem 0.95rem",
              color: path.startsWith("/dashboard/integrations") ? "var(--primary-light, #818cf8)" : undefined,
            }}
          >
            <GithubNavIcon />
            <JiraNavIcon />
          </Link>
        </>
      )}

      {isManager && (
        <Link
          to="/dashboard/settings"
          id="nav-settings-link"
          className="button-link icon-button"
          aria-label="Workspace settings"
          title="Settings"
          style={{ color: path.startsWith("/dashboard/settings") ? "var(--primary-light, #818cf8)" : undefined }}
        >
          <SettingsIcon />
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
        <LogoutIcon />
      </button>
    </nav>
  );
}

// ─── Mobile drawer nav (labeled buttons) ─────────────────────────────────────

interface MobileNavProps {
  onClose: () => void;
  open: boolean;
}

function MobileNav({ onClose, open }: MobileNavProps) {
  const { state, actions } = useAuth();
  const location = useLocation();

  if (state.status !== "authenticated") return null;

  const { currentMembership } = state;
  const isManager = currentMembership.role === "MANAGER";
  const path = location.pathname;

  const activeStyle = { color: "var(--primary-light, #818cf8)", fontWeight: 600 as const };

  return (
    <nav
      aria-label="Mobile navigation"
      className={`mobile-nav-drawer${open ? "" : " closed"}`}
    >
      {/* Project selector */}
      <ProjectSelector />

      <div style={{ height: "1px", background: "var(--dashboard-subtle-border)" }} />

      {/* Nav links — same bordered button style as desktop */}
      {isManager && (
        <>
          <Link
            to="/dashboard/projects"
            onClick={onClose}
            id="mob-nav-projects-link"
            className="button-link"
            style={path.startsWith("/dashboard/projects") ? activeStyle : {}}
          >
            Projects
          </Link>
          <Link
            to="/dashboard/integrations"
            onClick={onClose}
            id="mob-nav-integrations-link"
            className="button-link"
            aria-label="Integrations"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              ...(path.startsWith("/dashboard/integrations") ? activeStyle : {}),
            }}
          >
            <GithubNavIcon />
            <JiraNavIcon />
            <span>Integrations</span>
          </Link>
        </>
      )}

      <div style={{ height: "1px", background: "var(--dashboard-subtle-border)" }} />

      {isManager && (
        <Link
          to="/dashboard/settings"
          onClick={onClose}
          id="mob-nav-settings-link"
          className="button-link"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            ...(path.startsWith("/dashboard/settings") ? activeStyle : {}),
          }}
          aria-label="Workspace settings"
        >
          <SettingsIcon /> Settings
        </Link>
      )}

      <button
        id="mob-nav-logout-btn"
        type="button"
        onClick={() => { onClose(); void actions.logout(); }}
        className="button-link"
        style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
        aria-label="Log out"
      >
        <LogoutIcon /> Log out
      </button>
    </nav>
  );
}

// ─── AppShell ─────────────────────────────────────────────────────────────────

export function AppShell({ children }: AppShellProps) {
  const ctx = useContext(AuthContext);
  const authenticatedState = ctx?.state.status === "authenticated" ? ctx.state : null;
  const [theme, setTheme] = useState<DashboardTheme>(() => dashboardThemePreference.get());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    return dashboardThemePreference.subscribe(setTheme);
  }, []);

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
          gap: "0.75rem",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        {/* Left: logo + workspace switcher + project selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", height: "100%", minWidth: 0, flex: "0 1 auto" }}>
          <Link
            to="/dashboard"
            id="nav-logo"
            aria-label="Dashboard"
            style={{ display: "flex", alignItems: "center", textDecoration: "none", height: "100%", flexShrink: 0 }}
          >
            <img src={logoPath} alt="Adept Logo" className="brand-logo" style={{ height: "3.5rem" }} />
          </Link>
          {authenticatedState && (
            <div className="dashboard-workspace-control" style={{ display: "flex", alignItems: "center", gap: "1rem", paddingLeft: "1rem", minWidth: 0 }}>
              <WorkspaceSwitcher
                workspaces={authenticatedState.workspaces}
                currentWorkspaceId={authenticatedState.currentMembership.workspaceId}
              />
              <div className="desktop-project-selector">
                <ProjectSelector />
              </div>
            </div>
          )}
        </div>

        {/* Desktop nav row — pushed right, hidden on mobile via CSS */}
        {authenticatedState && (
          <div style={{ marginLeft: "auto" }}>
            <DesktopNav />
          </div>
        )}

        {/* Hamburger — hidden on desktop via CSS, pushed to far right */}
        {authenticatedState && (
          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            style={{ marginLeft: "auto" }}
          >
            {mobileMenuOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            )}
          </button>
        )}
      </header>

      {/* Mobile drawer */}
      {authenticatedState && (
        <MobileNav
          onClose={() => setMobileMenuOpen(false)}
          open={mobileMenuOpen}
        />
      )}

      <main className="dashboard-main" style={{ flex: 1, padding: "2rem 1.5rem" }}>
        {children}
      </main>
    </div>
  );
}
