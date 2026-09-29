import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { useParams, useNavigate } from "react-router";
import { useAuth } from "../../auth/AuthProvider.js";
import { AppShell } from "../../components/layout/AppShell.js";
import { useProjects } from "../projects/useProjects.js";
import { useTeamChat } from "./useTeamChat.js";
import type { ChatMessage, TeamMember } from "./types.js";
import "./teams.css";

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function TeamsPage() {
  const { state: authState } = useAuth();
  const currentUserId = authState.status === "authenticated" ? authState.user.id : null;
  const { projects, loading: loadingProjects } = useProjects();
  const { projectId: routeProjectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();

  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Determine active project
  const selectedProjectId =
    routeProjectId ?? (projects.length > 0 ? projects[0].id : null);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  const {
    team,
    messages,
    isLoadingMessages,
    isSending,
    sendMessage,
  } = useTeamChat(selectedProjectId);

  // Auto-scroll to bottom of messages container
  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSelectTeam = (id: string) => {
    navigate(`/dashboard/teams/${id}`);
  };

  const handleBackToTeams = () => {
    navigate("/dashboard/teams");
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSending) return;
    const text = inputMessage;
    setInputMessage("");
    await sendMessage(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  return (
    <AppShell>
      <div className={`dash-header-row ${routeProjectId ? "teams-header-mobile-compact" : ""}`}>
        <div className="dash-welcome">
          <p className="dash-welcome-eyebrow">Real-Time Team Collaboration</p>
          <h1 id="teams-title" className="dash-welcome-title">Teams</h1>
          <p className="dash-welcome-sub">
            Real-time chat channels for workspace projects between managers and repository leads.
          </p>
        </div>
      </div>

      <div className={`teams-layout ${routeProjectId ? "has-selected-chat" : "no-selected-chat"}`}>
        {/* Left: Teams / Projects List */}
        <aside id="team-channels-panel" className="teams-sidebar" aria-label="Team chats">
          <div className="teams-sidebar-header">
            <h2 className="teams-sidebar-title">
              Team chats
              <span className="teams-count-badge">{projects.length}</span>
            </h2>
          </div>
          <div className="teams-list">
            {loadingProjects && (
              <div style={{ padding: "1rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                Loading teams...
              </div>
            )}
            {!loadingProjects && projects.length === 0 && (
              <div style={{ padding: "1rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                No project teams found.
              </div>
            )}
            {projects.map((project) => {
              const isActive = project.id === selectedProjectId;
              return (
                <button
                  key={project.id}
                  type="button"
                  className={`team-channel-item ${isActive ? "active" : ""}`}
                  onClick={() => handleSelectTeam(project.id)}
                  aria-pressed={isActive}
                >
                  <div className="team-channel-details">
                    <div className="team-channel-name">{project.name}</div>
                    {project.description && (
                      <div className="team-channel-sub">{project.description}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right: Chat Pane */}
        <main className="teams-chat-pane">
          {selectedProject ? (
            <>
              {/* Header */}
              <div className="teams-chat-header">
                <div className="teams-header-info">
                  <div className="teams-header-title-row">
                    <button
                      type="button"
                      className="teams-back-btn"
                      onClick={handleBackToTeams}
                      aria-label="Back to team chats"
                      title="Back to team chats"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                      <span>Chats</span>
                    </button>
                    <h2 className="teams-header-title">
                      {selectedProject.name}
                    </h2>
                    {team && team.members.length > 0 && (
                      <div className="team-members-chips" aria-label="Team members">
                        {team.members.map((member: TeamMember) => (
                          <div
                            key={member.membershipId}
                            className="member-chip"
                            title={`${member.displayName} (${member.email})`}
                          >
                            <span
                              className={`member-chip-role ${member.role === "MANAGER" ? "manager" : "lead"}`}
                            >
                              {member.role}
                            </span>
                            <span className="member-chip-name">{member.displayName}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedProject.description && (
                    <div className="teams-header-desc">{selectedProject.description}</div>
                  )}
                </div>
              </div>

              {/* Messages Scroller */}
              <div className="teams-messages-scroller" tabIndex={0} aria-label="Messages">
                {isLoadingMessages && messages.length === 0 && (
                  <div className="teams-empty-state">
                    <p>Loading messages...</p>
                  </div>
                )}
                {!isLoadingMessages && messages.length === 0 && (
                  <div className="teams-empty-state">
                    <h3 className="teams-empty-title">Welcome to {selectedProject.name}!</h3>
                    <p>This is the start of the team chat for {selectedProject.name}.</p>
                    <p>Send a message below to start collaborating.</p>
                  </div>
                )}
                {messages.map((message: ChatMessage) => {
                  const isSelf = message.sender.userId === currentUserId;
                  return (
                    <div
                      key={message.id}
                      className={`message-item ${isSelf ? "self" : ""}`}
                    >
                      <div className="message-avatar" aria-hidden="true">
                        {getInitials(message.sender.displayName)}
                      </div>
                      <div className="message-content-wrapper">
                        <div className="message-sender-line">
                          <span className="message-sender-name">
                            {message.sender.displayName}
                          </span>
                          <span
                            className={`member-chip-role ${message.sender.role === "MANAGER" ? "manager" : "lead"}`}
                          >
                            {message.sender.role}
                          </span>
                          <time dateTime={message.createdAt}>
                            {formatTime(message.createdAt)}
                          </time>
                        </div>
                        <div className="message-bubble">{message.content}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <div className="teams-input-bar">
                <form className="teams-input-form" onSubmit={handleSend}>
                  <textarea
                    className="teams-input-field"
                    placeholder={`Message ${selectedProject.name}... (Press Enter to send, Shift+Enter for newline)`}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    aria-label={`Message ${selectedProject.name}`}
                  />
                  <button
                    type="submit"
                    className="teams-send-btn"
                    disabled={!inputMessage.trim() || isSending}
                    aria-label="Send message"
                  >
                    Send
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="teams-empty-state">
              <h3 className="teams-empty-title">Select a team channel</h3>
              <p>Choose a team from the left sidebar to start messaging.</p>
            </div>
          )}
        </main>
      </div>
    </AppShell>
  );
}
