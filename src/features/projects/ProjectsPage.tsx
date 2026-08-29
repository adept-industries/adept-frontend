import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../auth/AuthProvider.js";
import { AppShell } from "../../components/layout/AppShell.js";
import { FormField } from "../../components/ui/FormField.js";
import { InlineAlert } from "../../components/ui/InlineAlert.js";
import {
  listJiraProjects,
  listRepositories,
  type JiraProjectResponse,
  type RepositoryResponse,
} from "../integrations/api.js";
import {
  createProject,
  deleteProject,
  replaceProjectConfiguration,
  updateProject,
  type ProjectResponse,
} from "./api.js";
import { useProjects } from "./useProjects.js";
import { RepoLeadManager } from "./components/RepoLeadManager.js";
import { RepositoryJiraSelector } from "./components/RepositoryJiraSelector.js";

type JiraSelectionsByRepository = Record<string, string[]>;

function toggleJiraSelection(
  current: JiraSelectionsByRepository,
  repositoryId: string,
  jiraProjectId: string,
): JiraSelectionsByRepository {
  const selected = current[repositoryId] ?? [];
  return {
    ...current,
    [repositoryId]: selected.includes(jiraProjectId)
      ? selected.filter((id) => id !== jiraProjectId)
      : [...selected, jiraProjectId],
  };
}

export function ProjectsPage() {
  const { state } = useAuth();
  const { projects, loading, error, reload } = useProjects();
  const isManager = state.status === "authenticated" && state.currentMembership.role === "MANAGER";
  const [availableRepos, setAvailableRepos] = useState<RepositoryResponse[]>([]);
  const [jiraProjects, setJiraProjects] = useState<JiraProjectResponse[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createRepoIds, setCreateRepoIds] = useState<string[]>([]);
  const [createJiraSelections, setCreateJiraSelections] = useState<JiraSelectionsByRepository>({});
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateProjectForm, setShowCreateProjectForm] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRepoIds, setEditRepoIds] = useState<string[]>([]);
  const [editJiraSelections, setEditJiraSelections] = useState<JiraSelectionsByRepository>({});

  const fetchCatalog = useCallback(async () => {
    const [repos, projects] = await Promise.all([
      listRepositories(true).catch(() => []),
      listJiraProjects().catch(() => []),
    ]);
    setAvailableRepos((repos ?? []).filter((repo) => repo.trackingEnabled && !repo.archived));
    setJiraProjects((projects ?? []).filter((project) => project.trackingEnabled));
  }, []);

  useEffect(() => {
    if (!isManager) {
      setAvailableRepos([]);
      setJiraProjects([]);
      setShowCreateProjectForm(false);
      setEditingId(null);
      return;
    }
    void fetchCatalog();
  }, [fetchCatalog, isManager]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSubmitting(true);
    setMutationError(null);
    try {
      await createProject({
        name: trimmedName,
        description: description.trim() || undefined,
        repositories: createRepoIds.map((repositoryId) => ({
          repositoryId,
          jiraProjectIds: createJiraSelections[repositoryId] ?? [],
        })),
      });
      setName("");
      setDescription("");
      setCreateRepoIds([]);
      setCreateJiraSelections({});
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

  const beginEdit = (project: ProjectResponse) => {
    setEditingId(project.id);
    setEditName(project.name);
    setEditDescription(project.description ?? "");
    setEditRepoIds(project.repositories.map((repo) => repo.id));
    setEditJiraSelections(Object.fromEntries(
      project.repositories.map((repo) => [
        repo.id,
        repo.jiraProjects
          .filter((jiraProject) => jiraProject.trackingEnabled)
          .map((jiraProject) => jiraProject.id),
      ]),
    ));
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
      await replaceProjectConfiguration(editingId, {
        repositories: editRepoIds.map((repositoryId) => ({
          repositoryId,
          jiraProjectIds: editJiraSelections[repositoryId] ?? [],
        })),
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

  const toggleCreateJiraProject = (repositoryId: string, jiraProjectId: string) => {
    setCreateJiraSelections((current) => toggleJiraSelection(current, repositoryId, jiraProjectId));
  };

  const toggleEditJiraProject = (repositoryId: string, jiraProjectId: string) => {
    setEditJiraSelections((current) => toggleJiraSelection(current, repositoryId, jiraProjectId));
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
          <h1 style={{ fontSize: "2rem", margin: 0 }}>{isManager ? "Project Settings" : "Projects"}</h1>
          <p style={{ color: "var(--text-secondary, #94a3b8)", marginTop: "0.35rem", fontSize: "0.95rem" }}>
            {isManager
              ? "Create projects, attach tracked repositories, map Jira projects, and assign repository Leads."
              : "View projects containing repositories assigned to you."}
          </p>
        </header>

        {mutationError && <InlineAlert message={mutationError} kind="error" />}
        {error && <InlineAlert message={error} kind="error" />}

        {/* Create Project Card */}
        {isManager && (
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
                Group tracked repositories, map Jira projects, and assign their Leads.
              </p>
            </div>
            <button
              type="button"
              className="button-link"
              aria-expanded={showCreateProjectForm}
              aria-controls="create-project-panel"
              aria-label={`${showCreateProjectForm ? "Collapse" : "Create"} project`}
              onClick={() => setShowCreateProjectForm((visible) => !visible)}
            >
              {showCreateProjectForm ? "Collapse" : "Create"}
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
                Attach Repositories, Map Jira & Assign Leads ({createRepoIds.length} selected)
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

                        {/* Inline Jira mapping and Lead assignment for selected repo */}
                        {isSelected && (
                          <div style={{ paddingLeft: "1.75rem", display: "grid", gap: "0.75rem" }}>
                            <RepositoryJiraSelector
                              repositoryName={repo.fullName ?? repo.name ?? repo.id}
                              projects={jiraProjects}
                              selectedIds={createJiraSelections[repo.id] ?? []}
                              onToggle={(jiraProjectId) => toggleCreateJiraProject(repo.id, jiraProjectId)}
                            />
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
        )}

        {/* Existing Projects List */}
        <div style={{ display: "grid", gap: "1.5rem" }}>
          {loading && <p style={{ color: "var(--text-secondary)" }}>Loading projects…</p>}
          {!loading && projects.length === 0 && (
            <p style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>
              {isManager
                ? "No projects created yet. Create your first project above to group repositories and assign Leads."
                : "No assigned projects yet. Projects appear here when a Manager assigns you to a tracked repository."}
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
              {isManager && editingId === project.id ? (
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
                      Manage Repositories, Jira Mappings & Leads ({editRepoIds.length} attached)
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

                            {/* Inline Jira mapping and Lead assignment for selected repo */}
                            {isSelected && (
                              <div style={{ paddingLeft: "1.75rem", display: "grid", gap: "0.75rem" }}>
                                <RepositoryJiraSelector
                                  repositoryName={repo.fullName ?? repo.name ?? repo.id}
                                  projects={jiraProjects}
                                  selectedIds={editJiraSelections[repo.id] ?? []}
                                  onToggle={(jiraProjectId) => toggleEditJiraProject(repo.id, jiraProjectId)}
                                />
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
                    {isManager && (
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                      <button
                        type="button"
                        className="button-link"
                        onClick={() => beginEdit(project)}
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
                    )}
                  </div>

                  {/* Attached Repositories & Assigned Leads */}
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary, #94a3b8)", marginBottom: "0.6rem" }}>
                      {project.repositories.length} Attached {project.repositories.length === 1 ? "Repository" : "Repositories"}
                    </div>
                    {project.repositories.length === 0 ? (
                      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary, #94a3b8)", margin: 0, fontStyle: "italic" }}>
                        {isManager
                          ? <>No repositories attached yet. Click &ldquo;Edit project&rdquo; to attach repositories and assign Leads.</>
                          : "No assigned repositories are available in this project."}
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

                            <div>
                              <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary, #94a3b8)", marginBottom: "0.35rem" }}>
                                Jira projects
                              </div>
                              {repo.jiraProjects.length === 0 ? (
                                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary, #94a3b8)" }}>
                                  No Jira projects mapped
                                </span>
                              ) : (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                                  {repo.jiraProjects.map((jiraProject) => (
                                    <span
                                      key={jiraProject.id}
                                      style={{
                                        padding: "0.2rem 0.45rem",
                                        borderRadius: "4px",
                                        backgroundColor: "rgba(99, 102, 241, 0.12)",
                                        color: "var(--primary-light, #818cf8)",
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                      }}
                                    >
                                      [{jiraProject.projectKey}] {jiraProject.projectName}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Repository lead management is Manager-only. */}
                            {isManager && (
                              <RepoLeadManager
                                repositoryId={repo.id}
                                repositoryName={repo.fullName}
                                onAssignmentsChange={() => void reload()}
                              />
                            )}
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
