import { useContext } from "react";
import { ProjectContext } from "./ProjectContext.js";

export function useProjects() {
  const value = useContext(ProjectContext);
  if (!value) throw new Error("useProjects must be used inside ProjectProvider");
  return value;
}
