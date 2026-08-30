import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../api/queryKeys.js";
import { useAuth } from "../../auth/AuthProvider.js";
import {
  listProjectGithubIssues,
  listProjectJiraIssues,
  type ProjectIssuePageRequest,
} from "./api.js";

function useProjectIssueContext() {
  const { state } = useAuth();
  return state.status === "authenticated"
    ? state.currentMembership.workspaceId
    : null;
}

export function useProjectGithubIssues(
  projectId: string | null,
  request: ProjectIssuePageRequest,
) {
  const workspaceId = useProjectIssueContext();
  return useQuery({
    queryKey: workspaceId && projectId
      ? queryKeys.projectGithubIssues(workspaceId, projectId, request)
      : ["project-github-issues-disabled"],
    queryFn: ({ signal }) => listProjectGithubIssues(projectId!, request, signal),
    enabled: Boolean(workspaceId && projectId),
    staleTime: 30 * 1000,
  });
}

export function useProjectJiraIssues(
  projectId: string | null,
  request: ProjectIssuePageRequest,
) {
  const workspaceId = useProjectIssueContext();
  return useQuery({
    queryKey: workspaceId && projectId
      ? queryKeys.projectJiraIssues(workspaceId, projectId, request)
      : ["project-jira-issues-disabled"],
    queryFn: ({ signal }) => listProjectJiraIssues(projectId!, request, signal),
    enabled: Boolean(workspaceId && projectId),
    staleTime: 30 * 1000,
  });
}
