import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../auth/AuthProvider.js";
import { queryKeys } from "../../api/queryKeys.js";
import {
  listProjectPullRequestRisks,
  type ProjectPullRequestRiskFilters,
} from "./api.js";

export function useProjectPullRequestRisks(
  projectId: string | null,
  filters: ProjectPullRequestRiskFilters,
) {
  const { state } = useAuth();
  const workspaceId = state.status === "authenticated"
    ? state.currentMembership.workspaceId
    : null;

  return useQuery({
    queryKey: workspaceId && projectId
      ? queryKeys.projectPullRequestRisks(workspaceId, projectId, filters)
      : ["project-pull-request-risks-disabled"],
    queryFn: ({ signal }) => listProjectPullRequestRisks(projectId!, filters, signal),
    enabled: Boolean(workspaceId && projectId),
    staleTime: 30 * 1000,
  });
}
