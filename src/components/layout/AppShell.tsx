import type { ReactNode } from "react";
import { useContext, useState } from "react";
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

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
  </svg>
);

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

// ─── Desktop nav (icon-buttons) ───────────────────────────────────────────────

interface DesktopNavProps {
  theme: DashboardTheme;
  onToggleTheme: () => void;
}

function DesktopNav({ theme, onToggleTheme }: DesktopNavProps) {
  const { state, actions } = useAuth();
  const location = useLocation();

  if (state.status !== "authenticated") return null;

  const { currentMembership } = state;
  const isManager = currentMembership.role === "MANAGER";
  const path = location.pathname;

  return (
    <nav aria-label="Main navigation" className="desktop-nav-row">
      <ProjectSelector />

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
            style={{
              fontWeight: path.startsWith("/dashboard/integrations") ? 600 : 400,
              color: path.startsWith("/dashboard/integrations") ? "var(--primary-light, #818cf8)" : undefined,
            }}
          >
            Integrations
          </Link>
          <Link
            to="/dashboard/members"
            id="nav-members-link"
            className="button-link"
            style={{
              fontWeight: path.startsWith("/dashboard/members") ? 600 : 400,
              color: path.startsWith("/dashboard/members") ? "var(--primary-light, #818cf8)" : undefined,
            }}
          >
            Members
          </Link>
        </>
      )}

      {/* Icon-only buttons for desktop */}
      <button
        id="dashboard-theme-toggle"
        type="button"
        className="icon-button"
        onClick={onToggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>

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
  theme: DashboardTheme;
  onToggleTheme: () => void;
  onClose: () => void;
  open: boolean;
}

function MobileNav({ theme, onToggleTheme, onClose, open }: MobileNavProps) {
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
            style={path.startsWith("/dashboard/integrations") ? activeStyle : {}}
          >
            Integrations
          </Link>
          <Link
            to="/dashboard/members"
            onClick={onClose}
            id="mob-nav-members-link"
            className="button-link"
            style={path.startsWith("/dashboard/members") ? activeStyle : {}}
          >
            Members
          </Link>
        </>
      )}

      <div style={{ height: "1px", background: "var(--dashboard-subtle-border)" }} />

      {/* Utility actions — also as labeled button-links */}
      <button
        id="mob-dashboard-theme-toggle"
        type="button"
        className="button-link"
        onClick={onToggleTheme}
        style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </button>

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
          gap: "0.75rem",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        {/* Left: logo + workspace switcher */}
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
            <div className="dashboard-workspace-control" style={{ paddingLeft: "1rem", minWidth: 0 }}>
              <WorkspaceSwitcher
                workspaces={authenticatedState.workspaces}
                currentWorkspaceId={authenticatedState.currentMembership.workspaceId}
              />
            </div>
          )}
        </div>

        {/* Desktop nav row — pushed right, hidden on mobile via CSS */}
        {authenticatedState && (
          <div style={{ marginLeft: "auto" }}>
            <DesktopNav theme={theme} onToggleTheme={toggleTheme} />
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
          theme={theme}
          onToggleTheme={toggleTheme}
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
