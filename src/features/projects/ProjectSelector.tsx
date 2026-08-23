import { NavigationDropdown } from "../../components/ui/NavigationDropdown.js";
import { useProjects } from "./useProjects.js";

interface ProjectSelectorProps {
  align?: "left" | "right";
}

export function ProjectSelector({ align = "right" }: ProjectSelectorProps = {}) {
  const { projects, selectedProject, loading, select } = useProjects();

  if (loading) {
    return <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>Loading projects…</span>;
  }
  if (projects.length === 0) return null;

  return (
    <div className="navigation-dropdown-field">
      <span>Project</span>
      <NavigationDropdown
        id="project-selector"
        ariaLabel="Selected project"
        options={projects.map((project) => ({ id: project.id, label: project.name }))}
        selectedId={selectedProject?.id ?? ""}
        onSelect={select}
        align={align}
      />
    </div>
  );
}
