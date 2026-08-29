import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AppShell } from "../../../components/layout/AppShell";
import { FormField } from "../../../components/ui/FormField";
import { InlineAlert } from "../../../components/ui/InlineAlert";
import { useAuth } from "../../../auth/AuthProvider";
import {
  createWorkspace,
  getCurrentWorkspace,
  updateWorkspace,
  deleteWorkspace,
  type CurrentWorkspaceResponse,
} from "../api";
import { ApiError } from "../../../api/problem";
import { accessTokenStore } from "../../../auth/accessTokenStore";
import { workspacePreference } from "../../../lib/workspacePreference";
import { queryClient } from "../../../api/queryClient";
import { listTimezones, formatTimezone } from "../../../lib/timezone";

/**
 * WorkspaceSettingsPage — workspace overview for Managers and Leads.
 *
 * - Show every active workspace membership and its role.
 * - Let the user switch workspaces or create a new workspace.
 * - Load /workspaces/current only for a Manager membership.
 * - Let Managers edit the current workspace name and timezone.
 * - Show field problems.
 * - Update displayed workspace after success.
 * - Never send slug/status/role/membershipId.
 *
 * Deletion:
 * - Require exact slug confirmation.
 * - Require a recent password or Google authentication when the session is stale.
 * - Call DELETE /workspaces/current.
 * - After 202, clear state/cache/preference and navigate based on remaining workspaces.
 */
export function WorkspaceSettingsPage() {
  const { state, actions } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const timezones = useRef(listTimezones());
  const googleReauthenticated = searchParams.get("reauthenticated") === "1";
  const googleReauthenticationFailed = searchParams.has("google_reauth_error");
  const authenticatedState = state.status === "authenticated" ? state : null;
  const currentWorkspaceId = authenticatedState?.currentMembership.workspaceId;
  const isManager = authenticatedState?.currentMembership.role === "MANAGER";

  const [workspace, setWorkspace] = useState<CurrentWorkspaceResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [switchingWorkspaceId, setSwitchingWorkspaceId] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);

  // Edit form state
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Additional workspace form state
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceTimezone, setNewWorkspaceTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreateWorkspaceForm, setShowCreateWorkspaceForm] = useState(false);

  // Deletion form state
  const [showDeleteForm, setShowDeleteForm] = useState(
    googleReauthenticated || googleReauthenticationFailed,
  );
  const [confirmSlug, setConfirmSlug] = useState("");
  const [reauthenticationPassword, setReauthenticationPassword] = useState("");
  const [reauthenticationRequired, setReauthenticationRequired] = useState(
    googleReauthenticationFailed,
  );
  const [deleteError, setDeleteError] = useState<string | null>(
    googleReauthenticationFailed ? "Google verification was not completed. Try again." : null,
  );
  const [deleting, setDeleting] = useState(false);
  const [reauthenticating, setReauthenticating] = useState(false);

  // Only Managers may load or mutate current workspace settings.
  useEffect(() => {
    setWorkspace(null);
    setLoadError(null);
    if (!isManager || !currentWorkspaceId) return;

    const controller = new AbortController();
    void (async () => {
      try {
        const ws = await getCurrentWorkspace(controller.signal);
        setWorkspace(ws);
        setName(ws.name);
        setTimezone(ws.timezone);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setLoadError("Failed to load workspace settings.");
        }
      }
    })();
    return () => controller.abort();
  }, [currentWorkspaceId, isManager]);

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!workspace) return;
    setSaveError(null);
    setSaveSuccess(false);
    setSaving(true);
    try {
      const updated = await updateWorkspace({ name: name.trim(), timezone });
      setWorkspace(updated);
      setName(updated.name);
      setTimezone(updated.timezone);
      actions.updateCurrentWorkspace({ name: updated.name, timezone: updated.timezone });
      setSaveSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setSaveError(err.problem.fieldErrors?.[0]?.message ?? err.problem.detail);
      } else {
        setSaveError("An unexpected error occurred.");
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteConfirmedWorkspace = async () => {
    await deleteWorkspace({ confirmationSlug: confirmSlug });
    setConfirmSlug("");
    accessTokenStore.clear();
    workspacePreference.clear();
    queryClient.clear();
    try {
      const next = await actions.refresh({ withoutWorkspace: true });
      if (next.status === "authenticated") {
        void navigate("/dashboard", { replace: true });
      } else if (next.status === "workspaceRequired") {
        void navigate("/select-workspace", { replace: true });
      } else {
        void navigate("/login?deleted=1", { replace: true });
      }
    } catch {
      actions.invalidateSession({ deletionRequested: true });
    }
  };

  const handleDelete = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!workspace || reauthenticationRequired) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteConfirmedWorkspace();
    } catch (err) {
      if (err instanceof ApiError && err.problem.code === "REAUTHENTICATION_REQUIRED") {
        setReauthenticationRequired(true);
      } else if (err instanceof ApiError) {
        setDeleteError(err.problem.detail ?? "Failed to delete workspace.");
      } else {
        setDeleteError("An unexpected error occurred.");
      }
    } finally {
      setDeleting(false);
    }
  };

  const handlePasswordReauthentication = async () => {
    setDeleteError(null);
    setReauthenticating(true);
    try {
      await actions.reauthenticateWithPassword({ password: reauthenticationPassword });
      setReauthenticationPassword("");
      setReauthenticationRequired(false);
      setDeleting(true);
      await deleteConfirmedWorkspace();
    } catch (err) {
      setReauthenticationPassword("");
      if (err instanceof ApiError) {
        setDeleteError(err.problem.detail ?? "Identity verification failed.");
      } else {
        setDeleteError("An unexpected error occurred.");
      }
    } finally {
      setDeleting(false);
      setReauthenticating(false);
    }
  };

  const handleGoogleReauthentication = async () => {
    setDeleteError(null);
    setReauthenticating(true);
    try {
      const authorizationUrl = await actions.startGoogleReauthentication();
      window.location.assign(authorizationUrl);
    } catch (err) {
      if (err instanceof ApiError) {
        setDeleteError(err.problem.detail ?? "Unable to start Google verification.");
      } else {
        setDeleteError("An unexpected error occurred.");
      }
      setReauthenticating(false);
    }
  };

  const handleCreateWorkspace = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const created = await createWorkspace({
        name: newWorkspaceName.trim(),
        timezone: newWorkspaceTimezone,
      });
      await actions.selectWorkspace(created.id);
      void navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setCreateError(err.problem.fieldErrors?.[0]?.message ?? err.problem.detail);
      } else {
        setCreateError("An unexpected error occurred.");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleSwitchWorkspace = async (workspaceId: string) => {
    if (workspaceId === currentWorkspaceId || switchingWorkspaceId) return;
    setSwitchError(null);
    setSwitchingWorkspaceId(workspaceId);
    try {
      await actions.selectWorkspace(workspaceId);
    } catch (err) {
      if (err instanceof ApiError) {
        setSwitchError(err.problem.detail ?? "Failed to switch workspace.");
      } else {
        setSwitchError("Failed to switch workspace.");
      }
    } finally {
      setSwitchingWorkspaceId(null);
    }
  };

  // Must be authenticated.
  if (state.status !== "authenticated") return null;

  return (
    <AppShell>
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "1.5rem 1.5rem" }}>
        {/* Navigation Breadcrumb */}
        <div style={{ marginBottom: "1.5rem" }}>
          <Link
            to="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.85rem",
              color: "var(--text-secondary, #94a3b8)",
              padding: "0.2rem 0",
              textDecoration: "none",
              background: "transparent",
              border: "none",
              fontWeight: 500,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back to Dashboard
          </Link>
        </div>

        <header style={{ marginBottom: "2.5rem" }}>
          <div>
            <h1 id="settings-title" style={{ fontSize: "2rem", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)", margin: 0 }}>
              Workspace Settings
            </h1>
            <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem", fontSize: "1rem" }}>
              View your workspace memberships and manage the current workspace when you are a Manager.
            </p>
          </div>
        </header>

        <section className="card" style={{ width: "100%", marginBottom: "2.5rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ fontSize: "1.2rem", margin: 0 }}>Create another workspace</h2>
              <p style={{ color: "var(--text-secondary)", margin: "0.5rem 0 0" }}>
                Create a separate workspace that you manage.
              </p>
            </div>
            <button
              type="button"
              className="button-link"
              aria-expanded={showCreateWorkspaceForm}
              aria-controls="create-workspace-panel"
              aria-label={`${showCreateWorkspaceForm ? "Collapse" : "Create"} workspace`}
              onClick={() => setShowCreateWorkspaceForm((visible) => !visible)}
            >
              {showCreateWorkspaceForm ? "Collapse" : "Create"}
            </button>
          </div>

          {showCreateWorkspaceForm && (
            <div id="create-workspace-panel" style={{ marginTop: "1.5rem" }}>
              <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>
                A workspace is a separate security boundary. You become its Manager and can switch back at any time.
              </p>
              <form
                onSubmit={(event) => void handleCreateWorkspace(event)}
                style={{ display: "grid", gap: "1rem" }}
              >
                <FormField
                  id="new-workspace-name"
                  label="Workspace name"
                  value={newWorkspaceName}
                  onChange={(event) => setNewWorkspaceName(event.target.value)}
                  maxLength={160}
                  required
                />
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label htmlFor="new-workspace-timezone">Timezone</label>
                  <select
                    id="new-workspace-timezone"
                    className="form-input"
                    value={newWorkspaceTimezone}
                    onChange={(event) => setNewWorkspaceTimezone(event.target.value)}
                  >
                    {timezones.current.map((tz) => (
                      <option key={tz} value={tz}>{formatTimezone(tz)}</option>
                    ))}
                  </select>
                </div>
                {createError && <InlineAlert kind="error" message={createError} />}
                <button type="submit" disabled={creating || !newWorkspaceName.trim()}>
                  {creating ? "Creating…" : "Create and switch"}
                </button>
              </form>
            </div>
          )}
        </section>

        <section
          aria-labelledby="workspace-memberships-title"
          className="dashboard-panel"
          style={{
            borderRadius: "1rem",
            padding: "2rem",
            marginBottom: "2.5rem",
          }}
        >
          <h2 id="workspace-memberships-title" style={{ fontSize: "1.2rem", marginTop: 0 }}>
            Your workspaces
          </h2>
          <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>
            Your role is specific to each workspace.
          </p>
          <ul
            aria-label="Workspace memberships"
            style={{ listStyle: "none", padding: 0, margin: "1.5rem 0 0", display: "grid", gap: "0.75rem" }}
          >
            {state.workspaces.map((availableWorkspace) => {
              const isCurrent = availableWorkspace.id === state.currentMembership.workspaceId;
              return (
                <li
                  key={availableWorkspace.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                    padding: "1rem",
                    border: "1px solid var(--border-color)",
                    borderRadius: "0.75rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                    <strong>{availableWorkspace.name}</strong>
                    <span
                      style={{
                        padding: "0.2rem 0.55rem",
                        borderRadius: "999px",
                        background: "var(--input-bg)",
                        color: "var(--text-secondary)",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                      }}
                    >
                      {availableWorkspace.role === "MANAGER" ? "Manager" : "Lead"}
                    </span>
                    {isCurrent && (
                      <span style={{ color: "var(--primary)", fontSize: "0.78rem", fontWeight: 600 }}>
                        Current
                      </span>
                    )}
                  </div>
                  {!isCurrent && (
                    <button
                      type="button"
                      className="button-link"
                      onClick={() => void handleSwitchWorkspace(availableWorkspace.id)}
                      disabled={switchingWorkspaceId !== null}
                      aria-label={`Switch to ${availableWorkspace.name}`}
                    >
                      {switchingWorkspaceId === availableWorkspace.id ? "Switching…" : "Switch"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {switchError && <InlineAlert kind="error" message={switchError} />}
        </section>

        {isManager && loadError && <InlineAlert kind="error" message={loadError} />}

        {isManager && !workspace && !loadError && (
          <p style={{ color: "var(--text-secondary)" }}>Loading…</p>
        )}

        {isManager && workspace && (
          <div className="dashboard-panel" style={{
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: "1rem",
              padding: "2.5rem",
              marginBottom: "2.5rem",
            }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "1.5rem", color: "var(--text-primary)" }}>General Settings</h2>
              
              <form
                id="workspace-settings-form"
                onSubmit={(e: FormEvent<HTMLFormElement>) => void handleSave(e)}
                noValidate
                style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                  <FormField
                    id="workspace-name"
                    label="Workspace name"
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setSaveSuccess(false); }}
                    required
                    autoComplete="organization"
                  />

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <label htmlFor="workspace-timezone" style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--text-primary)" }}>
                      Timezone
                    </label>
                    <select
                      id="workspace-timezone"
                      className="form-input"
                      value={timezone}
                      onChange={(e) => { setTimezone(e.target.value); setSaveSuccess(false); }}
                      style={{
                        padding: "0.75rem 1rem",
                        border: "1px solid var(--border-color)",
                        borderRadius: "0.5rem",
                        fontSize: "0.95rem",
                        color: "var(--text-primary)",
                        background: "var(--input-bg)",
                        outline: "none",
                        width: "100%",
                      }}
                    >
                      {timezones.current.map((tz) => (
                        <option key={tz} value={tz}>{formatTimezone(tz)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {saveError && <InlineAlert kind="error" message={saveError} />}
                {saveSuccess && <InlineAlert kind="success" message="Settings saved successfully." />}

                <div className="dashboard-panel-actions" style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem", paddingTop: "1.5rem" }}>
                  <button
                    type="submit"
                    id="save-settings-btn"
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
          </div>
        )}

        {isManager && workspace && (
          <section
            aria-labelledby="danger-title"
            className="danger-zone"
            style={{
                border: "1px solid var(--danger-border)",
                borderRadius: "1rem",
                padding: "2.5rem",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
              }}
            >
              <h2 id="danger-title" className="danger-text" style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Danger Zone
              </h2>
              <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", marginBottom: "2rem" }}>
                Access stops immediately and final data removal is queued. This cannot be undone.
              </p>

              {!showDeleteForm ? (
                <button
                  id="show-delete-form-btn"
                  type="button"
                  className="danger-button"
                  onClick={() => setShowDeleteForm(true)}
                >
                  Delete this workspace
                </button>
              ) : (
                <form
                  id="delete-workspace-form"
                  onSubmit={(e: FormEvent<HTMLFormElement>) => void handleDelete(e)}
                  noValidate
                  style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
                >
                  <p style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>
                    Type <strong className="danger-text">{workspace.slug}</strong> to confirm.
                  </p>

                  <FormField
                    id="confirm-slug"
                    label="Workspace slug"
                    type="text"
                    value={confirmSlug}
                    onChange={(e) => setConfirmSlug(e.target.value)}
                    required
                    autoComplete="off"
                    placeholder={workspace.slug}
                  />

                  {googleReauthenticated && (
                    <InlineAlert
                      kind="success"
                      message="Identity verified. Type the workspace slug to continue."
                    />
                  )}

                  {reauthenticationRequired && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      <InlineAlert
                        kind="info"
                        message="For security, verify your identity again before deleting this workspace."
                      />
                      {state.user.hasPassword ? (
                        <FormField
                          id="reauthentication-password"
                          label="Your current password"
                          type="password"
                          value={reauthenticationPassword}
                          onChange={(e) => setReauthenticationPassword(e.target.value)}
                          required
                          autoComplete="current-password"
                        />
                      ) : (
                        <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                          Continue with the Google account connected to this Adept account.
                        </p>
                      )}
                    </div>
                  )}

                  {deleteError && <InlineAlert kind="error" message={deleteError} />}

                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    {!reauthenticationRequired ? (
                      <button
                        type="submit"
                        id="confirm-delete-btn"
                        className="danger-button"
                        disabled={deleting || confirmSlug !== workspace.slug}
                      >
                        {deleting ? "Deleting…" : "Confirm delete"}
                      </button>
                    ) : state.user.hasPassword ? (
                      <button
                        type="button"
                        id="verify-password-btn"
                        className="danger-button"
                        onClick={() => void handlePasswordReauthentication()}
                        disabled={reauthenticating || !reauthenticationPassword}
                      >
                        {reauthenticating ? "Verifying…" : "Verify and delete"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        id="verify-google-btn"
                        onClick={() => void handleGoogleReauthentication()}
                        disabled={reauthenticating}
                      >
                        {reauthenticating ? "Opening Google…" : "Verify with Google"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteForm(false);
                        setConfirmSlug("");
                        setReauthenticationPassword("");
                        setReauthenticationRequired(false);
                        setDeleteError(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
