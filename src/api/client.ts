import { accessTokenStore } from "../auth/accessTokenStore.js";
import {
  CSRF_HEADER,
  currentCsrfTokenWhileLocked,
  dispatchWithCsrf,
} from "./csrf.js";
import { ApiError, isApiProblem, localProblem } from "./problem.js";

const API_ROOT = `${import.meta.env.VITE_API_BASE_URL ?? "/api"}/v1`;

/** Builds a browser URL for API endpoints that require top-level navigation. */
export function apiUrl(path: string): string {
  return `${API_ROOT}${path}`;
}

export type ApiAuthMode = "public" | "refresh-cookie" | "bearer";

export interface SessionSnapshot {
  generation: number;
  workspaceId: string;
}

export interface AuthRecoveryRuntime {
  snapshot(): SessionSnapshot | null;
  recover(origin: SessionSnapshot): Promise<void>;
}

let authRuntime: AuthRecoveryRuntime | null = null;

export function configureAuthRecovery(runtime: AuthRecoveryRuntime | null): void {
  authRuntime = runtime;
}

export interface ApiRequestOptions<TBody = never> {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  auth: ApiAuthMode;
  body?: TBody;
  signal?: AbortSignal;
  /** Session mutations already own the CSRF lock through their response. */
  csrfLockHeld?: boolean;
  /** Allows the caller to opt out of the one automatic bearer recovery. */
  recover401?: boolean;
}

function isUnsafe(method: ApiRequestOptions["method"]): boolean {
  return method !== "GET";
}

function sameSession(a: SessionSnapshot, b: SessionSnapshot | null): boolean {
  return b !== null && a.generation === b.generation && a.workspaceId === b.workspaceId;
}

async function parseProblem(response: Response, path: string): Promise<ApiError> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json")) {
    const value: unknown = await response.json().catch(() => null);
    if (isApiProblem(value)) return new ApiError(value);
  }
  return new ApiError(
    localProblem(
      response.status,
      "UNEXPECTED_RESPONSE",
      "Request failed",
      "The server returned an unexpected response.",
      path,
    ),
  );
}

async function parseSuccess<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiRequest<TResponse, TBody = never>(
  options: ApiRequestOptions<TBody>,
): Promise<TResponse> {
  const origin = options.auth === "bearer" ? authRuntime?.snapshot() ?? null : null;
  const formDataBody = typeof FormData !== "undefined" && options.body instanceof FormData;
  const requestBody = options.body === undefined
    ? undefined
    : formDataBody
      ? options.body
      : JSON.stringify(options.body);

  const send = async (retried: boolean): Promise<Response> => {
    const headers: Record<string, string> = {
      Accept: "application/json, application/problem+json",
    };
    if (requestBody !== undefined && !formDataBody) headers["Content-Type"] = "application/json";
    if (options.auth === "bearer") {
      const token = accessTokenStore.get();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const dispatch = (csrfToken?: string) => {
      if (csrfToken) headers[CSRF_HEADER] = csrfToken;
      return fetch(apiUrl(options.path), {
        method: options.method,
        credentials: "include",
        headers,
        body: requestBody as BodyInit | undefined,
        signal: options.signal,
      });
    };

    let response: Response;
    if (!isUnsafe(options.method)) {
      response = await dispatch();
    } else if (options.csrfLockHeld) {
      response = await dispatch(currentCsrfTokenWhileLocked());
    } else {
      response = await dispatchWithCsrf(dispatch);
    }

    if (
      response.status === 401 &&
      !retried &&
      options.auth === "bearer" &&
      options.recover401 !== false &&
      origin &&
      authRuntime
    ) {
      try {
        await authRuntime.recover(origin);
      } catch {
        return response;
      }
      if (sameSession(origin, authRuntime.snapshot()) && accessTokenStore.get()) {
        return send(true);
      }
    }
    return response;
  };

  const response = await send(false);
  if (!response.ok) throw await parseProblem(response, options.path);
  return parseSuccess<TResponse>(response);
}

export function requireBearerSession(): SessionSnapshot {
  const snapshot = authRuntime?.snapshot() ?? null;
  if (!snapshot || !accessTokenStore.get()) {
    throw new ApiError(
      localProblem(401, "SESSION_INVALID", "Session invalid", "Please sign in again."),
    );
  }
  return snapshot;
}
