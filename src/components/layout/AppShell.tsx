import type { ReactNode } from "react";
import { useContext } from "react";
import { Link } from "react-router";
import { AuthContext } from "../../auth/AuthContext";
import { WorkspaceSwitcher } from "../../features/workspaces/WorkspaceSwitcher";
import { useAuth } from "../../auth/AuthProvider";
import logoPath from "../../assets/logo.png";

interface AppShellProps {
  children: ReactNode;
}

function AppShellNav() {
  const { state, actions } = useAuth();

  if (state.status !== "authenticated") return null;

  const { currentMembership, workspaces } = state;
  const isManager = currentMembership.role === "MANAGER";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
      <WorkspaceSwitcher
        workspaces={workspaces}
        currentWorkspaceId={currentMembership.workspaceId}
      />

      {isManager && (
        <Link
          to="/dashboard/settings"
          id="nav-settings-link"
          style={{ 
            display: "flex", alignItems: "center", justifyContent: "center", 
            width: "2.2rem", height: "2.2rem", 
            borderRadius: "50%", 
            background: "rgba(255, 255, 255, 0.05)", 
            border: "1px solid rgba(255, 255, 255, 0.1)", 
            color: "var(--text-secondary)", 
            transition: "all 0.2s ease" 
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"; }}
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
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", 
          width: "2.2rem", height: "2.2rem",
          background: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "50%",
          cursor: "pointer",
          color: "var(--text-secondary)",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
          e.currentTarget.style.color = "var(--text-primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
          e.currentTarget.style.color = "var(--text-secondary)";
        }}
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
  const workspaceName =
    ctx?.state.status === "authenticated"
      ? ctx.state.currentMembership.workspaceName
      : "";

  return (
    <div className="dark-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--bg-color)", color: "var(--text-primary)" }}>
      <header
        style={{
          background: "rgba(15, 15, 18, 0.7)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
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
            <img src={logoPath} alt="Adept Logo" style={{ height: "3.5rem" }} />
          </Link>
          {workspaceName && (
             <span
               style={{
                 fontSize: "0.85rem",
                 color: "var(--text-secondary)",
                 borderLeft: "1px solid rgba(255, 255, 255, 0.2)",
                 paddingLeft: "1rem",
                 fontWeight: 500,
               }}
             >
               {workspaceName}
             </span>
          )}
        </div>

        <AppShellNav />
      </header>
      <main style={{ flex: 1, padding: "2rem 1.5rem" }}>{children}</main>
    </div>
  );
}
