import { useState } from "react";
import { useNavigate } from "react-router";
import { AuthLayout } from "../../../components/layout/AuthLayout";
import { InlineAlert } from "../../../components/ui/InlineAlert";
import { useAuth } from "../../../auth/AuthProvider";
import { ApiError } from "../../../api/problem";

/**
 * SelectWorkspacePage — available only in `workspaceRequired` state.
 *
 * Renders the list of workspaces returned by the login/refresh response.
 * Sends only the selected workspace UUID to the switch API.
 * Stores the UUID only after the switch succeeds.
 */
export function SelectWorkspacePage() {
  const { state, actions } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Guard: only render in workspaceRequired state.
  if (state.status !== "workspaceRequired") {
    if (state.status === "authenticated") {
      void navigate("/dashboard", { replace: true });
      return null;
    }
    void navigate("/login", { replace: true });
    return null;
  }

  const { user, workspaces } = state;

  const handleSelect = async (workspaceId: string) => {
    if (pending) return;
    setPending(workspaceId);
    setError(null);
    try {
      await actions.selectWorkspace(workspaceId);
      // On success, AuthProvider updates state → WorkspaceRoute/ProtectedRoute navigates.
      void navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.problem.detail ?? "Failed to select workspace.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setPending(null);
    }
  };

  return (
    <AuthLayout title="Select workspace" description={`Signed in as ${user.email}`}>
      <p style={{ marginBottom: "1rem", color: "#6b7280", fontSize: "0.9rem" }}>
        You belong to multiple workspaces. Choose one to continue.
      </p>

      {error && <InlineAlert kind="error" message={error} />}

      <ul
        role="list"
        style={{
          listStyle: "none",
          padding: 0,
          margin: "0 0 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {workspaces.map((ws) => (
          <li key={ws.id}>
            <button
              id={`select-workspace-${ws.id}`}
              type="button"
              disabled={pending !== null}
              onClick={() => void handleSelect(ws.id)}
              aria-busy={pending === ws.id}
              style={{
                width: "100%",
                padding: "0.875rem 1rem",
                background: pending === ws.id ? "#f3f4f6" : "#ffffff",
                border: "1.5px solid #e5e7eb",
                borderRadius: "0.5rem",
                cursor: pending !== null ? "not-allowed" : "pointer",
                textAlign: "left",
                transition: "border-color 0.15s, box-shadow 0.15s",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
              onMouseEnter={(e) => {
                if (!pending) (e.currentTarget.style.borderColor = "#4763d8");
              }}
              onMouseLeave={(e) => {
                (e.currentTarget.style.borderColor = "#e5e7eb");
              }}
            >
              <span>
                <strong style={{ display: "block", color: "#111827", fontSize: "0.95rem" }}>
                  {ws.name}
                </strong>
                <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                  {ws.role === "MANAGER" ? "Manager" : "Lead"} · {ws.timezone}
                </span>
              </span>
              {pending === ws.id && (
                <span aria-hidden style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                  Joining…
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </AuthLayout>
  );
}
