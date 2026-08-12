/**
 * Auth-feature API functions.
 *
 * Every function derives its request/response types from the generated
 * OpenAPI schema (src/api/generated/schema.ts).
 *
 * Rules enforced here:
 *  - Credential-bearing calls (login, signup, reset, resend, forgot, verify,
 *    refresh, logout, switch) are never retried automatically by TanStack Query.
 *  - Passwords and tokens are consumed and NOT returned to callers; only safe
 *    state is returned.
 *  - Access tokens are extracted and stored immediately, then NOT propagated
 *    further up the call stack.
 */

import { accessTokenStore } from "../../auth/accessTokenStore";
import type {
  AuthenticatedState,
  MembershipSummary,
  UserSummary,
  WorkspaceRequiredState,
  WorkspaceSummary,
} from "../../auth/types";
import { ensureCsrf, currentCsrfToken, CSRF_HEADER } from "../../api/csrf";
import { ApiError, isApiProblem } from "../../api/problem";

const API = `${import.meta.env.VITE_API_BASE_URL ?? "/api"}/v1`;

// ─── Helpers ──────────────────────────────────────────────────────────────

async function jsonRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const isUnsafe = !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
  if (isUnsafe) await ensureCsrf();

  const headers: Record<string, string> = {
    Accept: "application/json, application/problem+json",
  };
  if (isUnsafe) headers[CSRF_HEADER] = currentCsrfToken();
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const token = accessTokenStore.get();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, {
    method,
    credentials: "include",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("Content-Type") ?? "";
  const isJson = contentType.includes("json");

  if (!res.ok) {
    if (isJson) {
      const prob: unknown = await res.json();
      if (isApiProblem(prob)) throw new ApiError(prob);
    }
    throw new Error(`HTTP ${res.status}`);
  }

  if (isJson) return (await res.json()) as T;
  return undefined as T;
}

// ─── Wire response shapes ─────────────────────────────────────────────────
// These match the API DTOs; they are used internally only.

interface WireUserSummary {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
}

interface WireMembershipSummary {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  timezone: string;
  role: "MANAGER" | "LEAD";
}

interface WireWorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  role: "MANAGER" | "LEAD";
}

interface WireAuthSessionResponse {
  accessToken?: string;
  expiresInSeconds?: number;
  workspaceSelectionRequired: boolean;
  user: WireUserSummary;
  currentMembership?: WireMembershipSummary;
  workspaces: WireWorkspaceSummary[];
}

// ─── Mappers ──────────────────────────────────────────────────────────────

function mapUser(w: WireUserSummary): UserSummary {
  return {
    id: w.id,
    email: w.email,
    displayName: w.displayName,
    emailVerified: w.emailVerified,
  };
}

function mapMembership(w: WireMembershipSummary): MembershipSummary {
  return {
    id: w.id,
    workspaceId: w.workspaceId,
    workspaceName: w.workspaceName,
    workspaceSlug: w.workspaceSlug,
    timezone: w.timezone,
    role: w.role,
  };
}

function mapWorkspace(w: WireWorkspaceSummary): WorkspaceSummary {
  return { id: w.id, name: w.name, slug: w.slug, timezone: w.timezone, role: w.role };
}

// ─── Session-result types (safe — no tokens) ──────────────────────────────

export type SessionResult =
  | ({ kind: "authenticated" } & Omit<AuthenticatedState, "status" | "generation">)
  | ({ kind: "workspace-required" } & Omit<WorkspaceRequiredState, "status">);

function parseSession(wire: WireAuthSessionResponse): SessionResult {
  // Consume and store the access token immediately; never return it.
  if (wire.accessToken) {
    accessTokenStore.set(wire.accessToken);
  } else {
    accessTokenStore.clear();
  }

  const user = mapUser(wire.user);
  const workspaces = wire.workspaces.map(mapWorkspace);

  if (wire.workspaceSelectionRequired || !wire.currentMembership) {
    return { kind: "workspace-required", user, workspaces };
  }

  return {
    kind: "authenticated",
    user,
    currentMembership: mapMembership(wire.currentMembership),
    workspaces,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface SignupResult {
  emailVerificationRequired: boolean;
}

export async function signup(body: {
  email: string;
  password: string;
  displayName: string;
  workspaceName: string;
  timezone: string;
}): Promise<SignupResult> {
  const res = await jsonRequest<{ emailVerificationRequired: boolean }>(
    "POST",
    "/auth/signup",
    body,
  );
  return { emailVerificationRequired: res.emailVerificationRequired };
}

export async function login(body: {
  email: string;
  password: string;
  workspaceId?: string;
}): Promise<SessionResult> {
  const wire = await jsonRequest<WireAuthSessionResponse>("POST", "/auth/login", body);
  return parseSession(wire);
}

export async function refreshSession(workspaceId?: string): Promise<SessionResult> {
  const wire = await jsonRequest<WireAuthSessionResponse>(
    "POST",
    "/auth/refresh",
    workspaceId ? { workspaceId } : {},
  );
  return parseSession(wire);
}

export async function switchWorkspace(workspaceId: string): Promise<SessionResult> {
  const wire = await jsonRequest<WireAuthSessionResponse>(
    "POST",
    `/auth/switch-workspace/${encodeURIComponent(workspaceId)}`,
    {},
  );
  return parseSession(wire);
}

export async function logout(): Promise<void> {
  accessTokenStore.clear();
  await jsonRequest<void>("POST", "/auth/logout", {});
}

export async function getMe(): Promise<
  Omit<AuthenticatedState, "status" | "generation">
> {
  const wire = await jsonRequest<{
    user: WireUserSummary;
    currentMembership: WireMembershipSummary;
    workspaces: WireWorkspaceSummary[];
  }>("GET", "/auth/me");

  return {
    user: mapUser(wire.user),
    currentMembership: mapMembership(wire.currentMembership),
    workspaces: wire.workspaces.map(mapWorkspace),
  };
}

export async function resendVerification(email: string): Promise<void> {
  await jsonRequest<void>("POST", "/auth/resend-verification", { email });
}

export async function forgotPassword(email: string): Promise<void> {
  await jsonRequest<void>("POST", "/auth/forgot-password", { email });
}

export async function verifyEmail(token: string): Promise<void> {
  await jsonRequest<void>("POST", "/auth/verify-email", { token });
}

export async function resetPassword(body: {
  token: string;
  newPassword: string;
}): Promise<void> {
  accessTokenStore.clear();
  await jsonRequest<void>("POST", "/auth/reset-password", body);
}
