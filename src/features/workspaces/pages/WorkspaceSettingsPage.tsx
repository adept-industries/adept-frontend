import { type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AppShell } from "../../../components/layout/AppShell";
import { FormField } from "../../../components/ui/FormField";
import { InlineAlert } from "../../../components/ui/InlineAlert";
import { useAuth } from "../../../auth/AuthProvider";
import {
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
      setSaveSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setSaveError(err.problem.detail ?? "Failed to save settings.");
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
      const result = await deleteWorkspace({ confirmSlug, password: deletePassword });
      // Clear password from state immediately.
      setDeletePassword("");
      setConfirmSlug("");

      // Clear all session state.
      accessTokenStore.clear();
      workspacePreference.clear();
      queryClient.clear();

      // Navigate based on remaining workspaces.
      const remaining = result.remainingWorkspaces ?? [];
      if (remaining.length === 0) {
        // No workspaces remain — go to login with a note.
        void navigate("/login?deleted=1", { replace: true });
      } else if (remaining.length === 1) {
        // One remaining — refresh will auto-select it.
        await actions.refresh();
        void navigate("/dashboard", { replace: true });
      } else {
        // Multiple remaining — go to selection.
        await actions.refresh();
        void navigate("/select-workspace", { replace: true });
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
            <div style={{
              background: "linear-gradient(145deg, rgba(30, 30, 35, 0.4) 0%, rgba(15, 15, 18, 0.6) 100%)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: "1rem",
              padding: "2.5rem",
              marginBottom: "2.5rem",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)"
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

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem", borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: "1.5rem" }}>
                  <button
                    type="submit"
                    id="save-settings-btn"
                    className="premium-btn"
                    disabled={saving}
                    style={{
                      padding: "0.75rem 1.5rem",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "0.5rem",
                      fontWeight: 600,
                      cursor: saving ? "not-allowed" : "pointer",
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
            </div>

            {/* ── Danger zone ──────────────────────────────────── */}
            <section
              aria-labelledby="danger-title"
              style={{
                border: "1px solid rgba(220, 38, 38, 0.3)",
                borderRadius: "1rem",
                padding: "2.5rem",
                background: "linear-gradient(145deg, rgba(30, 10, 10, 0.4) 0%, rgba(15, 5, 5, 0.6) 100%)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
              }}
            >
              <h2 id="danger-title" style={{ fontSize: "1.2rem", fontWeight: 600, color: "#fca5a5", marginBottom: "0.5rem" }}>
                Danger Zone
              </h2>
              <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", marginBottom: "2rem" }}>
                Access stops immediately and final data removal is queued. This cannot be undone.
              </p>

              {!showDeleteForm ? (
                <button
                  id="show-delete-form-btn"
                  type="button"
                  onClick={() => setShowDeleteForm(true)}
                  style={{
                    padding: "0.6rem 1.2rem",
                    background: "rgba(220, 38, 38, 0.1)",
                    border: "1px solid rgba(220, 38, 38, 0.4)",
                    borderRadius: "0.5rem",
                    color: "#fca5a5",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(220, 38, 38, 0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(220, 38, 38, 0.1)";
                  }}
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
                    Type <strong style={{ color: "#fca5a5" }}>{workspace.slug}</strong> to confirm.
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
                      disabled={deleting || confirmSlug !== workspace.slug}
                      style={{
                        padding: "0.6rem 1.2rem",
                        background: deleting || confirmSlug !== workspace.slug ? "rgba(255,255,255,0.1)" : "#dc2626",
                        color: deleting || confirmSlug !== workspace.slug ? "var(--text-secondary)" : "#ffffff",
                        border: "none",
                        borderRadius: "0.5rem",
                        fontWeight: 600,
                        cursor: deleting || confirmSlug !== workspace.slug ? "not-allowed" : "pointer",
                        fontSize: "0.9rem",
                        transition: "all 0.2s ease"
                      }}
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
                      style={{
                        padding: "0.6rem 1.2rem",
                        background: "transparent",
                        border: "1px solid var(--border-color)",
                        borderRadius: "0.5rem",
                        cursor: "pointer",
                        fontSize: "0.9rem",
                        color: "var(--text-primary)",
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
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
