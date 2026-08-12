import type { components } from "../api/generated/schema.js";

/**
 * Auth state types — discriminated union used throughout the application.
 *
 * The raw access token is NEVER stored in React state or context.
 * Only safe summaries are exposed to components.
 */

export type UserSummary = components["schemas"]["UserSummary"];
export type MembershipSummary = components["schemas"]["MembershipSummary"];
export type WorkspaceSummary = components["schemas"]["WorkspaceSummaryResponse"];

// ─── Auth state machine ────────────────────────────────────────────────────

export interface BootstrappingState {
  status: "bootstrapping";
}

export interface AnonymousState {
  status: "anonymous";
  /** Set when a previous session was recovered in an ambiguous state. */
  ambiguousSession?: true;
  deletionRequested?: true;
  notice?: string;
}

export interface WorkspaceRequiredState {
  status: "workspaceRequired";
  user: UserSummary;
  workspaces: WorkspaceSummary[];
  notice?: string;
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
