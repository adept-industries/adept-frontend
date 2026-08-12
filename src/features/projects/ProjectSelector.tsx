import { useProjects } from "./useProjects.js";

export function ProjectSelector() {
  const { projects, selectedProject, loading, select } = useProjects();

  if (loading) {
    return <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>Loading projects…</span>;
  }
  if (projects.length === 0) return null;

  return (
    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
      <span>Project</span>
      <select
        id="project-selector"
        aria-label="Selected project"
        className="form-input"
        value={selectedProject?.id ?? ""}
        onChange={(event) => select(event.target.value)}
        style={{
          minHeight: "2.65rem",
          padding: "0.55rem 0.75rem",
          border: "1px solid var(--border-color)",
          borderRadius: "0.5rem",
          background: "var(--input-bg)",
          color: "var(--text-primary)",
        }}
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>{project.name}</option>
        ))}
      </select>
    </label>
  );
}
