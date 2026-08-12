import { createContext } from "react";
import type { ProjectResponse } from "./api.js";

export interface ProjectContextValue {
  projects: ProjectResponse[];
  selectedProject: ProjectResponse | null;
  loading: boolean;
  error: string | null;
  select(projectId: string): void;
  reload(): Promise<void>;
}

export const ProjectContext = createContext<ProjectContextValue | null>(null);
