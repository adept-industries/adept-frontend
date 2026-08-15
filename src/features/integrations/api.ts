import { apiRequest } from "../../api/client.js";

export type IntegrationStatus = "ACTIVE" | "REVOKED" | "SUSPENDED";
export type DeploymentSignal = "WORKFLOW_RUN" | "DEPLOYMENT" | "RELEASE_TAG" | "MERGE_TO_BRANCH";
export type MetricGranularity = "DAY" | "WEEK" | "MONTH";

export interface RepositorySettings {
  deploymentSignal: DeploymentSignal;
  productionBranchPatterns: string[];
  productionEnvironmentPatterns: string[];
  deploymentWorkflowNamePatterns: string[];
  releaseTagPatterns: string[];
  incidentSource: "JIRA" | "MANUAL" | "BOTH";
  doraExclusions: string[];
  defaultMetricGranularity: MetricGranularity;
  backfillDays: number;
}

export interface RepositoryResponse {
  id: string;
  workspaceId: string;
  githubIntegrationId: string;
  githubRepoId: number;
  ownerLogin: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  visibility: "PUBLIC" | "PRIVATE" | "INTERNAL";
  archived: boolean;
  trackingEnabled: boolean;
  settings: RepositorySettings;
  lastSyncedAt: string;
}

export interface UpdateRepositoryRequest {
  trackingEnabled?: boolean;
  settings?: Partial<RepositorySettings>;
}

export interface GithubIntegrationResponse {
  id: string;
  workspaceId: string;
  installationId: number;
  accountLogin: string;
  accountType: "USER" | "ORGANIZATION";
  repositorySelection: "ALL" | "SELECTED";
  status: IntegrationStatus;
  lastSyncedAt: string;
  repositoryCount: number;
}

export interface GithubConnectUrlResponse {
  url: string;
  state: string;
}

export interface LeadCandidateResponse {
  githubUserId: string;
  login: string;
  avatarUrl: string | null;
  permission: string | null;
  publicEmail: string | null;
}

export interface JiraIntegrationResponse {
  id: string;
  workspaceId: string;
  cloudId: string;
  siteUrl: string;
  displayName: string;
  status: IntegrationStatus;
  lastSyncedAt: string;
  projectCount: number;
}

export interface JiraConnectUrlResponse {
  url: string;
  state: string;
}

export interface JiraProjectResponse {
  id: string;
  workspaceId: string;
  jiraIntegrationId: string;
  jiraProjectId: string;
  projectKey: string;
  projectName: string;
  projectType: string;
  trackingEnabled: boolean;
  lastSyncedAt: string;
}

// ── GitHub API ─────────────────────────────────────────────────────────────────

export function getGithubIntegration(signal?: AbortSignal): Promise<GithubIntegrationResponse | undefined> {
  return apiRequest<GithubIntegrationResponse | undefined>({
    method: "GET",
    path: "/integrations/github",
    auth: "bearer",
    signal,
  });
}

export function getGithubConnectUrl(): Promise<GithubConnectUrlResponse> {
  return apiRequest<GithubConnectUrlResponse>({
    method: "POST",
    path: "/integrations/github/connect-url",
    auth: "bearer",
  });
}

export function syncGithubRepositories(integrationId: string): Promise<void> {
  return apiRequest<void>({
    method: "POST",
    path: `/integrations/github/${integrationId}/sync`,
    auth: "bearer",
  });
}

export function disconnectGithubIntegration(integrationId: string): Promise<void> {
  return apiRequest<void>({
    method: "DELETE",
    path: `/integrations/github/${integrationId}`,
    auth: "bearer",
  });
}

// ── Repositories API ───────────────────────────────────────────────────────────

export function listRepositories(trackingOnly?: boolean, signal?: AbortSignal): Promise<RepositoryResponse[]> {
  const query = trackingOnly ? "?trackingOnly=true" : "";
  return apiRequest<RepositoryResponse[]>({
    method: "GET",
    path: `/repositories${query}`,
    auth: "bearer",
    signal,
  });
}

export function updateRepository(
  repositoryId: string,
  body: UpdateRepositoryRequest
): Promise<RepositoryResponse> {
  return apiRequest<RepositoryResponse, UpdateRepositoryRequest>({
    method: "PATCH",
    path: `/repositories/${repositoryId}`,
    auth: "bearer",
    body,
  });
}

export function getLeadCandidates(repositoryId: string, signal?: AbortSignal): Promise<LeadCandidateResponse[]> {
  return apiRequest<LeadCandidateResponse[]>({
    method: "GET",
    path: `/repositories/${repositoryId}/lead-candidates`,
    auth: "bearer",
    signal,
  });
}

// ── Jira API ───────────────────────────────────────────────────────────────────

export function getJiraIntegration(signal?: AbortSignal): Promise<JiraIntegrationResponse | undefined> {
  return apiRequest<JiraIntegrationResponse | undefined>({
    method: "GET",
    path: "/integrations/jira",
    auth: "bearer",
    signal,
  });
}

export function getJiraConnectUrl(): Promise<JiraConnectUrlResponse> {
  return apiRequest<JiraConnectUrlResponse>({
    method: "POST",
    path: "/integrations/jira/connect-url",
    auth: "bearer",
  });
}

export function disconnectJiraIntegration(integrationId: string): Promise<void> {
  return apiRequest<void>({
    method: "DELETE",
    path: `/integrations/jira/${integrationId}`,
    auth: "bearer",
  });
}

export function listJiraProjects(signal?: AbortSignal): Promise<JiraProjectResponse[]> {
  return apiRequest<JiraProjectResponse[]>({
    method: "GET",
    path: "/jira/projects",
    auth: "bearer",
    signal,
  });
}

export function updateJiraProjectTracking(
  projectId: string,
  trackingEnabled: boolean
): Promise<JiraProjectResponse> {
  return apiRequest<JiraProjectResponse, { trackingEnabled: boolean }>({
    method: "PATCH",
    path: `/jira/projects/${projectId}`,
    auth: "bearer",
    body: { trackingEnabled },
  });
}

export function getMappedJiraProjects(repositoryId: string, signal?: AbortSignal): Promise<JiraProjectResponse[]> {
  return apiRequest<JiraProjectResponse[]>({
    method: "GET",
    path: `/repositories/${repositoryId}/jira-projects`,
    auth: "bearer",
    signal,
  });
}

export function mapJiraProjectsToRepository(
  repositoryId: string,
  jiraProjectIds: string[]
): Promise<void> {
  return apiRequest<void, { jiraProjectIds: string[] }>({
    method: "POST",
    path: `/repositories/${repositoryId}/jira-projects`,
    auth: "bearer",
    body: { jiraProjectIds },
  });
}
