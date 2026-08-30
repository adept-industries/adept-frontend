import type { operations } from "../../api/generated/schema.js";
import { apiRequest } from "../../api/client.js";

export type PullRequestRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ProjectPullRequestRiskPage =
  operations["listProjectPullRequestRisks"]["responses"][200]["content"]["application/json"];
export type ProjectPullRequestRiskItem = ProjectPullRequestRiskPage["items"][number];
export type ProjectPullRequestRiskRebuild =
  operations["rebuildProjectPullRequestRisks"]["responses"][202]["content"]["application/json"];

export interface ProjectPullRequestRiskFilters {
  page: number;
  size: number;
  riskLevel?: PullRequestRiskLevel;
  stalledOnly: boolean;
}

export function listProjectPullRequestRisks(
  projectId: string,
  filters: ProjectPullRequestRiskFilters,
  signal?: AbortSignal,
): Promise<ProjectPullRequestRiskPage> {
  const query = new URLSearchParams({
    page: String(filters.page),
    size: String(filters.size),
    stalledOnly: String(filters.stalledOnly),
  });
  if (filters.riskLevel) query.set("riskLevel", filters.riskLevel);

  return apiRequest<ProjectPullRequestRiskPage>({
    method: "GET",
    path: `/projects/${projectId}/pull-request-risks?${query.toString()}`,
    auth: "bearer",
    signal,
  });
}

export function rebuildProjectPullRequestRisks(
  projectId: string,
): Promise<ProjectPullRequestRiskRebuild> {
  return apiRequest<ProjectPullRequestRiskRebuild>({
    method: "POST",
    path: `/projects/${projectId}/pull-request-risks/rebuild`,
    auth: "bearer",
  });
}
