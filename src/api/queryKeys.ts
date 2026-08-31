/**
 * Query key factories for TanStack Query.
 *
 * Workspace-specific keys are prefixed with the workspace ID so that
 * switching workspace invalidates only that workspace's cache entries.
 * This convention must be followed by every future workspace-scoped query.
 */

import type { DoraMetricsFilters, DoraMetricsSeriesFilters } from "../features/metrics/types.js";
import type { ProjectPullRequestRiskFilters } from "../features/pullRequests/api.js";
import type { ProjectIssuePageRequest } from "../features/issues/api.js";

export const queryKeys = {
  /** User identity — not workspace-scoped. */
  me: () => ["me"] as const,

  /** All workspaces list — not workspace-scoped. */
  workspaces: () => ["workspaces"] as const,

  /** Current workspace details — workspace-scoped. */
  workspaceCurrent: (workspaceId: string) =>
    [workspaceId, "workspaces", "current"] as const,

  projects: (workspaceId: string) =>
    [workspaceId, "projects"] as const,

  repositories: (workspaceId: string, trackingOnly?: boolean) =>
    [workspaceId, "repositories", { trackingOnly }] as const,

  leadCandidates: (workspaceId: string, repositoryId: string) =>
    [workspaceId, "repositories", repositoryId, "lead-candidates"] as const,

  mappedJiraProjects: (workspaceId: string, repositoryId: string) =>
    [workspaceId, "repositories", repositoryId, "jira-projects"] as const,

  invitationPreview: (token: string) =>
    ["invitations", "preview", token] as const,

  /** DORA metrics summary — workspace-scoped, filter-aware. */
  doraMetricsSummary: (workspaceId: string, filters: DoraMetricsFilters) =>
    [workspaceId, "metrics", "summary", filters] as const,

  /** DORA metrics time series — workspace-scoped, filter-aware. */
  doraMetricsSeries: (workspaceId: string, filters: DoraMetricsSeriesFilters) =>
    [workspaceId, "metrics", "series", filters] as const,

  projectPullRequestRisks: (
    workspaceId: string,
    projectId: string,
    filters: ProjectPullRequestRiskFilters,
  ) => [workspaceId, "projects", projectId, "pull-request-risks", filters] as const,

  projectGithubIssues: (
    workspaceId: string,
    projectId: string,
    request: ProjectIssuePageRequest,
  ) => [workspaceId, "projects", projectId, "issues", "github", request] as const,

  projectJiraIssues: (
    workspaceId: string,
    projectId: string,
    request: ProjectIssuePageRequest,
  ) => [workspaceId, "projects", projectId, "issues", "jira", request] as const,

  alertRules: (workspaceId: string, repositoryId?: string) =>
    [workspaceId, "alert-rules", { repositoryId }] as const,

  /** All keys belonging to a given workspace — use to invalidate on switch. */
  workspaceAll: (workspaceId: string) => [workspaceId] as const,
} as const;
