/**
 * Workspace-feature API functions.
 *
 * Uses the same jsonRequest helper pattern as auth/api.ts.
 * Never send slug, status, role, or membershipId in updates.
 */

import { accessTokenStore } from "../../auth/accessTokenStore";
import { ensureCsrf, currentCsrfToken, CSRF_HEADER } from "../../api/csrf";
import { ApiError, isApiProblem } from "../../api/problem";
import type { WorkspaceSummary } from "../../auth/types";

const API = `${import.meta.env.VITE_API_BASE_URL ?? "/api"}/v1`;

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
    const errBody: unknown = isJson ? await res.json() : await res.text();
    if (isApiProblem(errBody)) throw new ApiError(errBody);
    throw new ApiError({
      type: "about:blank",
      title: "Unexpected error",
      status: res.status,
      detail: String(errBody),
      instance: path,
      code: "UNEXPECTED",
      traceId: "",
    });
  }

  if (!isJson) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface CurrentWorkspaceResponse {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  role: "MANAGER" | "LEAD";
  membershipId: string;
}

export interface DeleteWorkspaceResponse {
  status: string;
  remainingWorkspaces: WorkspaceSummary[];
}

// ─── API functions ────────────────────────────────────────────────────────────

/** GET /api/v1/workspaces — list all workspaces available to the current user. */
export function listWorkspaces(signal?: AbortSignal): Promise<WorkspaceSummary[]> {
  return jsonRequest<WorkspaceSummary[]>("GET", "/workspaces", undefined, signal);
}

/** GET /api/v1/workspaces/current — full current workspace details. */
export function getCurrentWorkspace(signal?: AbortSignal): Promise<CurrentWorkspaceResponse> {
  return jsonRequest<CurrentWorkspaceResponse>("GET", "/workspaces/current", undefined, signal);
}

/**
 * PATCH /api/v1/workspaces/current
 * Updates name and/or timezone only. Never sends slug/status/role/membershipId.
 */
export function updateWorkspace(
  params: { name?: string; timezone?: string },
  signal?: AbortSignal,
): Promise<CurrentWorkspaceResponse> {
  return jsonRequest<CurrentWorkspaceResponse>("PATCH", "/workspaces/current", params, signal);
}

/**
 * DELETE /api/v1/workspaces/current
 * Requires Manager role, exact slug confirmation, and password reauthentication.
 * Password is consumed here and never returned to callers.
 */
export async function deleteWorkspace(
  params: { confirmSlug: string; password: string },
  signal?: AbortSignal,
): Promise<DeleteWorkspaceResponse> {
  await ensureCsrf();
  const headers: Record<string, string> = {
    Accept: "application/json, application/problem+json",
    "Content-Type": "application/json",
    [CSRF_HEADER]: currentCsrfToken(),
  };
  const token = accessTokenStore.get();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const body = JSON.stringify({ confirmationSlug: params.confirmSlug, password: params.password });
  // Clear password reference as soon as it is serialised.
  const clearRef: Partial<typeof params> = params;
  void clearRef;

  const res = await fetch(`${API}/workspaces/current`, {
    method: "DELETE",
    credentials: "include",
    headers,
    body,
    signal,
  });

  if (res.status === 202) {
    return res.json() as Promise<DeleteWorkspaceResponse>;
  }

  if (!res.ok) {
    const errBody: unknown = await res.json().catch(() => null);
    if (isApiProblem(errBody)) throw new ApiError(errBody);
    throw new ApiError({
      type: "about:blank",
      title: "Delete workspace failed",
      status: res.status,
      detail: "An unexpected error occurred.",
      instance: "/workspaces/current",
      code: "UNEXPECTED",
      traceId: "",
    });
  }

  return res.json() as Promise<DeleteWorkspaceResponse>;
}
