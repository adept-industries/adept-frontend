/**
 * Query key factories for TanStack Query.
 *
 * Workspace-specific keys are prefixed with the workspace ID so that
 * switching workspace invalidates only that workspace's cache entries.
 * This convention must be followed by every future workspace-scoped query.
 */
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

  /** All keys belonging to a given workspace — use to invalidate on switch. */
  workspaceAll: (workspaceId: string) => [workspaceId] as const,
} as const;
