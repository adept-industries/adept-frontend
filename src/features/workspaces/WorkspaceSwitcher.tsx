import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../auth/AuthProvider";
import { ApiError } from "../../api/problem";
import type { WorkspaceSummary } from "../../auth/types";
import { NavigationDropdown } from "../../components/ui/NavigationDropdown";

interface WorkspaceSwitcherProps {
  /** The full list of accessible workspaces from auth state. */
  workspaces: WorkspaceSummary[];
  /** The current workspace ID. */
  currentWorkspaceId: string;
  /** Dropdown menu alignment. */
  align?: "left" | "right";
}

/**
 * WorkspaceSwitcher — dropdown to switch between workspaces.
 *
 * Switch sequence (per spec):
 * 1. Increment session generation (done inside AuthProvider.selectWorkspace).
 * 2. Cancel current workspace queries.
 * 3. Clear memory access token.
 * 4. Clear all workspace-keyed query cache.
 * 5. Call switch with refresh cookie and CSRF.
 * 6. On success: store new token / preference, rebuild auth state, navigate.
 * 7. On failure: clear unsafe stale state, redirect to selection/login.
 */
export function WorkspaceSwitcher({ workspaces, currentWorkspaceId, align = "left" }: WorkspaceSwitcherProps) {
  const { actions } = useAuth();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the workspace control visible even when only one workspace is
  // available so the app shell remains consistent as memberships change.
  if (workspaces.length === 0) return null;

  const handleSwitch = async (workspaceId: string) => {
    if (switching || workspaceId === currentWorkspaceId) {
      return;
    }
    setSwitching(true);
    setError(null);

    try {
      // Step 5–6: AuthProvider.selectWorkspace calls the switch API and updates state.
      await actions.selectWorkspace(workspaceId);
      void navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        const code = err.problem.code;
        if (code === "SESSION_INVALID" || code === "REFRESH_REUSE_DETECTED") {
          actions.invalidateSession();
          void navigate("/login", { replace: true });
          return;
        }
        setError(err.problem.detail);
        void navigate("/select-workspace", { replace: true });
      } else {
        actions.invalidateSession({ ambiguous: true });
        void navigate("/login", { replace: true });
      }
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <div className="navigation-dropdown-field">
        <span>Workspace</span>
        <NavigationDropdown
          id="workspace-switcher-trigger"
          ariaLabel="Selected workspace"
          options={workspaces.map((workspace) => ({ id: workspace.id, label: workspace.name }))}
          selectedId={currentWorkspaceId}
          onSelect={(workspaceId) => void handleSwitch(workspaceId)}
          disabled={switching}
          busyLabel="Switching…"
          align={align}
        />
      </div>

      {error && (
        <p role="alert" style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, color: "var(--text-primary)", fontSize: "0.8rem" }}>
          {error}
        </p>
      )}
    </div>
  );
}
