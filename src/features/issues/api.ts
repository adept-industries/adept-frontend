import type { operations } from "../../api/generated/schema.js";
import { apiRequest } from "../../api/client.js";

export type ProjectGithubIssuePage =
  operations["listProjectGithubIssues"]["responses"][200]["content"]["application/json"];
export type ProjectGithubIssue = ProjectGithubIssuePage["items"][number];
export type ProjectJiraIssuePage =
  operations["listProjectJiraIssues"]["responses"][200]["content"]["application/json"];
export type ProjectJiraIssue = ProjectJiraIssuePage["items"][number];
export type ProjectIssueSyncResponse =
  operations["syncProjectIssues"]["responses"][202]["content"]["application/json"];

export interface ProjectIssuePageRequest {
  page: number;
  size: number;
}

function issuePageQuery(request: ProjectIssuePageRequest): string {
  return new URLSearchParams({
    page: String(request.page),
    size: String(request.size),
  }).toString();
}

export function listProjectGithubIssues(
  projectId: string,
  request: ProjectIssuePageRequest,
  signal?: AbortSignal,
): Promise<ProjectGithubIssuePage> {
  return apiRequest<ProjectGithubIssuePage>({
    method: "GET",
    path: `/projects/${projectId}/issues/github?${issuePageQuery(request)}`,
    auth: "bearer",
    signal,
  });
}

export function listProjectJiraIssues(
  projectId: string,
  request: ProjectIssuePageRequest,
  signal?: AbortSignal,
): Promise<ProjectJiraIssuePage> {
  return apiRequest<ProjectJiraIssuePage>({
    method: "GET",
    path: `/projects/${projectId}/issues/jira?${issuePageQuery(request)}`,
    auth: "bearer",
    signal,
  });
}

export function syncProjectIssues(projectId: string): Promise<ProjectIssueSyncResponse> {
  return apiRequest<ProjectIssueSyncResponse>({
    method: "POST",
    path: `/projects/${projectId}/issues/sync`,
    auth: "bearer",
  });
}
