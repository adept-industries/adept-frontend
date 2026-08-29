import type { operations } from "../../api/generated/schema.js";
import { apiRequest } from "../../api/client.js";

export type ProjectResponse =
  operations["getProject"]["responses"][200]["content"]["application/json"];
export type CreateProjectRequest =
  operations["createProject"]["requestBody"]["content"]["application/json"];
export type UpdateProjectRequest =
  operations["updateProject"]["requestBody"]["content"]["application/json"];
export type ReplaceProjectConfigurationRequest =
  operations["replaceProjectConfiguration"]["requestBody"]["content"]["application/json"];

export function listProjects(signal?: AbortSignal): Promise<ProjectResponse[]> {
  return apiRequest<ProjectResponse[]>({
    method: "GET",
    path: "/projects",
    auth: "bearer",
    signal,
  });
}

export function createProject(body: CreateProjectRequest): Promise<ProjectResponse> {
  return apiRequest<ProjectResponse, CreateProjectRequest>({
    method: "POST",
    path: "/projects",
    auth: "bearer",
    body,
  });
}

export function updateProject(
  projectId: string,
  body: UpdateProjectRequest,
): Promise<ProjectResponse> {
  return apiRequest<ProjectResponse, UpdateProjectRequest>({
    method: "PATCH",
    path: `/projects/${projectId}`,
    auth: "bearer",
    body,
  });
}

export function replaceProjectConfiguration(
  projectId: string,
  body: ReplaceProjectConfigurationRequest,
): Promise<ProjectResponse> {
  return apiRequest<ProjectResponse, ReplaceProjectConfigurationRequest>({
    method: "PUT",
    path: `/projects/${projectId}/configuration`,
    auth: "bearer",
    body,
  });
}

export function deleteProject(projectId: string): Promise<void> {
  return apiRequest<void>({
    method: "DELETE",
    path: `/projects/${projectId}`,
    auth: "bearer",
  });
}
