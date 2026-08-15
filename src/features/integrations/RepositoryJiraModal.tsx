import { useEffect, useState } from "react";
import {
  getMappedJiraProjects,
  listJiraProjects,
  mapJiraProjectsToRepository,
  type JiraProjectResponse,
  type RepositoryResponse,
} from "./api.js";

interface RepositoryJiraModalProps {
  repository: RepositoryResponse;
  onClose: () => void;
  onSaved: () => void;
}

export function RepositoryJiraModal({
  repository,
  onClose,
  onSaved,
}: RepositoryJiraModalProps) {
  const [projects, setProjects] = useState<JiraProjectResponse[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const [allProjects, mapped] = await Promise.all([
          listJiraProjects(),
          getMappedJiraProjects(repository.id),
        ]);
        if (active) {
          setProjects(allProjects);
          setSelectedIds(new Set(mapped.map((p) => p.id)));
        }
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load Jira projects");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadData();
    return () => {
      active = false;
    };
  }, [repository.id]);

  const toggleProject = (projectId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await mapJiraProjectsToRepository(repository.id, Array.from(selectedIds));
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save project mappings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        className="modal-card"
        style={{
          backgroundColor: "var(--card-bg, #1a1a24)",
          border: "1px solid var(--border-color, #2d2d3d)",
          borderRadius: "8px",
          padding: "1.5rem",
          maxWidth: "520px",
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
              Map Jira Projects
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary, #94a3b8)", margin: "0.25rem 0 0 0" }}>
              Associate Jira issue sources with {repository.name}
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", color: "var(--text-secondary, #94a3b8)", cursor: "pointer", fontSize: "1.2rem" }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: "0.75rem",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid #ef4444",
              borderRadius: "6px",
              color: "#f87171",
              fontSize: "0.85rem",
              marginBottom: "1rem",
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ color: "var(--text-secondary, #94a3b8)", fontSize: "0.9rem" }}>Loading Jira projects...</p>
        ) : projects.length === 0 ? (
          <p style={{ color: "var(--text-secondary, #94a3b8)", fontSize: "0.9rem" }}>
            No Jira projects discovered yet. Connect Jira Cloud to discover projects.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
            {projects.map((proj) => {
              const isChecked = selectedIds.has(proj.id);
              return (
                <label
                  key={proj.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "6px",
                    backgroundColor: isChecked ? "rgba(99, 102, 241, 0.1)" : "var(--input-bg, #242436)",
                    border: `1px solid ${isChecked ? "var(--primary-color, #6366f1)" : "var(--border-color, #3b3b54)"}`,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleProject(proj.id)}
                    style={{ width: "1rem", height: "1rem", cursor: "pointer" }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                      [{proj.projectKey}] {proj.projectName}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary, #94a3b8)" }}>
                      Type: {proj.projectType}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <button
            type="button"
            className="button-link"
            onClick={onClose}
            disabled={saving}
            style={{ padding: "0.5rem 1rem" }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleSave}
            disabled={saving || loading}
            style={{ padding: "0.5rem 1.25rem" }}
          >
            {saving ? "Saving..." : "Save Mappings"}
          </button>
        </div>
      </div>
    </div>
  );
}
