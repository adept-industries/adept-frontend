import type { ReactNode } from "react";
import { useContext } from "react";
import { Link } from "react-router";
import { AuthContext } from "../../auth/AuthContext";
import { WorkspaceSwitcher } from "../../features/workspaces/WorkspaceSwitcher";
import { useAuth } from "../../auth/AuthProvider";

interface AppShellProps {
  children: ReactNode;
}

function AppShellNav() {
  const { state, actions } = useAuth();

  if (state.status !== "authenticated") return null;

  const { user, currentMembership, workspaces } = state;
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
          style={{ fontSize: "0.875rem", color: "#6b7280", textDecoration: "none" }}
          aria-label="Workspace settings"
        >
          Settings
        </Link>
      )}

      <span style={{ fontSize: "0.875rem", color: "#6b7280" }}>{user.displayName}</span>

      <button
        id="nav-logout-btn"
        type="button"
        onClick={() => void actions.logout()}
        style={{
          padding: "0.25rem 0.75rem",
          background: "transparent",
          border: "1px solid #e5e7eb",
          borderRadius: "0.375rem",
          cursor: "pointer",
          fontSize: "0.875rem",
          color: "#374151",
        }}
      >
        Log out
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
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
          padding: "0 1.5rem",
          height: "3.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link
            to="/dashboard"
            id="nav-logo"
            aria-label="Dashboard"
            style={{
              fontWeight: 800,
              fontSize: "1.1rem",
              color: "#4763d8",
              textDecoration: "none",
              letterSpacing: "-0.02em",
            }}
          >
            adept
          </Link>
          {workspaceName && (
            <span
              style={{
                fontSize: "0.8rem",
                color: "#9ca3af",
                borderLeft: "1px solid #e5e7eb",
                paddingLeft: "0.75rem",
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
