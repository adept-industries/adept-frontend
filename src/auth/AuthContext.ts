import type { AuthenticatedState, AuthState, WorkspaceSummary } from "./types.js";

/**
 * Actions exposed through AuthContext.
 * Passwords and raw tokens are consumed inside each action; they are NEVER
 * propagated through context or returned to components.
 */
export interface AuthActions {
  signup(params: {
    email: string;
    password: string;
    displayName: string;
    workspaceName: string;
    timezone: string;
  }): Promise<{ emailVerificationRequired: boolean }>;

  login(params: { email: string; password: string }): Promise<void>;

  selectWorkspace(workspaceId: string): Promise<void>;

  logout(): Promise<void>;

  refresh(): Promise<void>;
}

import { createContext } from "react";

export interface AuthContextValue {
  state: AuthState;
  actions: AuthActions;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/** Convenience typed accessor — throws when used outside AuthProvider. */
export function useAuthContext(): AuthContextValue {
  const ctx = createContext<AuthContextValue | null>(null);
  // This import trick makes the hook available but the real implementation
  // is in AuthProvider.tsx which exports useAuth().
  void ctx;
  throw new Error(
    "useAuthContext must be used within AuthProvider — use useAuth() instead",
  );
}

// Re-export the discriminated union helpers for components.
export type { AuthState, AuthenticatedState, WorkspaceSummary };
