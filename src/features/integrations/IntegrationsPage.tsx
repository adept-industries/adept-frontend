import { useEffect, useState, useTransition } from "react";
import { Link } from "react-router";
import { useAuth } from "../../auth/AuthProvider.js";
import { formatWorkspaceDateTime } from "../../lib/timezone.js";
import { AppShell } from "../../components/layout/AppShell.js";
import {
  disconnectGithubIntegration,
  disconnectJiraIntegration,
  getGithubConnectUrl,
  getGithubIntegration,
  getJiraConnectUrl,
  getJiraIntegration,
  listJiraProjects,
  listRepositories,
  requestRepositoryBackfill,
  syncGithubRepositories,
  updateJiraProjectTracking,
  updateRepository,
  type GithubIntegrationResponse,
  type JiraIntegrationResponse,
  type JiraProjectResponse,
  type RepositoryResponse,
  type RepositorySettings,
} from "./api.js";
import { RepositorySettingsModal } from "./RepositorySettingsModal.js";
import { RepositoryJiraModal } from "./RepositoryJiraModal.js";

export function IntegrationsPage() {
  const { state: authState } = useAuth();
  const workspaceTimezone = authState.status === "authenticated" ? authState.currentMembership.timezone : "UTC";

  const [github, setGithub] = useState<GithubIntegrationResponse | null>(null);
  const [jira, setJira] = useState<JiraIntegrationResponse | null>(null);
  const [repositories, setRepositories] = useState<RepositoryResponse[]>([]);
  const [jiraProjects, setJiraProjects] = useState<JiraProjectResponse[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [trackingFilter, setTrackingFilter] = useState<"ALL" | "TRACKED">("ALL");

  const [selectedRepoForSettings, setSelectedRepoForSettings] = useState<RepositoryResponse | null>(null);
  const [selectedRepoForJira, setSelectedRepoForJira] = useState<RepositoryResponse | null>(null);

  const [isPending, startTransition] = useTransition();
  const [syncingGithub, setSyncingGithub] = useState(false);

  const loadData = async () => {
    try {
      setError(null);
      const [gh, jr, repos, jProjects] = await Promise.all([
        getGithubIntegration().catch(() => undefined),
        getJiraIntegration().catch(() => undefined),
        listRepositories().catch(() => []),
        listJiraProjects().catch(() => []),
      ]);
      setGithub(gh ?? null);
      setJira(jr ?? null);
      setRepositories(repos ?? []);
      setJiraProjects(jProjects ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load integrations data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleConnectGithub = async () => {
    try {
      setError(null);
      const { url } = await getGithubConnectUrl();
      window.location.href = url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to initiate GitHub connection");
    }
  };

  const handleSyncGithub = async () => {
    if (!github) return;
    setSyncingGithub(true);
    try {
      await syncGithubRepositories(github.id);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sync GitHub repositories");
    } finally {
      setSyncingGithub(false);
    }
  };

  const handleDisconnectGithub = async () => {
    if (!github || !window.confirm("Are you sure you want to disconnect GitHub? Tracking will be stopped for all repositories.")) {
      return;
    }
    try {
      await disconnectGithubIntegration(github.id);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to disconnect GitHub");
    }
  };

  const handleConnectJira = async () => {
    try {
      setError(null);
      const { url } = await getJiraConnectUrl();
      window.location.href = url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to initiate Jira connection");
    }
  };

  const handleDisconnectJira = async () => {
    if (!jira || !window.confirm("Are you sure you want to disconnect Jira? Tracking will be stopped for all Jira projects.")) {
      return;
    }
    try {
      await disconnectJiraIntegration(jira.id);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to disconnect Jira");
    }
  };

  const handleToggleRepoTracking = async (repo: RepositoryResponse) => {
    const nextState = !repo.trackingEnabled;
    startTransition(async () => {
      try {
        const updated = await updateRepository(repo.id, { trackingEnabled: nextState });
        setRepositories((prev) =>
          prev.map((r) => (r.id === repo.id ? updated : r))
        );
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to update repository tracking");
      }
    });
  };

  const handleSaveRepoSettings = async (settings: Partial<RepositorySettings>) => {
    if (!selectedRepoForSettings) return;
    const updated = await updateRepository(selectedRepoForSettings.id, { settings });
    setRepositories((prev) =>
      prev.map((r) => (r.id === selectedRepoForSettings.id ? updated : r))
    );
    setSelectedRepoForSettings(null);
  };

  const handleRebuildRepoData = async () => {
    if (!selectedRepoForSettings) return;
    await requestRepositoryBackfill(selectedRepoForSettings.id);
  };

  const handleToggleJiraTracking = async (project: JiraProjectResponse) => {
    const nextState = !project.trackingEnabled;
    try {
      const updated = await updateJiraProjectTracking(project.id, nextState);
      setJiraProjects((prev) =>
        prev.map((p) => (p.id === project.id ? updated : p))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update Jira project tracking");
    }
  };

  const filteredRepos = repositories.filter((repo) => {
    const matchesSearch =
      repo.fullName.toLowerCase().includes(search.toLowerCase()) ||
      repo.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      trackingFilter === "ALL" || (trackingFilter === "TRACKED" && repo.trackingEnabled);
    return matchesSearch && matchesFilter;
  });

  return (
    <AppShell>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            to="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.85rem",
              color: "var(--text-secondary, #94a3b8)",
              padding: "0.2rem 0",
              textDecoration: "none",
              background: "transparent",
              border: "none",
              fontWeight: 500,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back to Dashboard
          </Link>
        </div>

        {/* Header */}
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>Integrations & Repositories</h1>
          <p style={{ color: "var(--text-secondary, #94a3b8)", fontSize: "0.95rem", margin: "0.25rem 0 0 0" }}>
            Connect source control and issue trackers, configure deployment signals, and manage repository tracking.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: "1rem",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid #ef4444",
              borderRadius: "8px",
              color: "#f87171",
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        )}

        {/* Integration Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.5rem" }}>
          {/* GitHub Integration Card */}
          <div
            style={{
              backgroundColor: "var(--card-bg, #161622)",
              border: "1px solid var(--border-color, #272738)",
              borderRadius: "10px",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "1.25rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                </div>
                <div>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>GitHub App</h2>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary, #94a3b8)" }}>
                    Source repositories & actions
                  </span>
                </div>
              </div>

              {github && (
                <span
                  style={{
                    padding: "0.25rem 0.6rem",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    backgroundColor: github.status === "ACTIVE" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                    color: github.status === "ACTIVE" ? "#4ade80" : "#f87171",
                  }}
                >
                  {github.status}
                </span>
              )}
            </div>

            {github ? (
              <div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary, #94a3b8)", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <div>Connected Organization: <strong style={{ color: "var(--text-primary, #ffffff)" }}>{github.accountLogin}</strong></div>
                  <div>Discovered Repositories: <strong style={{ color: "var(--text-primary, #ffffff)" }}>{github.repositoryCount}</strong></div>
                  <div>Last Synced: {formatWorkspaceDateTime(github.lastSyncedAt, workspaceTimezone)}</div>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                  {github.status === "ACTIVE" ? (
                    <>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={handleSyncGithub}
                        disabled={syncingGithub}
                        style={{ fontSize: "0.85rem", padding: "0.4rem 0.9rem" }}
                      >
                        {syncingGithub ? "Syncing..." : "Sync Repositories"}
                      </button>
                      <button
                        type="button"
                        className="button-link"
                        onClick={handleDisconnectGithub}
                        style={{ fontSize: "0.85rem", color: "#f87171", padding: "0.4rem 0.9rem" }}
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      id="reconnect-github-btn"
                      className="primary-button"
                      onClick={handleConnectGithub}
                      style={{ fontSize: "0.85rem", padding: "0.4rem 0.9rem" }}
                    >
                      Reconnect GitHub App
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary, #94a3b8)", margin: "0 0 1rem 0" }}>
                  Install the Adept GitHub App on your GitHub organization or account to track codebases and deployments.
                </p>
                <button
                  type="button"
                  id="connect-github-btn"
                  className="primary-button"
                  onClick={handleConnectGithub}
                  style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }}
                >
                  Connect GitHub App
                </button>
              </div>
            )}
          </div>

          {/* Jira Integration Card */}
          <div
            style={{
              backgroundColor: "var(--card-bg, #161622)",
              border: "1px solid var(--border-color, #272738)",
              borderRadius: "10px",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "1.25rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(0, 82, 204, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="#0052CC">
                    <path d="M11.53 2c0 5.26 4.27 9.53 9.53 9.53V2h-9.53zm-9.53 9.53c0 5.26 4.27 9.53 9.53 9.53V11.53H2zm9.53 0c0 5.26 4.27 9.53 9.53 9.53V11.53h-9.53z" />
                  </svg>
                </div>
                <div>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>Jira Cloud</h2>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary, #94a3b8)" }}>
                    Incident tracking & MTTR
                  </span>
                </div>
              </div>

              {jira && (
                <span
                  style={{
                    padding: "0.25rem 0.6rem",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    backgroundColor: jira.status === "ACTIVE" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                    color: jira.status === "ACTIVE" ? "#4ade80" : "#f87171",
                  }}
                >
                  {jira.status}
                </span>
              )}
            </div>

            {jira ? (
              <div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary, #94a3b8)", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <div>Site: <strong style={{ color: "var(--text-primary, #ffffff)" }}>{jira.displayName}</strong> ({jira.siteUrl})</div>
                  <div>Discovered Projects: <strong style={{ color: "var(--text-primary, #ffffff)" }}>{jira.projectCount}</strong></div>
                  <div>Last Synced: {formatWorkspaceDateTime(jira.lastSyncedAt, workspaceTimezone)}</div>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                  {jira.status === "ACTIVE" ? (
                    <button
                      type="button"
                      className="button-link"
                      onClick={handleDisconnectJira}
                      style={{ fontSize: "0.85rem", color: "#f87171", padding: "0.4rem 0.9rem" }}
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      type="button"
                      id="reconnect-jira-btn"
                      className="primary-button"
                      onClick={handleConnectJira}
                      style={{ fontSize: "0.85rem", padding: "0.4rem 0.9rem" }}
                    >
                      Reconnect Jira Cloud
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary, #94a3b8)", margin: "0 0 1rem 0" }}>
                  Connect your Jira Cloud workspace with OAuth 2.0 3LO to sync incident tickets and calculate Time to Restore Service.
                </p>
                <button
                  type="button"
                  id="connect-jira-btn"
                  className="primary-button"
                  onClick={handleConnectJira}
                  style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }}
                >
                  Connect Jira Cloud
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Repository Catalog Section */}
        <section style={{ backgroundColor: "var(--card-bg, #161622)", border: "1px solid var(--border-color, #272738)", borderRadius: "10px", padding: "1.5rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" }}>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Repository Catalog</h2>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary, #94a3b8)" }}>
                Enable tracking to calculate DORA metrics and ingest deployment workflows.
              </span>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search repositories..."
                style={{
                  padding: "0.4rem 0.75rem",
                  borderRadius: "6px",
                  backgroundColor: "var(--input-bg, #242436)",
                  border: "1px solid var(--border-color, #3b3b54)",
                  color: "var(--text-primary, #ffffff)",
                  fontSize: "0.85rem",
                  minWidth: "200px",
                }}
              />
              <div style={{ display: "flex", backgroundColor: "var(--input-bg, #242436)", borderRadius: "6px", padding: "2px", border: "1px solid var(--border-color, #3b3b54)" }}>
                <button
                  type="button"
                  onClick={() => setTrackingFilter("ALL")}
                  style={{
                    background: trackingFilter === "ALL" ? "rgba(255, 255, 255, 0.1)" : "none",
                    border: "none",
                    borderRadius: "4px",
                    padding: "0.3rem 0.6rem",
                    fontSize: "0.75rem",
                    color: "var(--text-primary, #ffffff)",
                    cursor: "pointer",
                  }}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setTrackingFilter("TRACKED")}
                  style={{
                    background: trackingFilter === "TRACKED" ? "rgba(255, 255, 255, 0.1)" : "none",
                    border: "none",
                    borderRadius: "4px",
                    padding: "0.3rem 0.6rem",
                    fontSize: "0.75rem",
                    color: "var(--text-primary, #ffffff)",
                    cursor: "pointer",
                  }}
                >
                  Tracked Only
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <p style={{ color: "var(--text-secondary, #94a3b8)", fontSize: "0.9rem" }}>Loading repositories...</p>
          ) : filteredRepos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--text-secondary, #94a3b8)" }}>
              {repositories.length === 0
                ? "No repositories synchronized yet. Connect GitHub App to populate catalog."
                : "No repositories match your search filter."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color, #2d2d3d)", textAlign: "left", color: "var(--text-secondary, #94a3b8)" }}>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Track</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Repository</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Default Branch</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Visibility</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Deployment Signal</th>
                    <th style={{ padding: "0.75rem 0.5rem", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRepos.map((repo) => (
                    <tr
                      key={repo.id}
                      style={{
                        borderBottom: "1px solid var(--border-color, #272738)",
                        transition: "background-color 0.15s ease",
                      }}
                    >
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        <input
                          type="checkbox"
                          checked={repo.trackingEnabled}
                          onChange={() => void handleToggleRepoTracking(repo)}
                          disabled={isPending}
                          style={{ width: "1.1rem", height: "1.1rem", cursor: "pointer" }}
                        />
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-primary, #ffffff)" }}>
                          {repo.fullName}
                        </div>
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        <span
                          style={{
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                            backgroundColor: "rgba(255, 255, 255, 0.06)",
                            fontFamily: "monospace",
                            fontSize: "0.75rem",
                          }}
                        >
                          {repo.defaultBranch}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary, #94a3b8)" }}>
                          {repo.visibility}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        <span
                          style={{
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            fontWeight: 500,
                            backgroundColor: "rgba(99, 102, 241, 0.12)",
                            color: "var(--primary-light, #818cf8)",
                          }}
                        >
                          {repo.settings?.deploymentSignal ?? "WORKFLOW_RUN"}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                          <button
                            type="button"
                            className="button-link"
                            onClick={() => setSelectedRepoForSettings(repo)}
                            style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
                          >
                            Settings
                          </button>
                          <button
                            type="button"
                            className="button-link"
                            onClick={() => setSelectedRepoForJira(repo)}
                            style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
                          >
                            Map Jira
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Jira Projects Catalog Section */}
        {jira && (
          <section style={{ backgroundColor: "var(--card-bg, #161622)", border: "1px solid var(--border-color, #272738)", borderRadius: "10px", padding: "1.5rem" }}>
            <div style={{ marginBottom: "1.25rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Discovered Jira Projects</h2>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary, #94a3b8)" }}>
                Enable project tracking to ingest Jira incident tickets and calculate restoration duration.
              </span>
            </div>

            {jiraProjects.length === 0 ? (
              <p style={{ color: "var(--text-secondary, #94a3b8)", fontSize: "0.9rem" }}>No Jira projects found in connected site.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
                {jiraProjects.map((proj) => (
                  <div
                    key={proj.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.75rem 1rem",
                      borderRadius: "6px",
                      backgroundColor: "var(--input-bg, #242436)",
                      border: "1px solid var(--border-color, #3b3b54)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                        [{proj.projectKey}] {proj.projectName}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary, #94a3b8)" }}>
                        Type: {proj.projectType}
                      </div>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={proj.trackingEnabled}
                        onChange={() => void handleToggleJiraTracking(proj)}
                        style={{ width: "1rem", height: "1rem", cursor: "pointer" }}
                      />
                      <span>Track</span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Modals */}
        {selectedRepoForSettings && (
          <RepositorySettingsModal
            repository={selectedRepoForSettings}
            onClose={() => setSelectedRepoForSettings(null)}
            onSave={handleSaveRepoSettings}
            onRebuild={handleRebuildRepoData}
          />
        )}

        {selectedRepoForJira && (
          <RepositoryJiraModal
            repository={selectedRepoForJira}
            onClose={() => setSelectedRepoForJira(null)}
            onSaved={loadData}
          />
        )}
      </div>
    </AppShell>
  );
}
