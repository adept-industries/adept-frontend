import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router";
import { AppShell } from "../../components/layout/AppShell.js";
import { FormField } from "../../components/ui/FormField.js";
import { InlineAlert } from "../../components/ui/InlineAlert.js";
import { listRepositories, type RepositoryResponse } from "../integrations/api.js";
import { createProject, deleteProject, replaceProjectRepositories, updateProject } from "./api.js";
import { useProjects } from "./useProjects.js";
import { RepoLeadManager } from "./components/RepoLeadManager.js";

export function ProjectsPage() {
  const { projects, loading, error, reload } = useProjects();
  const [availableRepos, setAvailableRepos] = useState<RepositoryResponse[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createRepoIds, setCreateRepoIds] = useState<string[]>([]);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateProjectForm, setShowCreateProjectForm] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRepoIds, setEditRepoIds] = useState<string[]>([]);

  const fetchCatalog = async () => {
    try {
      const repos = await listRepositories();
      setAvailableRepos(repos ?? []);
    } catch {
      setAvailableRepos([]);
    }
  };

  useEffect(() => {
    void fetchCatalog();
  }, []);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSubmitting(true);
    setMutationError(null);
    try {
      const newProj = await createProject({ name: trimmedName, description: description.trim() || undefined });
      if (createRepoIds.length > 0) {
        await replaceProjectRepositories(newProj.id, { repositoryIds: createRepoIds });
      }
      setName("");
      setDescription("");
      setCreateRepoIds([]);
      setShowCreateProjectForm(false);
      await reload();
    } catch (err: unknown) {
      setMutationError(err instanceof Error ? err.message : "Project could not be created.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!window.confirm("Delete this project grouping? Repositories and analytics will remain.")) return;
    setMutationError(null);
    try {
      await deleteProject(projectId);
      await reload();
    } catch (err: unknown) {
      setMutationError(err instanceof Error ? err.message : "Project could not be deleted.");
    }
  };

  const beginEdit = (projectId: string, projectName: string, projectDescription?: string, currentRepoIds: string[] = []) => {
    setEditingId(projectId);
    setEditName(projectName);
    setEditDescription(projectDescription ?? "");
    setEditRepoIds(currentRepoIds);
    setMutationError(null);
    void fetchCatalog();
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingId) return;
    const trimmedName = editName.trim();
    if (!trimmedName) return;
    setSubmitting(true);
    setMutationError(null);
    try {
      await updateProject(editingId, {
        name: trimmedName,
        description: editDescription.trim() || undefined,
      });
      await replaceProjectRepositories(editingId, {
        repositoryIds: editRepoIds,
      });
      setEditingId(null);
      await reload();
    } catch (err: unknown) {
      setMutationError(err instanceof Error ? err.message : "Project could not be updated.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCreateRepo = (repoId: string) => {
    setCreateRepoIds((prev) =>
      prev.includes(repoId) ? prev.filter((id) => id !== repoId) : [...prev, repoId]
    );
  };

  const toggleEditRepo = (repoId: string) => {
    setEditRepoIds((prev) =>
      prev.includes(repoId) ? prev.filter((id) => id !== repoId) : [...prev, repoId]
    );
  };

  return (
    <AppShell>
      <div style={{ maxWidth: "920px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        {/* Navigation Breadcrumb */}
        <div>
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

        <header style={{ marginBottom: "0.25rem" }}>
          <h1 style={{ fontSize: "2rem", margin: 0 }}>Project Settings</h1>
          <p style={{ color: "var(--text-secondary, #94a3b8)", marginTop: "0.35rem", fontSize: "0.95rem" }}>
            Create projects, attach tracked repositories, and assign repository Leads directly to grant scoped access.
          </p>
        </header>

        {mutationError && <InlineAlert message={mutationError} kind="error" />}
        {error && <InlineAlert message={error} kind="error" />}

        {/* Create Project Card */}
        <section className="card" style={{ width: "100%", padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
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
              <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Create Project</h2>
              <p style={{ color: "var(--text-secondary, #94a3b8)", margin: "0.5rem 0 0", fontSize: "0.9rem" }}>
                Group tracked repositories and assign their Leads.
              </p>
            </div>
            <button
              type="button"
              className="button-link"
              aria-expanded={showCreateProjectForm}
              aria-controls="create-project-panel"
              aria-label={`${showCreateProjectForm ? "Collapse" : "Expand"} create project form`}
              onClick={() => setShowCreateProjectForm((visible) => !visible)}
            >
              {showCreateProjectForm ? "Collapse" : "Expand"}
            </button>
          </div>

          {showCreateProjectForm && (
          <form id="create-project-panel" onSubmit={(event) => void handleCreate(event)} style={{ display: "grid", gap: "1.25rem" }}>
            <FormField
              id="project-name"
              label="Project name"
              required
              maxLength={160}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <FormField
              id="project-description"
              label="Description (optional)"
              maxLength={1000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />

            {/* Repository Multi-select for Creation */}
            <div>
              <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: "0.5rem" }}>
                Attach Repositories & Assign Leads ({createRepoIds.length} selected)
              </label>
              {availableRepos.length === 0 ? (
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary, #94a3b8)", margin: 0 }}>
                  No repositories available in catalog. Go to{" "}
                  <Link to="/dashboard/integrations" style={{ color: "var(--primary-color, #6366f1)" }}>
                    Integrations
                  </Link>{" "}
                  to connect GitHub.
                </p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gap: "0.75rem",
                    padding: "0.85rem",
                    backgroundColor: "var(--input-bg, #1a1a28)",
                    border: "1px solid var(--border-color, #2d2d42)",
                    borderRadius: "8px",
                  }}
                >
                  {availableRepos.map((repo) => {
                    const isSelected = createRepoIds.includes(repo.id);
                    return (
                      <div
                        key={repo.id}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.5rem",
                          padding: "0.6rem 0.75rem",
                          borderRadius: "6px",
                          backgroundColor: isSelected ? "rgba(99, 102, 241, 0.06)" : "transparent",
                          border: `1px solid ${isSelected ? "rgba(99, 102, 241, 0.3)" : "transparent"}`,
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.6rem",
                            fontSize: "0.9rem",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCreateRepo(repo.id)}
                          />
                          <span style={{ fontWeight: 600 }}>{repo.fullName}</span>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-secondary, #94a3b8)",
                              marginLeft: "auto",
                            }}
                          >
                            {repo.visibility}
                          </span>
                        </label>

                        {/* Inline Lead assignment for selected repo */}
                        {isSelected && (
                          <div style={{ paddingLeft: "1.75rem" }}>
                            <RepoLeadManager
                              repositoryId={repo.id}
                              repositoryName={repo.fullName}
                              compact
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <button type="submit" className="primary-button" disabled={submitting || !name.trim()}>
                {submitting ? "Creating…" : "Create Project"}
              </button>
            </div>
          </form>
          )}
        </section>

        {/* Existing Projects List */}
        <div style={{ display: "grid", gap: "1.5rem" }}>
          {loading && <p style={{ color: "var(--text-secondary)" }}>Loading projects…</p>}
          {!loading && projects.length === 0 && (
            <p style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>
              No projects created yet. Create your first project above to group repositories and assign Leads.
            </p>
          )}
          {projects.map((project) => (
            <section
              key={project.id}
              className="card"
              style={{
                width: "100%",
                padding: "1.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
              }}
            >
              {editingId === project.id ? (
                <form onSubmit={(event) => void handleUpdate(event)} style={{ display: "grid", gap: "1.25rem" }}>
                  <FormField
                    id={`edit-project-name-${project.id}`}
                    label="Project name"
                    required
                    maxLength={160}
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                  />
                  <FormField
                    id={`edit-project-description-${project.id}`}
                    label="Description (optional)"
                    maxLength={1000}
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                  />

                  {/* Edit Repositories Multi-select */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, marginBottom: "0.5rem" }}>
                      Manage Attached Repositories & Leads ({editRepoIds.length} attached)
                    </label>
                    <div
                      style={{
                        display: "grid",
                        gap: "0.75rem",
                        padding: "0.85rem",
                        backgroundColor: "var(--input-bg, #1a1a28)",
                        border: "1px solid var(--border-color, #2d2d42)",
                        borderRadius: "8px",
                      }}
                    >
                      {availableRepos.map((repo) => {
                        const isSelected = editRepoIds.includes(repo.id);
                        return (
                          <div
                            key={repo.id}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.5rem",
                              padding: "0.6rem 0.75rem",
                              borderRadius: "6px",
                              backgroundColor: isSelected ? "rgba(99, 102, 241, 0.06)" : "transparent",
                              border: `1px solid ${isSelected ? "rgba(99, 102, 241, 0.3)" : "transparent"}`,
                            }}
                          >
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.6rem",
                                fontSize: "0.9rem",
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleEditRepo(repo.id)}
                              />
                              <span style={{ fontWeight: 600 }}>{repo.fullName}</span>
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--text-secondary, #94a3b8)",
                                  marginLeft: "auto",
                                }}
                              >
                                {repo.visibility}
                              </span>
                            </label>

                            {/* Inline Lead assignment for selected repo */}
                            {isSelected && (
                              <div style={{ paddingLeft: "1.75rem" }}>
                                <RepoLeadManager
                                  repositoryId={repo.id}
                                  repositoryName={repo.fullName}
                                  compact
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button type="submit" className="primary-button" disabled={submitting || !editName.trim()}>
                      {submitting ? "Saving…" : "Save changes"}
                    </button>
                    <button type="button" className="button-link" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 600 }}>{project.name}</h2>
                      {project.description && (
                        <p style={{ margin: "0.35rem 0 0 0", color: "var(--text-secondary, #94a3b8)", fontSize: "0.9rem" }}>
                          {project.description}
                        </p>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                      <button
                        type="button"
                        className="button-link"
                        onClick={() =>
                          beginEdit(
                            project.id,
                            project.name,
                            project.description,
                            project.repositories.map((r) => r.id)
                          )
                        }
                      >
                        Edit project
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => void handleDelete(project.id)}
                        style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem" }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Attached Repositories & Assigned Leads */}
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary, #94a3b8)", marginBottom: "0.6rem" }}>
                      {project.repositories.length} Attached {project.repositories.length === 1 ? "Repository" : "Repositories"}
                    </div>
                    {project.repositories.length === 0 ? (
                      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary, #94a3b8)", margin: 0, fontStyle: "italic" }}>
                        No repositories attached yet. Click &ldquo;Edit project&rdquo; to attach repositories and assign Leads.
                      </p>
                    ) : (
                      <div style={{ display: "grid", gap: "0.85rem" }}>
                        {project.repositories.map((repo) => (
                          <div
                            key={repo.id}
                            style={{
                              padding: "0.85rem 1rem",
                              borderRadius: "8px",
                              backgroundColor: "var(--input-bg, #141420)",
                              border: "1px solid var(--border-color, #2d2d42)",
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.65rem",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                  color: "var(--primary-light, #818cf8)",
                                  fontWeight: 600,
                                  fontSize: "0.95rem",
                                }}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                                </svg>
                                {repo.fullName}
                              </span>
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "0.15rem 0.45rem",
                                  borderRadius: "4px",
                                  backgroundColor: repo.trackingEnabled ? "rgba(34, 197, 94, 0.15)" : "rgba(148, 163, 184, 0.15)",
                                  color: repo.trackingEnabled ? "#22c55e" : "var(--text-secondary, #94a3b8)",
                                  fontWeight: 600,
                                }}
                              >
                                {repo.trackingEnabled ? "Tracked" : "Untracked"}
                              </span>
                            </div>

                            {/* Repo Lead Manager & Assignment View */}
                            <RepoLeadManager
                              repositoryId={repo.id}
                              repositoryName={repo.fullName}
                              onAssignmentsChange={() => void reload()}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
