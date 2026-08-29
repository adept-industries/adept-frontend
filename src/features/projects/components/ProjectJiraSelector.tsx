import type { JiraProjectResponse } from "../../integrations/api.js";

interface ProjectJiraSelectorProps {
  projects: JiraProjectResponse[];
  selectedIds: string[];
  onToggle: (jiraProjectId: string) => void;
}

export function ProjectJiraSelector({
  projects,
  selectedIds,
  onToggle,
}: ProjectJiraSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Jira projects for this project"
      style={{
        display: "grid",
        gap: "0.5rem",
        padding: "0.85rem",
        borderRadius: "8px",
        backgroundColor: "var(--input-bg, #141420)",
        border: "1px solid var(--border-color, #2d2d42)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
        <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>Jira projects</span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary, #94a3b8)" }}>
          {selectedIds.length} mapped
        </span>
      </div>

      <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary, #94a3b8)" }}>
        These Jira projects apply to the whole Adept project and all of its attached repositories.
      </p>

      {projects.length === 0 ? (
        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary, #94a3b8)" }}>
          No tracked Jira projects are available. Track a Jira project from Integrations first.
        </p>
      ) : (
        <div style={{ display: "grid", gap: "0.4rem" }}>
          {projects.map((project) => {
            const checked = selectedIds.includes(project.id);
            return (
              <label
                key={project.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.55rem",
                  padding: "0.45rem 0.55rem",
                  borderRadius: "5px",
                  cursor: "pointer",
                  backgroundColor: checked ? "rgba(99, 102, 241, 0.1)" : "transparent",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(project.id)}
                  aria-label={`Map [${project.projectKey}] ${project.projectName} to this project`}
                />
                <span style={{ fontSize: "0.82rem" }}>
                  [{project.projectKey}] {project.projectName}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
