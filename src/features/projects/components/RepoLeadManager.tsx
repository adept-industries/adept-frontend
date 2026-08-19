import { useCallback, useEffect, useState } from "react";
import {
  createRepositoryLeadAssignment,
  deleteLeadAssignment,
  listRepositoryLeadAssignments,
  lookupWorkspaceMember,
  resendInvitation,
  type CurrentWorkspaceMemberLookupResponse,
  type LeadCandidateResponse,
  type PendingRepositoryLeadInvitationResponse,
} from "../../members/api.js";
import { getLeadCandidates } from "../../integrations/api.js";
import { FormField } from "../../../components/ui/FormField.js";
import { InlineAlert } from "../../../components/ui/InlineAlert.js";

interface RepoLeadManagerProps {
  repositoryId: string;
  repositoryName: string;
  onAssignmentsChange?: () => void;
  compact?: boolean;
}

export function RepoLeadManager({
  repositoryId,
  repositoryName,
  onAssignmentsChange,
  compact = false,
}: RepoLeadManagerProps) {
  const [assignments, setAssignments] = useState<PendingRepositoryLeadInvitationResponse[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"github" | "email">("github");

  const [candidates, setCandidates] = useState<LeadCandidateResponse[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidateEmails, setCandidateEmails] = useState<Record<string, string>>({});

  const [manualEmail, setManualEmail] = useState("");
  const [lookupResult, setLookupResult] = useState<CurrentWorkspaceMemberLookupResponse | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    try {
      setLoadingAssignments(true);
      const data = await listRepositoryLeadAssignments(repositoryId);
      setAssignments(data ?? []);
    } catch {
      setAssignments([]);
    } finally {
      setLoadingAssignments(false);
    }
  }, [repositoryId]);

  useEffect(() => {
    if (repositoryId) {
      void loadAssignments();
    }
  }, [repositoryId, loadAssignments]);

  const loadCandidates = async () => {
    try {
      setLoadingCandidates(true);
      const data = await getLeadCandidates(repositoryId);
      setCandidates(data ?? []);
    } catch {
      setCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    void loadCandidates();
  };

  const handleLookup = async () => {
    const trimmed = manualEmail.trim();
    if (!trimmed) return;
    setLookingUp(true);
    setErrorMessage(null);
    try {
      const res = await lookupWorkspaceMember({ email: trimmed });
      setLookupResult(res);
    } catch (err: unknown) {
      setLookupResult(null);
      setErrorMessage(err instanceof Error ? err.message : "Failed to lookup user.");
    } finally {
      setLookingUp(false);
    }
  };

  const handleAssignEmail = async (emailToAssign: string) => {
    const trimmed = emailToAssign.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await createRepositoryLeadAssignment(repositoryId, { email: trimmed });
      setSuccessMessage(`Lead invitation sent to ${trimmed} for ${repositoryName}`);
      setManualEmail("");
      setLookupResult(null);
      await loadAssignments();
      onAssignmentsChange?.();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to assign lead.");
    } finally {
      setSubmitting(false);
    }
  };

  const [resendingId, setResendingId] = useState<string | null>(null);

  const handleResend = async (invitationId: string, email: string) => {
    setResendingId(invitationId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await resendInvitation(invitationId);
      setSuccessMessage(`Invitation email resent to ${email}`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to resend invitation.");
    } finally {
      setResendingId(null);
    }
  };

  const handleUnassign = async (assignmentId: string, email: string) => {
    if (!window.confirm(`Unassign ${email} from ${repositoryName}?`)) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await deleteLeadAssignment(repositoryId, assignmentId);
      setSuccessMessage(`Unassigned ${email} from ${repositoryName}`);
      await loadAssignments();
      onAssignmentsChange?.();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to unassign lead.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {successMessage && <InlineAlert message={successMessage} kind="success" />}
      {errorMessage && <InlineAlert message={errorMessage} kind="error" />}

      {/* Current Assignments Display */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--text-secondary, #94a3b8)" }}>
          Leads:
        </span>
        {loadingAssignments ? (
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary, #94a3b8)" }}>Loading…</span>
        ) : assignments.length === 0 ? (
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary, #94a3b8)", fontStyle: "italic" }}>
            No leads assigned
          </span>
        ) : (
          assignments.map((assignment) => (
            <span
              key={assignment.assignmentId}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.2rem 0.5rem",
                borderRadius: "4px",
                backgroundColor: assignment.status === "PENDING" ? "rgba(245, 158, 11, 0.12)" : "rgba(34, 197, 94, 0.12)",
                border: `1px solid ${assignment.status === "PENDING" ? "rgba(245, 158, 11, 0.3)" : "rgba(34, 197, 94, 0.3)"}`,
                fontSize: "0.78rem",
                color: "var(--text-primary)",
              }}
            >
              <strong>{assignment.email}</strong>
              <span
                style={{
                  fontSize: "0.7rem",
                  padding: "0.05rem 0.3rem",
                  borderRadius: "3px",
                  backgroundColor: assignment.status === "PENDING" ? "rgba(245, 158, 11, 0.25)" : "rgba(34, 197, 94, 0.25)",
                  color: assignment.status === "PENDING" ? "#f59e0b" : "#22c55e",
                  fontWeight: 600,
                }}
              >
                {assignment.status === "PENDING" ? "Pending Invite" : "Active Lead"}
              </span>
              {assignment.status === "PENDING" && assignment.invitationId && (
                <button
                  type="button"
                  aria-label={`Resend invite to ${assignment.email}`}
                  disabled={resendingId === assignment.invitationId}
                  onClick={() => void handleResend(assignment.invitationId!, assignment.email)}
                  style={{
                    background: "rgba(245, 158, 11, 0.15)",
                    border: "1px solid rgba(245, 158, 11, 0.4)",
                    borderRadius: "3px",
                    color: "#f59e0b",
                    cursor: resendingId === assignment.invitationId ? "not-allowed" : "pointer",
                    padding: "0.05rem 0.35rem",
                    fontSize: "0.7rem",
                    fontWeight: 500,
                  }}
                  title="Resend invitation email"
                >
                  {resendingId === assignment.invitationId ? "Resending…" : "Resend"}
                </button>
              )}
              <button
                type="button"
                aria-label={`Unassign ${assignment.email}`}
                onClick={() => void handleUnassign(assignment.assignmentId, assignment.email)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-secondary, #94a3b8)",
                  cursor: "pointer",
                  padding: "0 0.15rem",
                  fontSize: "0.85rem",
                  lineHeight: 1,
                }}
                title="Unassign lead"
              >
                ✕
              </button>
            </span>
          ))
        )}

        <button
          type="button"
          onClick={handleOpen}
          style={{
            fontSize: "0.78rem",
            padding: "0.2rem 0.55rem",
            borderRadius: "4px",
            background: "var(--card-bg, #1a1a2e)",
            border: "1px dashed var(--primary-color, #6366f1)",
            color: "var(--primary-light, #818cf8)",
            cursor: "pointer",
            fontWeight: 500,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          + Add / Invite Lead
        </button>
      </div>

      {/* Inline Assignment Modal / Panel */}
      {isOpen && (
        <div
          style={{
            marginTop: "0.5rem",
            padding: compact ? "0.85rem" : "1.25rem",
            backgroundColor: "var(--input-bg, #141420)",
            border: "1px solid var(--border-color, #2d2d42)",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "0.85rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>
              Assign Lead to <code>{repositoryName}</code>
            </h4>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-secondary, #94a3b8)",
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              ✕
            </button>
          </div>

          {/* Option switcher tabs */}
          <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border-color, #2d2d42)", paddingBottom: "0.4rem" }}>
            <button
              type="button"
              onClick={() => setActiveTab("github")}
              style={{
                background: "transparent",
                border: "none",
                padding: "0.3rem 0.6rem",
                fontSize: "0.85rem",
                fontWeight: activeTab === "github" ? 600 : 400,
                color: activeTab === "github" ? "var(--primary-light, #818cf8)" : "var(--text-secondary, #94a3b8)",
                borderBottom: activeTab === "github" ? "2px solid var(--primary-color, #6366f1)" : "none",
                cursor: "pointer",
              }}
            >
              GitHub Contributors
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("email")}
              style={{
                background: "transparent",
                border: "none",
                padding: "0.3rem 0.6rem",
                fontSize: "0.85rem",
                fontWeight: activeTab === "email" ? 600 : 400,
                color: activeTab === "email" ? "var(--primary-light, #818cf8)" : "var(--text-secondary, #94a3b8)",
                borderBottom: activeTab === "email" ? "2px solid var(--primary-color, #6366f1)" : "none",
                cursor: "pointer",
              }}
            >
              Work Email
            </button>
          </div>

          {/* Tab 1: GitHub Contributors */}
          {activeTab === "github" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary, #94a3b8)" }}>
                Select a GitHub contributor or collaborator for this repository. If their email is public on GitHub, they can be invited instantly.
              </p>
              {loadingCandidates ? (
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary, #94a3b8)" }}>Loading GitHub contributors…</p>
              ) : candidates.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary, #94a3b8)", fontStyle: "italic" }}>
                  No contributor candidates found via GitHub API. Use Option 2 (Work Email) to invite directly.
                </p>
              ) : (
                <div style={{ maxHeight: "200px", overflowY: "auto", display: "grid", gap: "0.4rem" }}>
                  {candidates.map((c) => (
                    <div
                      key={c.githubUserId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.45rem 0.65rem",
                        borderRadius: "6px",
                        backgroundColor: "var(--card-bg, #1a1a2e)",
                        border: "1px solid var(--border-color, #2d2d42)",
                        fontSize: "0.85rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {c.avatarUrl && (
                          <img
                            src={c.avatarUrl}
                            alt={c.login}
                            style={{ width: "22px", height: "22px", borderRadius: "50%" }}
                          />
                        )}
                        <span style={{ fontWeight: 600 }}>@{c.login}</span>
                        {c.permission && (
                          <span
                            style={{
                              fontSize: "0.7rem",
                              padding: "0.1rem 0.35rem",
                              borderRadius: "3px",
                              backgroundColor: "rgba(99, 102, 241, 0.15)",
                              color: "var(--primary-light, #818cf8)",
                            }}
                          >
                            {c.permission}
                          </span>
                        )}
                        {c.publicEmail && (
                          <span style={{ fontSize: "0.78rem", color: "var(--text-secondary, #94a3b8)" }}>
                            ({c.publicEmail})
                          </span>
                        )}
                      </div>

                      {c.publicEmail ? (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => void handleAssignEmail(c.publicEmail!)}
                          className="primary-button"
                          style={{ fontSize: "0.78rem", padding: "0.25rem 0.6rem" }}
                        >
                          {submitting ? "Inviting…" : "Assign as Lead"}
                        </button>
                      ) : (
                        <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                          <input
                            type="email"
                            placeholder="Enter work email…"
                            value={candidateEmails[c.githubUserId] ?? ""}
                            onChange={(e) =>
                              setCandidateEmails((prev) => ({ ...prev, [c.githubUserId]: e.target.value }))
                            }
                            style={{
                              fontSize: "0.78rem",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "4px",
                              border: "1px solid var(--border-color, #2d2d42)",
                              background: "var(--input-bg, #141420)",
                              color: "var(--text-primary)",
                            }}
                          />
                          <button
                            type="button"
                            disabled={submitting || !candidateEmails[c.githubUserId]?.trim()}
                            onClick={() => void handleAssignEmail(candidateEmails[c.githubUserId] ?? "")}
                            className="primary-button"
                            style={{ fontSize: "0.78rem", padding: "0.25rem 0.6rem" }}
                          >
                            Invite
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Work Email */}
          {activeTab === "email" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <FormField
                    id={`lead-email-${repositoryId}`}
                    label="Lead Work Email"
                    type="email"
                    required
                    placeholder="engineer@company.com"
                    value={manualEmail}
                    onChange={(e) => {
                      setManualEmail(e.target.value);
                      if (lookupResult) setLookupResult(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleAssignEmail(manualEmail);
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleLookup()}
                  disabled={lookingUp || !manualEmail.trim()}
                  className="button-link"
                  style={{ height: "2.65rem", padding: "0 0.85rem", whiteSpace: "nowrap" }}
                >
                  {lookingUp ? "Checking…" : "Lookup"}
                </button>
              </div>

              {lookupResult && (
                <div
                  style={{
                    padding: "0.6rem 0.8rem",
                    borderRadius: "6px",
                    fontSize: "0.8rem",
                    background:
                      lookupResult.workspaceRole === "MANAGER"
                        ? "var(--danger-surface)"
                        : lookupResult.assignableAsLead
                          ? "rgba(34, 197, 94, 0.1)"
                          : "rgba(59, 130, 246, 0.1)",
                    border: `1px solid ${
                      lookupResult.workspaceRole === "MANAGER"
                        ? "var(--danger-border)"
                        : lookupResult.assignableAsLead
                          ? "rgba(34, 197, 94, 0.3)"
                          : "rgba(59, 130, 246, 0.3)"
                    }`,
                    color: lookupResult.workspaceRole === "MANAGER" ? "var(--danger-color)" : "var(--text-primary)",
                  }}
                >
                  {lookupResult.workspaceRole === "MANAGER" ? (
                    <span>
                      <strong>Already Manager:</strong> User is a Manager in this workspace and already has full access to all repositories.
                    </span>
                  ) : lookupResult.assignableAsLead ? (
                    <span>
                      <strong>Existing Workspace Member:</strong> User will be assigned directly as a repository Lead.
                    </span>
                  ) : lookupResult.existingUser ? (
                    <span>
                      <strong>Existing Adept User:</strong> An invitation link will be sent to <strong>{lookupResult.email}</strong> to join this workspace as Lead.
                    </span>
                  ) : (
                    <span>
                      <strong>New Recipient:</strong> An invitation link will be sent to <strong>{lookupResult.email}</strong>.
                    </span>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  disabled={submitting || !manualEmail.trim() || (lookupResult !== null && lookupResult.workspaceRole === "MANAGER")}
                  onClick={() => void handleAssignEmail(manualEmail)}
                  className="primary-button"
                  style={{ fontSize: "0.85rem", padding: "0.4rem 0.85rem" }}
                >
                  {submitting
                    ? "Assigning…"
                    : lookupResult?.assignableAsLead
                      ? "Assign as Lead"
                      : "Send Lead Invitation"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
