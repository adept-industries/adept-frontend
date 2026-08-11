/**
 * Auth state types — discriminated union used throughout the application.
 *
 * The raw access token is NEVER stored in React state or context.
 * Only safe summaries are exposed to components.
 */

export interface UserSummary {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
}

export interface MembershipSummary {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  timezone: string;
  role: "MANAGER" | "LEAD";
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  role: "MANAGER" | "LEAD";
}

// ─── Auth state machine ────────────────────────────────────────────────────

export interface BootstrappingState {
  status: "bootstrapping";
}

export interface AnonymousState {
  status: "anonymous";
  /** Set when a previous session was recovered in an ambiguous state. */
  ambiguousSession?: true;
}

export interface WorkspaceRequiredState {
  status: "workspaceRequired";
  user: UserSummary;
  workspaces: WorkspaceSummary[];
}

export interface AuthenticatedState {
  status: "authenticated";
  user: UserSummary;
  currentMembership: MembershipSummary;
  workspaces: WorkspaceSummary[];
  /** Incremented on login, switch, logout, reset, or workspace change after refresh. */
  generation: number;
}

export type AuthState =
  | BootstrappingState
  | AnonymousState
  | WorkspaceRequiredState
  | AuthenticatedState;
