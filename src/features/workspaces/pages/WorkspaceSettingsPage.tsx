import { type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
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
 * WorkspaceSettingsPage — MANAGER role only.
 *
 * - Load /workspaces/current.
 * - Edit name and timezone only.
 * - Show field problems.
 * - Update displayed workspace after success.
 * - Never send slug/status/role/membershipId.
 *
 * Deletion:
 * - Require exact slug confirmation.
 * - Request current password.
 * - Call DELETE /workspaces/current.
 * - After 202, clear state/cache/preference and navigate based on remaining workspaces.
 */
export function WorkspaceSettingsPage() {
  const { state, actions } = useAuth();
  const navigate = useNavigate();
  const timezones = useRef(listTimezones());

  const [workspace, setWorkspace] = useState<CurrentWorkspaceResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  // Deletion form state
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load workspace on mount
  useEffect(() => {
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
  }, []);

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

  const handleDelete = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!workspace) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const request = { confirmationSlug: confirmSlug, password: deletePassword };
      setDeletePassword("");
      setConfirmSlug("");
      await deleteWorkspace(request);
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
    } catch (err) {
      setDeletePassword("");
      if (err instanceof ApiError) {
        setDeleteError(err.problem.detail ?? "Failed to delete workspace.");
      } else {
        setDeleteError("An unexpected error occurred.");
      }
    } finally {
      setDeleting(false);
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

  // Must be authenticated.
  if (state.status !== "authenticated") return null;

  return (
    <AppShell>
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "3rem 1.5rem" }}>
        <header style={{ marginBottom: "3rem" }}>
          <h1 id="settings-title" style={{ fontSize: "2rem", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)", margin: 0 }}>
            Workspace Settings
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem", fontSize: "1rem" }}>
            Manage your workspace preferences and settings.
          </p>
        </header>

        {loadError && <InlineAlert kind="error" message={loadError} />}

        {!workspace && !loadError && (
          <p style={{ color: "var(--text-secondary)" }}>Loading…</p>
        )}

        {workspace && (
          <>
            {/* ── General Settings Card ─────────────────────────── */}
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

            {/* ── Danger zone ──────────────────────────────────── */}
            <section className="card" style={{ width: "100%", marginBottom: "2.5rem" }}>
              <h2 style={{ fontSize: "1.2rem", marginTop: 0 }}>Create another workspace</h2>
              <p style={{ color: "var(--text-secondary)" }}>
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
            </section>

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

                  <FormField
                    id="delete-password"
                    label="Your current password"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />

                  {deleteError && <InlineAlert kind="error" message={deleteError} />}

                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button
                      type="submit"
                      id="confirm-delete-btn"
                      className="danger-button"
                      disabled={deleting || confirmSlug !== workspace.slug}
                    >
                      {deleting ? "Deleting…" : "Confirm delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteForm(false);
                        setConfirmSlug("");
                        setDeletePassword("");
                        setDeleteError(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
