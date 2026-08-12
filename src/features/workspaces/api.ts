import type { components, operations } from "../../api/generated/schema.js";
import { apiRequest } from "../../api/client.js";

export type WorkspaceSummary = components["schemas"]["WorkspaceSummaryResponse"];
export type CurrentWorkspaceResponse =
  operations["getCurrentWorkspace"]["responses"][200]["content"]["application/json"];
export type UpdateWorkspaceRequest =
  operations["updateCurrentWorkspace"]["requestBody"]["content"]["application/json"];
export type DeleteWorkspaceRequest =
  operations["deleteCurrentWorkspace"]["requestBody"]["content"]["application/json"];
export type DeleteWorkspaceResponse =
  operations["deleteCurrentWorkspace"]["responses"][202]["content"]["application/json"];

export function listWorkspaces(signal?: AbortSignal): Promise<WorkspaceSummary[]> {
  return apiRequest<WorkspaceSummary[]>({
    method: "GET",
    path: "/workspaces",
    auth: "bearer",
    signal,
  });
}

export function getCurrentWorkspace(signal?: AbortSignal): Promise<CurrentWorkspaceResponse> {
  return apiRequest<CurrentWorkspaceResponse>({
    method: "GET",
    path: "/workspaces/current",
    auth: "bearer",
    signal,
  });
}

export function updateWorkspace(
  body: UpdateWorkspaceRequest,
  signal?: AbortSignal,
): Promise<CurrentWorkspaceResponse> {
  return apiRequest<CurrentWorkspaceResponse, UpdateWorkspaceRequest>({
    method: "PATCH",
    path: "/workspaces/current",
    auth: "bearer",
    body,
    signal,
  });
}

export function deleteWorkspace(
  body: DeleteWorkspaceRequest,
): Promise<DeleteWorkspaceResponse> {
  return apiRequest<DeleteWorkspaceResponse, DeleteWorkspaceRequest>({
    method: "DELETE",
    path: "/workspaces/current",
    auth: "bearer",
    body,
  });
}
