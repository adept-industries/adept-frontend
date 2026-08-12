import type { components, operations } from "../../api/generated/schema.js";
import { apiRequest } from "../../api/client.js";
import { accessTokenStore } from "../../auth/accessTokenStore.js";
import type {
  AuthenticatedState,
  MembershipSummary,
  UserSummary,
  WorkspaceRequiredState,
  WorkspaceSummary,
} from "../../auth/types.js";

export type SignupBody = operations["signup"]["requestBody"]["content"]["application/json"];
type SignupResponse = operations["signup"]["responses"][201]["content"]["application/json"];
export type SignupResult = Pick<SignupResponse, "emailVerificationRequired">;
export type LoginBody = operations["login"]["requestBody"]["content"]["application/json"];
type LoginResponse = operations["login"]["responses"][200]["content"]["application/json"];
type RefreshBody = components["schemas"]["RefreshRequest"];
type RefreshResponse = operations["refreshSession"]["responses"][200]["content"]["application/json"];
type SwitchResponse = operations["switchWorkspace"]["responses"][200]["content"]["application/json"];
type MeResponse = operations["getCurrentUser"]["responses"][200]["content"]["application/json"];
type EmailBody = components["schemas"]["EmailRequest"];
type ActionTokenBody = operations["verifyEmail"]["requestBody"]["content"]["application/json"];
export type ResetPasswordBody = operations["resetPassword"]["requestBody"]["content"]["application/json"];

export type SessionResult =
  | ({ kind: "authenticated" } & Omit<AuthenticatedState, "status" | "generation">)
  | ({ kind: "workspace-required" } & Omit<WorkspaceRequiredState, "status">);

function mapUser(value: components["schemas"]["UserSummary"]): UserSummary {
  return value;
}

function mapMembership(
  value: components["schemas"]["MembershipSummary"],
): MembershipSummary {
  return value;
}

function mapWorkspace(
  value: components["schemas"]["WorkspaceSummaryResponse"],
): WorkspaceSummary {
  return value;
}

function consumeSession(response: LoginResponse | RefreshResponse | SwitchResponse): SessionResult {
  if ("accessToken" in response) accessTokenStore.set(response.accessToken);
  else accessTokenStore.clear();

  const user = mapUser(response.user);
  const workspaces = response.workspaces.map(mapWorkspace);
  if (response.workspaceSelectionRequired) {
    return { kind: "workspace-required", user, workspaces };
  }
  return {
    kind: "authenticated",
    user,
    currentMembership: mapMembership(response.currentMembership),
    workspaces,
  };
}

export async function signup(body: SignupBody): Promise<SignupResult> {
  const response = await apiRequest<SignupResponse, SignupBody>({
    method: "POST",
    path: "/auth/signup",
    auth: "public",
    body,
  });
  return { emailVerificationRequired: response.emailVerificationRequired };
}

export async function login(body: LoginBody, csrfLockHeld = false): Promise<SessionResult> {
  const response = await apiRequest<LoginResponse, LoginBody>({
    method: "POST",
    path: "/auth/login",
    auth: "public",
    body,
    csrfLockHeld,
  });
  return consumeSession(response);
}

export async function refreshSession(
  workspaceId?: string,
  csrfLockHeld = false,
): Promise<SessionResult> {
  const body: RefreshBody | undefined = workspaceId ? { workspaceId } : undefined;
  const response = await apiRequest<RefreshResponse, RefreshBody>({
    method: "POST",
    path: "/auth/refresh",
    auth: "refresh-cookie",
    body,
    csrfLockHeld,
  });
  return consumeSession(response);
}

export async function switchWorkspace(
  workspaceId: string,
  csrfLockHeld = false,
): Promise<SessionResult> {
  const response = await apiRequest<SwitchResponse>({
    method: "POST",
    path: `/auth/switch-workspace/${encodeURIComponent(workspaceId)}`,
    auth: "refresh-cookie",
    csrfLockHeld,
  });
  return consumeSession(response);
}

export async function logout(csrfLockHeld = false): Promise<void> {
  await apiRequest<void>({
    method: "POST",
    path: "/auth/logout",
    auth: "refresh-cookie",
    csrfLockHeld,
  });
}

export async function getMe(
  signal?: AbortSignal,
  recover401 = true,
): Promise<Omit<AuthenticatedState, "status" | "generation">> {
  const response = await apiRequest<MeResponse>({
    method: "GET",
    path: "/auth/me",
    auth: "bearer",
    signal,
    recover401,
  });
  return {
    user: mapUser(response.user),
    currentMembership: mapMembership(response.currentMembership),
    workspaces: response.workspaces.map(mapWorkspace),
  };
}

export function resendVerification(email: EmailBody["email"]): Promise<void> {
  return apiRequest<void, EmailBody>({
    method: "POST",
    path: "/auth/resend-verification",
    auth: "public",
    body: { email },
  });
}

export function forgotPassword(email: EmailBody["email"]): Promise<void> {
  return apiRequest<void, EmailBody>({
    method: "POST",
    path: "/auth/forgot-password",
    auth: "public",
    body: { email },
  });
}

export function verifyEmail(token: ActionTokenBody["token"]): Promise<void> {
  return apiRequest<void, ActionTokenBody>({
    method: "POST",
    path: "/auth/verify-email",
    auth: "public",
    body: { token },
  });
}

export function resetPassword(body: ResetPasswordBody, csrfLockHeld = false): Promise<void> {
  return apiRequest<void, ResetPasswordBody>({
    method: "POST",
    path: "/auth/reset-password",
    auth: "public",
    body,
    csrfLockHeld,
  });
}
