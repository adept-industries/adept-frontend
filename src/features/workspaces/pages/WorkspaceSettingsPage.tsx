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
      <section
        aria-labelledby="settings-title"
        style={{ maxWidth: "600px", margin: "0 auto" }}
      >
        <p className="eyebrow" style={{ color: "#6b7280", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
          Workspace
        </p>
        <h1 id="settings-title" style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "2rem" }}>
          Settings
        </h1>

        {loadError && <InlineAlert kind="error" message={loadError} />}

        {!workspace && !loadError && (
          <p style={{ color: "#6b7280" }}>Loading…</p>
        )}

        {workspace && (
          <>
            {/* ── Name & Timezone form ─────────────────────────── */}
            <form
              id="workspace-settings-form"
              onSubmit={(e: FormEvent<HTMLFormElement>) => void handleSave(e)}
              noValidate
              style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2.5rem" }}
            >
              <FormField
                id="workspace-name"
                label="Workspace name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setSaveSuccess(false); }}
                required
                autoComplete="organization"
              />

              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label htmlFor="workspace-timezone" style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>
                  Timezone
                </label>
                <select
                  id="workspace-timezone"
                  value={timezone}
                  onChange={(e) => { setTimezone(e.target.value); setSaveSuccess(false); }}
                  style={{
                    padding: "0.625rem 0.75rem",
                    border: "1.5px solid #d1d5db",
                    borderRadius: "0.375rem",
                    fontSize: "0.9rem",
                    color: "#111827",
                    background: "#ffffff",
                  }}
                >
                  {timezones.current.map((tz) => (
                    <option key={tz} value={tz}>{formatTimezone(tz)}</option>
                  ))}
                </select>
              </div>

              {saveError && <InlineAlert kind="error" message={saveError} />}
              {saveSuccess && <InlineAlert kind="success" message="Settings saved successfully." />}

              <button
                type="submit"
                id="save-settings-btn"
                disabled={saving}
                style={{
                  padding: "0.625rem 1.25rem",
                  background: saving ? "#9ca3af" : "#4763d8",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0.375rem",
                  fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer",
                  alignSelf: "flex-start",
                }}
              >
                {saving ? "Saving…" : "Save settings"}
              </button>
            </form>

            {/* ── Danger zone ──────────────────────────────────── */}
            <section
              aria-labelledby="danger-title"
              style={{
                border: "1.5px solid #fca5a5",
                borderRadius: "0.5rem",
                padding: "1.5rem",
                background: "#fff5f5",
              }}
            >
              <h2 id="danger-title" style={{ fontSize: "1rem", fontWeight: 700, color: "#dc2626", marginBottom: "0.5rem" }}>
                Delete workspace
              </h2>
              <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "1rem" }}>
                Access stops immediately and final data removal is queued. This cannot be undone.
              </p>

              {!showDeleteForm ? (
                <button
                  id="show-delete-form-btn"
                  type="button"
                  onClick={() => setShowDeleteForm(true)}
                  style={{
                    padding: "0.5rem 1rem",
                    background: "transparent",
                    border: "1.5px solid #dc2626",
                    borderRadius: "0.375rem",
                    color: "#dc2626",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "0.875rem",
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
                  <p style={{ fontSize: "0.875rem", color: "#374151" }}>
                    Type <strong>{workspace.slug}</strong> to confirm.
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
                        padding: "0.5rem 1rem",
                        background: deleting || confirmSlug !== workspace.slug ? "#9ca3af" : "#dc2626",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "0.375rem",
                        fontWeight: 600,
                        cursor: deleting || confirmSlug !== workspace.slug ? "not-allowed" : "pointer",
                        fontSize: "0.875rem",
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
                        padding: "0.5rem 1rem",
                        background: "transparent",
                        border: "1.5px solid #d1d5db",
                        borderRadius: "0.375rem",
                        cursor: "pointer",
                        fontSize: "0.875rem",
                        color: "#374151",
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
      </section>
    </AppShell>
  );
}
