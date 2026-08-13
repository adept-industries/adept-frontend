// @vitest-environment jsdom
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { accessTokenStore } from "../auth/accessTokenStore.js";
import { configureAuthRecovery } from "./client.js";
import { ApiError } from "./problem.js";
import { queryClient } from "./queryClient.js";
import { completeGoogleOnboarding, getMe, signup } from "../features/auth/api.js";
import { getCurrentWorkspace, updateWorkspace } from "../features/workspaces/api.js";
import { apiRequest } from "./client.js";
import { server } from "../test/server.js";

const problem = (status: number, code: string) => ({
  type: `https://adept.local/problems/${code.toLowerCase()}`,
  title: "Request failed",
  status,
  detail: "Safe problem detail",
  instance: "/api",
  code,
  traceId: "test-trace",
});

describe("shared API client", () => {
  beforeEach(() => {
    document.cookie = "XSRF-TOKEN=test-csrf; Path=/";
    accessTokenStore.clear();
    configureAuthRecovery(null);
    queryClient.clear();
  });

  it("applies operation auth metadata and CSRF headers", async () => {
    accessTokenStore.set("memory-token");
    let publicAuthorization: string | null = null;
    let patchHeaders: Headers | null = null;
    server.use(
      http.post("/api/v1/auth/signup", ({ request }) => {
        publicAuthorization = request.headers.get("authorization");
        return HttpResponse.json({
          emailVerificationRequired: true,
          user: { id: "u", email: "u@example.com", displayName: "U", emailVerified: false },
          workspace: { id: "w", name: "W", slug: "w", timezone: "UTC", role: "MANAGER" },
        }, { status: 201 });
      }),
      http.patch("/api/v1/workspaces/current", ({ request }) => {
        patchHeaders = request.headers;
        return HttpResponse.json({ id: "w", membershipId: "m", name: "Renamed", slug: "w", timezone: "UTC", role: "MANAGER" });
      }),
    );

    await signup({ email: "u@example.com", password: "long-password", displayName: "U", workspaceName: "W", timezone: "UTC" });
    await updateWorkspace({ name: "Renamed" });

    expect(publicAuthorization).toBeNull();
    const observedHeaders = patchHeaders as Headers | null;
    expect(observedHeaders?.get("authorization")).toBe("Bearer memory-token");
    expect(observedHeaders?.get("x-xsrf-token")).toBe("test-csrf");
    expect(observedHeaders?.get("content-type")).toContain("application/json");
  });

  it("lets the browser set multipart content type", async () => {
    let observedContentType: string | null = null;
    server.use(
      http.post("/api/v1/test-upload", ({ request }) => {
        observedContentType = request.headers.get("content-type");
        return HttpResponse.json({ ok: true });
      }),
    );
    const body = new FormData();
    body.set("file", new Blob(["test"], { type: "text/plain" }), "test.txt");

    await apiRequest<{ ok: boolean }, FormData>({
      method: "POST",
      path: "/test-upload",
      auth: "public",
      body,
    });

    expect(observedContentType).toMatch(/^multipart\/form-data; boundary=/);
  });

  it("completes Google onboarding through the public cookie-bound endpoint", async () => {
    let observedBody: unknown;
    let observedCsrf: string | null = null;
    server.use(
      http.post("/api/v1/auth/google/onboarding", async ({ request }) => {
        observedBody = await request.json();
        observedCsrf = request.headers.get("x-xsrf-token");
        return HttpResponse.json({
          accessToken: "google-session-token",
          expiresInSeconds: 900,
          workspaceSelectionRequired: false,
          user: {
            id: "u",
            email: "google@example.com",
            displayName: "Google User",
            emailVerified: true,
          },
          currentMembership: {
            id: "m",
            workspaceId: "w",
            workspaceName: "Google Workspace",
            workspaceSlug: "google-workspace",
            timezone: "UTC",
            role: "MANAGER",
          },
          workspaces: [{
            id: "w",
            name: "Google Workspace",
            slug: "google-workspace",
            timezone: "UTC",
            role: "MANAGER",
          }],
        });
      }),
    );

    const result = await completeGoogleOnboarding({
      workspaceName: "Google Workspace",
      timezone: "UTC",
    });

    expect(observedBody).toEqual({ workspaceName: "Google Workspace", timezone: "UTC" });
    expect(observedCsrf).toBe("test-csrf");
    expect(result.kind).toBe("authenticated");
    expect(accessTokenStore.get()).toBe("google-session-token");
  });

  it("performs one 401 recovery/retry and never recovers a 403", async () => {
    let generation = 1;
    let token = "expired";
    let requests = 0;
    let recoveries = 0;
    accessTokenStore.set(token);
    configureAuthRecovery({
      snapshot: () => ({ generation, workspaceId: "workspace-1" }),
      recover: async () => {
        recoveries += 1;
        token = "fresh";
        accessTokenStore.set(token);
      },
    });
    server.use(
      http.get("/api/v1/auth/me", ({ request }) => {
        requests += 1;
        if (request.headers.get("authorization") === "Bearer expired") {
          return HttpResponse.json(problem(401, "SESSION_INVALID"), { status: 401 });
        }
        return HttpResponse.json({
          user: { id: "u", email: "u@example.com", displayName: "U", emailVerified: true },
          currentMembership: { id: "m", workspaceId: "workspace-1", workspaceName: "W", workspaceSlug: "w", timezone: "UTC", role: "MANAGER" },
          workspaces: [{ id: "workspace-1", name: "W", slug: "w", timezone: "UTC", role: "MANAGER" }],
        });
      }),
      http.get("/api/v1/workspaces/current", () =>
        HttpResponse.json(problem(403, "MANAGER_REQUIRED"), { status: 403 }),
      ),
    );

    await queryClient.fetchQuery({
      queryKey: ["test", "me", generation],
      queryFn: () => getMe(),
    });
    expect({ requests, recoveries }).toEqual({ requests: 2, recoveries: 1 });
    await expect(queryClient.fetchQuery({
      queryKey: ["test", "workspace", generation],
      queryFn: () => getCurrentWorkspace(),
    })).rejects.toBeInstanceOf(ApiError);
    expect(recoveries).toBe(1);
    generation += 1;
  });
});
