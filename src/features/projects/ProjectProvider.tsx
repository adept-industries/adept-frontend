import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthProvider.js";
import { projectPreference } from "../../lib/projectPreference.js";
import { ProjectContext, type ProjectContextValue } from "./ProjectContext.js";
import { listProjects, type ProjectResponse } from "./api.js";

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const workspaceId = state.status === "authenticated"
    ? state.currentMembership.workspaceId
    : null;
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!workspaceId) {
      setProjects([]);
      setSelectedId(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await listProjects();
      setProjects(next);
      const preferred = projectPreference.get(workspaceId);
      const selected = next.find((project) => project.id === preferred) ?? next[0] ?? null;
      setSelectedId(selected?.id ?? null);
      if (selected) projectPreference.set(workspaceId, selected.id);
      else projectPreference.clear(workspaceId);
    } catch {
      setProjects([]);
      setSelectedId(null);
      setError("Projects could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const select = useCallback((projectId: string) => {
    if (!workspaceId || !projects.some((project) => project.id === projectId)) return;
    setSelectedId(projectId);
    projectPreference.set(workspaceId, projectId);
  }, [projects, workspaceId]);

  const value = useMemo<ProjectContextValue>(() => ({
    projects,
    selectedProject: projects.find((project) => project.id === selectedId) ?? null,
    loading,
    error,
    select,
    reload,
  }), [projects, selectedId, loading, error, select, reload]);

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}
