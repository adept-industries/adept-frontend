import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { WorkspaceSwitcher } from "../../features/workspaces/WorkspaceSwitcher";
import { ProjectSelector } from "../../features/projects/ProjectSelector";
import { OnboardingTour } from "../../features/onboarding/OnboardingTour.js";
import { useOnboardingTour } from "../../features/onboarding/OnboardingTourContext.js";
import { useAuth } from "../../auth/AuthProvider";
import logoPath from "../../assets/logo.png";

import {
  dashboardThemePreference,
  type DashboardTheme,
} from "../../lib/dashboardThemePreference";

interface AppShellProps {
  children: ReactNode;
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

const DashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const IntegrationsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="5" r="3" />
    <circle cx="5" cy="19" r="3" />
    <circle cx="19" cy="19" r="3" />
    <line x1="12" y1="8" x2="5.5" y2="16.5" />
    <line x1="12" y1="8" x2="18.5" y2="16.5" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const UsersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ProjectFolderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const AlertsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const TourIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 2.5v1.4M21.5 12h-1.4M12 21.5v-1.4M2.5 12h1.4" />
    <path d="M16.2 7.8 13 13 7.8 16.2 11 11 16.2 7.8z" />
    <path d="M16.2 7.8 13 13 11 11z" fill="currentColor" stroke="none" />
  </svg>
);

const ThemeIcon = ({ theme }: { theme: DashboardTheme }) =>
  theme === "dark" ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );

// ─── Sidebar Nav Item ───────────────────────────────────────────────────────────

interface SidebarNavItemProps {
  to?: string;
  onClick?: () => void;
  icon: ReactNode;
  label: string;
  id: string;
  active?: boolean;
}

function SidebarNavItem({ to, onClick, icon, label, id, active }: SidebarNavItemProps) {
  const cls = `sidebar-nav-item${active ? " active" : ""}`;
  if (to) {
    return (
      <Link to={to} id={id} className={cls} title={label}>
        <span className="sidebar-nav-icon">{icon}</span>
        <span className="sidebar-nav-label">{label}</span>
      </Link>
    );
  }
  return (
    <button type="button" id={id} className={cls} onClick={onClick} title={label}>
      <span className="sidebar-nav-icon">{icon}</span>
      <span className="sidebar-nav-label">{label}</span>
    </button>
  );
}

// ─── Floating Sidebar ──────────────────────────────────────────────────────────

interface FloatingSidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onStartTour: () => void;
}

function FloatingSidebar({ mobileOpen, onMobileClose, collapsed, onToggleCollapse, onStartTour }: FloatingSidebarProps) {
  const { state, actions } = useAuth();
  const location = useLocation();
  const [theme, setTheme] = useState<DashboardTheme>(() => dashboardThemePreference.get());

  useEffect(() => dashboardThemePreference.subscribe(setTheme), []);

  const path = location.pathname;

  const isAuthenticated = state.status === "authenticated";
  const isManager = isAuthenticated && state.currentMembership.role === "MANAGER";

  const user = isAuthenticated ? state.user : undefined;
  const displayName = user?.displayName?.trim() || user?.email || "User";
  const initials = (() => {
    if (!user) return "U";
    const name = user.displayName?.trim() || user.email || "";
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || "U";
  })();
  const role = isAuthenticated ? state.currentMembership.role : "";

  const toggleTheme = () => {
    const next: DashboardTheme = theme === "dark" ? "light" : "dark";
    dashboardThemePreference.set(next);
  };

  // On desktop: always expanded unless user collapsed it; on mobile: controlled by mobileOpen
  const sidebarCls = [
    "floating-sidebar",
    mobileOpen ? "mobile-open" : "",
    !collapsed ? "expanded" : "",
  ].filter(Boolean).join(" ");

  return (
    <>
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={onMobileClose} aria-hidden="true" />
      )}

      <aside className={sidebarCls} aria-label="Main navigation">
        {/* Logo / collapse toggle (desktop) */}
        <div className="sidebar-logo-area" id="sidebar-logo-area">
          <button
            type="button"
            className="sidebar-logo-toggle"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <img src={logoPath} alt="Adept" className="sidebar-logo-img" />
          </button>
          <Link
            to="/dashboard"
            className="sidebar-brand-name"
            id="sidebar-logo-link"
            aria-label="Go to dashboard"
            onClick={onMobileClose}
          >
            Adept
          </Link>
        </div>

        {/* Mobile-only: workspace & project selectors inside sidebar */}
        {isAuthenticated && (
          <div className="sidebar-mobile-controls">
            <WorkspaceSwitcher
              workspaces={state.workspaces}
              currentWorkspaceId={state.currentMembership.workspaceId}
            />
            <ProjectSelector />
          </div>
        )}

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="sidebar-nav-section">
            <SidebarNavItem
              to="/dashboard"
              id="sidebar-nav-dashboard"
              icon={<DashboardIcon />}
              label="Dashboard"
              active={path === "/dashboard"}
            />
            {isManager && (
              <SidebarNavItem
                to="/dashboard/integrations"
                id="sidebar-nav-integrations"
                icon={<IntegrationsIcon />}
                label="Integrations"
                active={path.startsWith("/dashboard/integrations")}
              />
            )}
            {isAuthenticated && (
              <>
                <SidebarNavItem
                  to="/dashboard/projects"
                  id="sidebar-nav-projects"
                  icon={<ProjectFolderIcon />}
                  label="Projects"
                  active={path.startsWith("/dashboard/projects")}
                />
                <SidebarNavItem
                  to="/dashboard/teams"
                  id="sidebar-nav-teams"
                  icon={<UsersIcon />}
                  label="Teams"
                  active={path.startsWith("/dashboard/teams")}
                />
                <SidebarNavItem
                  to="/dashboard/alerts"
                  id="sidebar-nav-alerts"
                  icon={<AlertsIcon />}
                  label="Alerts"
                  active={path.startsWith("/dashboard/alerts")}
                />
                <SidebarNavItem
                  to="/dashboard/settings"
                  id="sidebar-nav-settings"
                  icon={<SettingsIcon />}
                  label="Workspaces"
                  active={path.startsWith("/dashboard/settings")}
                />
              </>
            )}
          </div>
        </nav>

        {/* Bottom rail */}
        <div className="sidebar-bottom">
          <SidebarNavItem
            onClick={toggleTheme}
            id="sidebar-nav-theme"
            icon={<ThemeIcon theme={theme} />}
            label={theme === "dark" ? "Light mode" : "Dark mode"}
          />

          {isAuthenticated && (
            <SidebarNavItem
              onClick={() => { onMobileClose(); onStartTour(); }}
              id="sidebar-nav-tour"
              icon={<TourIcon />}
              label="Take a tour"
            />
          )}

          <SidebarNavItem
            onClick={() => { onMobileClose(); void actions.logout(); }}
            id="sidebar-nav-logout"
            icon={<LogoutIcon />}
            label="Log out"
          />

          {isAuthenticated && (
            <div className="sidebar-user-row">
              <div className="sidebar-avatar" aria-hidden="true">{initials}</div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{displayName}</div>
                <div className="sidebar-user-role">{role}</div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ─── AppShell ─────────────────────────────────────────────────────────────────

export function AppShell({ children }: AppShellProps) {
  const { state } = useAuth();
  const tour = useOnboardingTour();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<DashboardTheme>(() => dashboardThemePreference.get());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    return dashboardThemePreference.subscribe(setTheme);
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove("light-theme", "dark-theme");
    document.documentElement.classList.add(`${theme}-theme`);
    // Cleanup if unmounted so other parts of the app don't inherit the dashboard theme
    return () => {
      document.documentElement.classList.remove("light-theme", "dark-theme");
    };
  }, [theme]);

  const location = useLocation();
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div
      className={`dashboard-shell ${theme}-theme`}
      data-dashboard-theme={theme}
    >
      {/* Floating sidebar */}
      <FloatingSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((p) => !p)}
        onStartTour={() => {
          if (state.status === "authenticated") {
            tour.startTour(state.user.id);
            if (location.pathname !== "/dashboard") {
              void navigate("/dashboard");
            }
          }
        }}
      />

      <OnboardingTour pathname={location.pathname} />

      {/* Content area */}
      <div className="dashboard-content-area">

        {/* Mobile topbar — shown only on mobile */}
        <header className="sidebar-mobile-topbar">
          <Link to="/dashboard" className="sidebar-mobile-logo" aria-label="Dashboard">
            <img src={logoPath} alt="Adept" />
            <span>Adept</span>
          </Link>

          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setMobileOpen((p) => !p)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              padding: "0.25rem",
              cursor: "pointer",
              color: "var(--text-primary)",
            }}
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </header>

        <main className="dashboard-main">
          {children}
        </main>
      </div>
    </div>
  );
}
