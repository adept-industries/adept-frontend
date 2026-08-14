import { createContext } from "react";
import type {
  GoogleOnboardingBody,
  LoginBody,
  PasswordReauthenticationBody,
  ResetPasswordBody,
  SessionWorkspaceBody,
  SignupBody,
  SignupResult,
} from "../features/auth/api.js";
import type { AuthState } from "./types.js";

export interface AuthActions {
  signup(params: SignupBody): Promise<SignupResult>;
  login(params: LoginBody): Promise<AuthState>;
  reauthenticateWithPassword(params: PasswordReauthenticationBody): Promise<AuthState>;
  startGoogleReauthentication(): Promise<string>;
  completeGoogleOnboarding(params: GoogleOnboardingBody): Promise<AuthState>;
  createWorkspace(params: SessionWorkspaceBody): Promise<AuthState>;
  selectWorkspace(workspaceId: string): Promise<AuthState>;
  refresh(options?: { withoutWorkspace?: boolean }): Promise<AuthState>;
  logout(): Promise<void>;
  resetPassword(params: ResetPasswordBody): Promise<void>;
  updateCurrentWorkspace(params: { name: string; timezone: string }): void;
  invalidateSession(options?: { ambiguous?: boolean; deletionRequested?: boolean; notice?: string }): void;
}

export interface AuthContextValue {
  state: AuthState;
  actions: AuthActions;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
export type { AuthState } from "./types.js";
