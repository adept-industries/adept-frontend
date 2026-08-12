import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../auth/AuthProvider";
import { ApiError } from "../../api/problem";
import type { WorkspaceSummary } from "../../auth/types";

interface WorkspaceSwitcherProps {
  /** The full list of accessible workspaces from auth state. */
  workspaces: WorkspaceSummary[];
  /** The current workspace ID. */
  currentWorkspaceId: string;
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
export function WorkspaceSwitcher({ workspaces, currentWorkspaceId }: WorkspaceSwitcherProps) {
  const { actions } = useAuth();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show when there are multiple workspaces to choose from.
  if (workspaces.length <= 1) return null;

  const current = workspaces.find((w) => w.id === currentWorkspaceId);

  const handleSwitch = async (workspaceId: string) => {
    if (switching || workspaceId === currentWorkspaceId) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    setOpen(false);
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
      <button
        id="workspace-switcher-trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Current workspace: ${current?.name ?? "Unknown"}. Switch workspace.`}
        disabled={switching}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
          maxWidth: "180px",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "130px",
          }}
        >
          {switching ? "Switching…" : (current?.name ?? "Workspace")}
        </span>
        <span aria-hidden style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>▼</span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Switch workspace"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            background: "var(--card-bg)",
            border: "1px solid var(--border-color)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: "0.5rem",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            minWidth: "200px",
            zIndex: 50,
            listStyle: "none",
            padding: "0.25rem 0",
            margin: 0,
          }}
        >
          {workspaces.map((ws) => (
            <li key={ws.id} role="option" aria-selected={ws.id === currentWorkspaceId}>
              <button
                id={`switch-to-${ws.id}`}
                type="button"
                onClick={() => void handleSwitch(ws.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  cursor: ws.id === currentWorkspaceId ? "default" : "pointer",
                }}
              >
                {ws.name}
                {ws.id === currentWorkspaceId && (
                  <span aria-hidden style={{ marginLeft: "0.5rem" }}>✓</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, color: "var(--text-primary)", fontSize: "0.8rem" }}>
          {error}
        </p>
      )}
    </div>
  );
}
