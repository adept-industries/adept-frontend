import { type FormEvent, useState } from "react";
import { AppShell } from "../../components/layout/AppShell.js";
import { FormField } from "../../components/ui/FormField.js";
import { InlineAlert } from "../../components/ui/InlineAlert.js";
import { createProject, deleteProject, updateProject } from "./api.js";
import { useProjects } from "./useProjects.js";

export function ProjectsPage() {
  const { projects, loading, error, reload } = useProjects();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMutationError(null);
    try {
      await createProject({ name, description: description || undefined });
      setName("");
      setDescription("");
      await reload();
    } catch {
      setMutationError("Project could not be created.");
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
    } catch {
      setMutationError("Project could not be deleted.");
    }
  };

  const beginEdit = (projectId: string, projectName: string, projectDescription?: string) => {
    setEditingId(projectId);
    setEditName(projectName);
    setEditDescription(projectDescription ?? "");
    setMutationError(null);
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingId) return;
    setSubmitting(true);
    setMutationError(null);
    try {
      await updateProject(editingId, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      setEditingId(null);
      await reload();
    } catch {
      setMutationError("Project could not be updated.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <header style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "2rem", margin: 0 }}>Projects</h1>
          <p style={{ color: "var(--text-secondary)" }}>
            Group repositories for dashboard and DORA filtering. Repository assignment remains the Lead access rule.
          </p>
        </header>

        <section className="card" style={{ width: "100%", marginBottom: "2rem" }}>
          <h2>Create project</h2>
          <form onSubmit={(event) => void handleCreate(event)} style={{ display: "grid", gap: "1rem" }}>
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
            {mutationError && <InlineAlert message={mutationError} />}
            <button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? "Creating…" : "Create project"}
            </button>
          </form>
        </section>

        {error && <InlineAlert message={error} />}
        {loading && <p>Loading projects…</p>}
        {!loading && projects.length === 0 && (
          <p style={{ color: "var(--text-secondary)" }}>No projects have been created.</p>
        )}
        <div style={{ display: "grid", gap: "1rem" }}>
          {projects.map((project) => (
            <section key={project.id} className="card" style={{ width: "100%", padding: "1.5rem" }}>
              {editingId === project.id ? (
                <form onSubmit={(event) => void handleUpdate(event)} style={{ display: "grid", gap: "1rem" }}>
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
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button type="submit" disabled={submitting || !editName.trim()}>
                      {submitting ? "Saving…" : "Save changes"}
                    </button>
                    <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </form>
              ) : (
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                <div>
                  <h2 style={{ marginTop: 0 }}>{project.name}</h2>
                  {project.description && <p>{project.description}</p>}
                  <p style={{ color: "var(--text-secondary)" }}>
                    {project.repositories.length} linked repositories
                  </p>
                  {project.repositories.map((repository) => (
                    <div key={repository.id}>{repository.fullName}</div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <button
                    type="button"
                    onClick={() => beginEdit(project.id, project.name, project.description)}
                  >
                    Edit project
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => void handleDelete(project.id)}
                  >
                    Delete project
                  </button>
                </div>
              </div>
              )}
              {project.repositories.length === 0 && (
                <p style={{ color: "var(--text-secondary)" }}>
                  Repositories can be attached after the Phase 3 GitHub repository catalog is available.
                </p>
              )}
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
