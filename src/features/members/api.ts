import type { components } from "../../api/generated/schema.js";
import { apiRequest } from "../../api/client.js";
import { consumeSession, type SessionResult } from "../auth/api.js";

export type LookupWorkspaceMemberRequest = components["schemas"]["LookupWorkspaceMemberRequest"];
export type CurrentWorkspaceMemberLookupResponse = components["schemas"]["CurrentWorkspaceMemberLookupResponse"];
export type CreateRepositoryLeadInvitationRequest = components["schemas"]["CreateRepositoryLeadInvitationRequest"];
export type PendingRepositoryLeadInvitationResponse = components["schemas"]["PendingRepositoryLeadInvitationResponse"];

export interface LeadCandidateResponse {
  githubUserId: string;
  login: string;
  avatarUrl: string | null;
  permission: string | null;
  publicEmail: string | null;
}

export interface InvitationPreviewResponse {
  workspaceName: string;
  role: "LEAD" | "MANAGER";
  email: string;
  repositories: string[];
  expiresAt: string;
  existingAccount: boolean;
}

export interface AcceptInvitationRequest {
  token: string;
  displayName?: string;
  password?: string;
}

/** Look up an existing user by email in the current workspace. */
export function lookupWorkspaceMember(
  body: LookupWorkspaceMemberRequest,
  signal?: AbortSignal,
): Promise<CurrentWorkspaceMemberLookupResponse> {
  return apiRequest<CurrentWorkspaceMemberLookupResponse, LookupWorkspaceMemberRequest>({
    method: "POST",
    path: "/workspaces/current/members/lookup",
    auth: "bearer",
    body,
    signal,
  });
}

/** List current active and pending Lead assignments for a repository. */
export function listRepositoryLeadAssignments(
  repositoryId: string,
  signal?: AbortSignal,
): Promise<PendingRepositoryLeadInvitationResponse[]> {
  return apiRequest<PendingRepositoryLeadInvitationResponse[]>({
    method: "GET",
    path: `/repositories/${repositoryId}/lead-assignments`,
    auth: "bearer",
    signal,
  });
}

/** Assign a Lead to a repository or create/reuse a pending invitation. */
export function createRepositoryLeadAssignment(
  repositoryId: string,
  body: CreateRepositoryLeadInvitationRequest,
): Promise<PendingRepositoryLeadInvitationResponse> {
  return apiRequest<PendingRepositoryLeadInvitationResponse, CreateRepositoryLeadInvitationRequest>({
    method: "POST",
    path: `/repositories/${repositoryId}/lead-assignments`,
    auth: "bearer",
    body,
  });
}

/** Remove a Lead assignment from a repository. */
export function deleteLeadAssignment(
  repositoryId: string,
  assignmentId: string,
): Promise<void> {
  return apiRequest<void>({
    method: "DELETE",
    path: `/repositories/${repositoryId}/lead-assignments/${assignmentId}`,
    auth: "bearer",
  });
}

/** Fetch public preview details for an emailed invitation token. */
export function previewInvitation(
  token: string,
  signal?: AbortSignal,
): Promise<InvitationPreviewResponse> {
  return apiRequest<InvitationPreviewResponse>({
    method: "GET",
    path: `/invitations/preview?token=${encodeURIComponent(token)}`,
    auth: "public",
    signal,
  });
}

/** Submit acceptance for an emailed invitation token. */
export async function acceptInvitation(
  body: AcceptInvitationRequest,
): Promise<SessionResult> {
  const response = await apiRequest<components["schemas"]["AuthSessionResponse"], AcceptInvitationRequest>({
    method: "POST",
    path: "/invitations/accept",
    auth: "public",
    body,
  });
  return consumeSession(response);
}

/** Resend an emailed invitation. */
export function resendInvitation(
  invitationId: string,
): Promise<void> {
  return apiRequest<void>({
    method: "POST",
    path: `/invitations/${invitationId}/resend`,
    auth: "bearer",
  });
}

/** Revoke an emailed invitation. */
export function revokeInvitation(
  invitationId: string,
): Promise<void> {
  return apiRequest<void>({
    method: "DELETE",
    path: `/invitations/${invitationId}`,
    auth: "bearer",
  });
}

/** Remove a workspace member (requires no active repository assignments for Leads). */
export function removeWorkspaceMember(
  membershipId: string,
): Promise<void> {
  return apiRequest<void>({
    method: "DELETE",
    path: `/workspaces/current/members/${membershipId}`,
    auth: "bearer",
  });
}
