/**
 * Query key factories for TanStack Query.
 * Each key is a const tuple so TypeScript can narrow the shape.
 */
export const queryKeys = {
  me: () => ["me"] as const,
  workspaces: () => ["workspaces"] as const,
  workspaceCurrent: () => ["workspaces", "current"] as const,
} as const;
