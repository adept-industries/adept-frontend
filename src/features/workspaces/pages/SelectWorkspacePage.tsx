import { type FormEvent, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { AuthLayout } from "../../../components/layout/AuthLayout";
import { FormField } from "../../../components/ui/FormField";
import { InlineAlert } from "../../../components/ui/InlineAlert";
import { useAuth } from "../../../auth/AuthProvider";
import { ApiError } from "../../../api/problem";
import { formatTimezone, listTimezones } from "../../../lib/timezone";

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
  const [workspaceName, setWorkspaceName] = useState("");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const [creating, setCreating] = useState(false);
  const timezones = useRef(listTimezones());

  // Guard: only render in workspaceRequired state.
  if (state.status !== "workspaceRequired") {
    if (state.status === "authenticated") {
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/login" replace />;
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

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (creating || !workspaceName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await actions.createWorkspace({ name: workspaceName.trim(), timezone });
      void navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.problem.fieldErrors?.[0]?.message ?? err.problem.detail);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setCreating(false);
    }
  };

  if (workspaces.length === 0) {
    return (
      <AuthLayout
        title="Create workspace"
        description={`Signed in as ${user.email}`}
      >
        <p style={{ marginBottom: "1rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Your account is active, but it does not currently have a workspace. Create one to continue.
        </p>
        {error && <InlineAlert kind="error" message={error} />}
        {!error && state.notice && <InlineAlert kind="error" message={state.notice} />}
        <form
          onSubmit={(event) => void handleCreate(event)}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <FormField
            id="recovery-workspace-name"
            label="Workspace name"
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.target.value)}
            maxLength={160}
            required
            autoComplete="organization"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <label htmlFor="recovery-workspace-timezone">Timezone</label>
            <select
              id="recovery-workspace-timezone"
              className="form-input"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            >
              {timezones.current.map((zone) => (
                <option key={zone} value={zone}>{formatTimezone(zone)}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={creating || !workspaceName.trim()}>
            {creating ? "Creating workspace…" : "Create workspace"}
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Select workspace" description={`Signed in as ${user.email}`}>
      <p style={{ marginBottom: "1rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
        You belong to multiple workspaces. Choose one to continue.
      </p>

      {error && <InlineAlert kind="error" message={error} />}
      {!error && state.notice && <InlineAlert kind="error" message={state.notice} />}

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
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>
                <strong style={{ display: "block", color: "var(--text-primary)", fontSize: "0.95rem" }}>
                  {ws.name}
                </strong>
                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  {ws.role === "MANAGER" ? "Manager" : "Lead"} · {ws.timezone}
                </span>
              </span>
              {pending === ws.id && (
                <span aria-hidden style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
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
