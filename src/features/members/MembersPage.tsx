import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/AuthProvider.js";
import { AppShell } from "../../components/layout/AppShell.js";
import { FormField } from "../../components/ui/FormField.js";
import { InlineAlert } from "../../components/ui/InlineAlert.js";
import { queryKeys } from "../../api/queryKeys.js";
import { ApiError } from "../../api/problem.js";
import {
  listRepositories,
  getLeadCandidates,
  type RepositoryResponse,
} from "../integrations/api.js";
import {
  createRepositoryLeadAssignment,
  deleteLeadAssignment,
  lookupWorkspaceMember,
  type CurrentWorkspaceMemberLookupResponse,
  type LeadCandidateResponse,
  type PendingRepositoryLeadInvitationResponse,
} from "./api.js";

export function MembersPage() {
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = authState.status === "authenticated" ? authState.currentMembership.workspaceId : "";

  const [repositories, setRepositories] = useState<RepositoryResponse[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");

  const [candidates, setCandidates] = useState<LeadCandidateResponse[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidateEmails, setCandidateEmails] = useState<Record<string, string>>({});

  const [manualEmail, setManualEmail] = useState("");
  const [lookupResult, setLookupResult] = useState<CurrentWorkspaceMemberLookupResponse | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [recentAssignments, setRecentAssignments] = useState<PendingRepositoryLeadInvitationResponse[]>([]);

  const selectedRepo = repositories.find((r) => r.id === selectedRepoId) ?? null;

  // Load repositories on mount
  useEffect(() => {
    let active = true;
    const fetchRepos = async () => {
      try {
        setLoadingRepos(true);
        const data = await listRepositories(false);
        if (active) {
          setRepositories(data ?? []);
          const firstTracked = data?.find((r) => r.trackingEnabled);
          if (firstTracked) {
            setSelectedRepoId(firstTracked.id);
          } else if (data && data.length > 0) {
            setSelectedRepoId(data[0].id);
          }
        }
      } catch (err: unknown) {
        if (active) {
          setErrorMessage(err instanceof Error ? err.message : "Failed to load repositories.");
        }
      } finally {
        if (active) setLoadingRepos(false);
      }
    };
    void fetchRepos();
    return () => {
      active = false;
    };
  }, []);

  // Load lead candidates when selected repository changes
  useEffect(() => {
    if (!selectedRepoId) {
      setCandidates([]);
      return;
    }
    let active = true;
    const fetchCandidates = async () => {
      try {
        setLoadingCandidates(true);
        const data = await getLeadCandidates(selectedRepoId);
        if (active) setCandidates(data ?? []);
      } catch {
        if (active) setCandidates([]);
      } finally {
        if (active) setLoadingCandidates(false);
      }
    };
    void fetchCandidates();
    return () => {
      active = false;
    };
  }, [selectedRepoId]);

  // Handle member email lookup
  const handleLookup = async () => {
    const trimmed = manualEmail.trim();
    if (!trimmed || !trimmed.includes("@")) return;
    setLookingUp(true);
    setErrorMessage(null);
    try {
      const result = await lookupWorkspaceMember({ email: trimmed });
      setLookupResult(result);
    } catch (err: unknown) {
      setLookupResult(null);
      if (err instanceof ApiError) {
        setErrorMessage(err.problem.detail);
      }
    } finally {
      setLookingUp(false);
    }
  };

  // Assign lead by manual email
  const handleAssignManualEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRepoId || !manualEmail.trim()) return;

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const assignment = await createRepositoryLeadAssignment(selectedRepoId, {
        email: manualEmail.trim(),
      });
      setRecentAssignments((prev) => [assignment, ...prev.filter((a) => a.assignmentId !== assignment.assignmentId)]);
      setSuccessMessage(
        assignment.invitationId
          ? `Invitation sent to ${assignment.email} for ${selectedRepo?.fullName ?? "the repository"}.`
          : `${assignment.email} assigned as Lead to ${selectedRepo?.fullName ?? "the repository"}.`
      );
      setManualEmail("");
      setLookupResult(null);

      // Invalidate only the specific affected query keys
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.leadCandidates(workspaceId, selectedRepoId),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.projects(workspaceId),
        });
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.problem.detail);
      } else {
        setErrorMessage("Lead assignment failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Assign lead from GitHub candidate
  const handleAssignCandidate = async (candidate: LeadCandidateResponse) => {
    if (!selectedRepoId) return;
    const targetEmail = candidate.publicEmail ?? candidateEmails[candidate.githubUserId]?.trim();
    if (!targetEmail || !targetEmail.includes("@")) {
      setErrorMessage(`Please provide a valid work email for @${candidate.login}.`);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const assignment = await createRepositoryLeadAssignment(selectedRepoId, {
        email: targetEmail,
      });
      setRecentAssignments((prev) => [assignment, ...prev.filter((a) => a.assignmentId !== assignment.assignmentId)]);
      setSuccessMessage(
        assignment.invitationId
          ? `Invitation sent to ${assignment.email} (@${candidate.login}).`
          : `${assignment.email} (@${candidate.login}) assigned as Lead.`
      );

      // Clear fallback email input
      setCandidateEmails((prev) => {
        const next = { ...prev };
        delete next[candidate.githubUserId];
        return next;
      });

      // Invalidate only specific query keys
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.leadCandidates(workspaceId, selectedRepoId),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.projects(workspaceId),
        });
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.problem.detail);
      } else {
        setErrorMessage("Lead assignment failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Unassign lead
  const handleUnassign = async (assignment: PendingRepositoryLeadInvitationResponse) => {
    if (!selectedRepoId) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await deleteLeadAssignment(selectedRepoId, assignment.assignmentId);
      setRecentAssignments((prev) => prev.filter((a) => a.assignmentId !== assignment.assignmentId));
      setSuccessMessage(`Unassigned ${assignment.email} from ${selectedRepo?.fullName ?? "the repository"}.`);

      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.leadCandidates(workspaceId, selectedRepoId),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.projects(workspaceId),
        });
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.problem.detail);
      } else {
        setErrorMessage("Could not unassign lead.");
      }
    }
  };

  return (
    <AppShell>
      <div style={{ maxWidth: "960px", margin: "0 auto" }}>
        <header style={{ marginBottom: "2rem" }}>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
            Workspace Administration
          </p>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
            Members & Lead Assignments
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem", fontSize: "0.95rem" }}>
            Assign Leads to tracked repositories. Leads receive scoped access to view metrics, alerts, and incidents for their assigned repositories.
          </p>
        </header>

        {errorMessage && (
          <div style={{ marginBottom: "1.5rem" }}>
            <InlineAlert message={errorMessage} />
          </div>
        )}

        {successMessage && (
          <div style={{ marginBottom: "1.5rem" }}>
            <InlineAlert kind="success" message={successMessage} />
          </div>
        )}

        {loadingRepos ? (
          <section className="dashboard-panel" style={{ padding: "2.5rem", textAlign: "center", borderRadius: "0.75rem" }}>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>Loading tracked repositories…</p>
          </section>
        ) : repositories.length === 0 ? (
          <section className="dashboard-panel" style={{ padding: "3rem 2rem", textAlign: "center", borderRadius: "0.75rem" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 600, margin: "0 0 0.5rem 0" }}>
              No repositories found
            </h2>
            <p style={{ color: "var(--text-secondary)", maxWidth: "480px", margin: "0 auto 1.5rem auto", fontSize: "0.95rem" }}>
              Connect your GitHub organization or personal account in Integrations to track repositories and assign team Leads.
            </p>
            <Link to="/dashboard/integrations" className="button-link" style={{ display: "inline-block" }}>
              Go to Integrations
            </Link>
          </section>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {/* Repository Selector Bar */}
            <section
              className="dashboard-panel"
              style={{
                padding: "1.5rem 2rem",
                borderRadius: "0.75rem",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: "1 1 300px" }}>
                <label
                  htmlFor="repository-select"
                  style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary)", whiteSpace: "nowrap" }}
                >
                  Select Repository:
                </label>
                <select
                  id="repository-select"
                  value={selectedRepoId}
                  onChange={(e) => {
                    setSelectedRepoId(e.target.value);
                    setSuccessMessage(null);
                    setErrorMessage(null);
                  }}
                  style={{
                    flex: "1 1 auto",
                    padding: "0.6rem 0.85rem",
                    borderRadius: "0.5rem",
                    border: "1px solid var(--border-color)",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                    fontSize: "0.95rem",
                    fontFamily: "inherit",
                  }}
                >
                  {repositories.map((repo) => (
                    <option key={repo.id} value={repo.id}>
                      {repo.fullName} {repo.trackingEnabled ? "(Tracked)" : "(Untracked)"}
                    </option>
                  ))}
                </select>
              </div>

              {selectedRepo && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.25rem 0.65rem",
                      borderRadius: "0.375rem",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      background: selectedRepo.trackingEnabled ? "rgba(34, 197, 94, 0.15)" : "var(--surface-muted)",
                      color: selectedRepo.trackingEnabled ? "#16a34a" : "var(--text-secondary)",
                      border: `1px solid ${selectedRepo.trackingEnabled ? "rgba(34, 197, 94, 0.4)" : "var(--border-color)"}`,
                    }}
                  >
                    {selectedRepo.trackingEnabled ? "Tracking Active" : "Tracking Disabled"}
                  </span>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    branch: <code>{selectedRepo.defaultBranch}</code>
                  </span>
                </div>
              )}
            </section>

            {/* Assignment Section Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "2rem" }}>
              {/* Form 1: Invite or Assign by Email */}
              <section
                className="dashboard-panel"
                style={{
                  padding: "2rem",
                  borderRadius: "0.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.5rem",
                }}
              >
                <div>
                  <h2 style={{ fontSize: "1.2rem", fontWeight: 600, margin: "0 0 0.4rem 0" }}>
                    Assign Lead by Email
                  </h2>
                  <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.875rem" }}>
                    Look up an existing workspace member or invite a new email as Lead for this repository.
                  </p>
                </div>

                <form onSubmit={(e) => void handleAssignManualEmail(e)} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
                    <div style={{ flex: 1 }}>
                      <FormField
                        id="lead-email"
                        label="Lead Email"
                        type="email"
                        required
                        placeholder="engineer@company.com"
                        value={manualEmail}
                        onChange={(e) => {
                          setManualEmail(e.target.value);
                          setLookupResult(null);
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      id="lookup-member-btn"
                      onClick={() => void handleLookup()}
                      disabled={lookingUp || !manualEmail.trim()}
                      style={{ height: "2.65rem", padding: "0 0.85rem", whiteSpace: "nowrap" }}
                    >
                      {lookingUp ? "Checking…" : "Lookup"}
                    </button>
                  </div>

                  {lookupResult && (
                    <div
                      style={{
                        padding: "0.75rem 1rem",
                        borderRadius: "0.5rem",
                        fontSize: "0.875rem",
                        background: lookupResult.existingUser
                          ? lookupResult.assignableAsLead
                            ? "rgba(34, 197, 94, 0.1)"
                            : "var(--danger-surface)"
                          : "rgba(59, 130, 246, 0.1)",
                        border: `1px solid ${
                          lookupResult.existingUser
                            ? lookupResult.assignableAsLead
                              ? "rgba(34, 197, 94, 0.3)"
                              : "var(--danger-border)"
                            : "rgba(59, 130, 246, 0.3)"
                        }`,
                        color: lookupResult.existingUser
                          ? lookupResult.assignableAsLead
                            ? "var(--text-primary)"
                            : "var(--danger-color)"
                          : "var(--text-primary)",
                      }}
                    >
                      {lookupResult.existingUser ? (
                        lookupResult.assignableAsLead ? (
                          <span>
                            <strong>Existing Member:</strong> User exists and can be assigned directly as a repository Lead.
                          </span>
                        ) : (
                          <span>
                            <strong>Cannot Assign:</strong> User is a Workspace Manager and cannot be assigned as a Lead.
                          </span>
                        )
                      ) : (
                        <span>
                          <strong>New Recipient:</strong> An invitation link will be sent to <strong>{lookupResult.email}</strong>.
                        </span>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    id="assign-lead-submit"
                    disabled={submitting || !manualEmail.trim() || (lookupResult !== null && !lookupResult.assignableAsLead && lookupResult.existingUser)}
                    style={{ marginTop: "0.5rem" }}
                  >
                    {submitting ? "Assigning…" : "Assign as Lead"}
                  </button>
                </form>
              </section>

              {/* Form 2: GitHub Contributor Candidates */}
              <section
                className="dashboard-panel"
                style={{
                  padding: "2rem",
                  borderRadius: "0.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.25rem",
                }}
              >
                <div>
                  <h2 style={{ fontSize: "1.2rem", fontWeight: 600, margin: "0 0 0.4rem 0" }}>
                    GitHub Collaborator Candidates
                  </h2>
                  <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.875rem" }}>
                    Suggested contributors and maintainers from this GitHub repository.
                  </p>
                </div>

                {loadingCandidates ? (
                  <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: "2rem 0" }}>
                    Loading GitHub contributors…
                  </p>
                ) : candidates.length === 0 ? (
                  <div
                    style={{
                      padding: "2rem 1rem",
                      textAlign: "center",
                      color: "var(--text-secondary)",
                      background: "var(--surface-muted)",
                      borderRadius: "0.5rem",
                      fontSize: "0.9rem",
                    }}
                  >
                    No collaborator candidates found on GitHub for this repository. Use the email assignment form above.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "420px", overflowY: "auto" }}>
                    {candidates.map((candidate) => {
                      const hasPublicEmail = Boolean(candidate.publicEmail);
                      const customEmail = candidateEmails[candidate.githubUserId] ?? "";

                      return (
                        <div
                          key={candidate.githubUserId}
                          style={{
                            padding: "1rem",
                            borderRadius: "0.5rem",
                            border: "1px solid var(--border-color)",
                            background: "var(--card-bg)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.75rem",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                              {candidate.avatarUrl ? (
                                <img
                                  src={candidate.avatarUrl}
                                  alt={candidate.login}
                                  style={{ width: "36px", height: "36px", borderRadius: "50%" }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: "36px",
                                    height: "36px",
                                    borderRadius: "50%",
                                    background: "var(--surface-muted)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: 700,
                                    fontSize: "0.85rem",
                                  }}
                                >
                                  {candidate.login.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                                  @{candidate.login}
                                </div>
                                {hasPublicEmail ? (
                                  <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                                    {candidate.publicEmail}
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      color: "#d97706",
                                      fontSize: "0.75rem",
                                      fontWeight: 500,
                                      display: "inline-block",
                                    }}
                                  >
                                    No public email on GitHub
                                  </div>
                                )}
                              </div>
                            </div>

                            {candidate.permission && (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "0.2rem 0.5rem",
                                  borderRadius: "0.25rem",
                                  background: "var(--surface-muted)",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {candidate.permission}
                              </span>
                            )}
                          </div>

                          {/* Action area: direct assign or email fallback */}
                          {hasPublicEmail ? (
                            <button
                              type="button"
                              onClick={() => void handleAssignCandidate(candidate)}
                              disabled={submitting}
                              style={{ width: "100%", fontSize: "0.875rem" }}
                            >
                              Assign {candidate.publicEmail} as Lead
                            </button>
                          ) : (
                            /* UI Fallback for when GitHub exposes no public contributor email */
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                              <label
                                htmlFor={`candidate-email-${candidate.githubUserId}`}
                                style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}
                              >
                                Enter work email to invite @{candidate.login}:
                              </label>
                              <div style={{ display: "flex", gap: "0.5rem" }}>
                                <input
                                  id={`candidate-email-${candidate.githubUserId}`}
                                  type="email"
                                  placeholder="lead@company.com"
                                  value={customEmail}
                                  aria-label={`Work email for ${candidate.login}`}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setCandidateEmails((prev) => ({
                                      ...prev,
                                      [candidate.githubUserId]: val,
                                    }));
                                  }}
                                  style={{
                                    flex: 1,
                                    padding: "0.5rem 0.75rem",
                                    borderRadius: "0.375rem",
                                    border: "1px solid var(--border-color)",
                                    background: "var(--input-bg)",
                                    color: "var(--text-primary)",
                                    fontSize: "0.875rem",
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => void handleAssignCandidate(candidate)}
                                  disabled={submitting || !customEmail.trim()}
                                  style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", whiteSpace: "nowrap" }}
                                >
                                  Invite
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* Recent Assignments in current session */}
            {recentAssignments.length > 0 && (
              <section className="dashboard-panel" style={{ padding: "2rem", borderRadius: "0.75rem" }}>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 600, margin: "0 0 1rem 0" }}>
                  Assignments & Invitations Created in this Session
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {recentAssignments.map((assignment) => (
                    <div
                      key={assignment.assignmentId}
                      style={{
                        padding: "1rem 1.25rem",
                        borderRadius: "0.5rem",
                        background: "var(--card-bg)",
                        border: "1px solid var(--border-color)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "1rem",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{assignment.email}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                          Role: {assignment.role} &bull; Status: {assignment.status ?? "ACTIVE"}
                          {assignment.expiresAt && ` &bull; Expires: ${new Date(assignment.expiresAt).toLocaleDateString()}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleUnassign(assignment)}
                        style={{
                          background: "var(--danger-surface) !important",
                          color: "var(--danger-color) !important",
                          borderColor: "var(--danger-border) !important",
                          fontSize: "0.85rem",
                          padding: "0.4rem 0.85rem",
                        }}
                      >
                        Unassign
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
