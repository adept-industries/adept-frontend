import { useContext, useEffect, useState, useTransition } from "react";
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
  syncJiraProjects,
  updateJiraProjectTracking,
  updateRepository,
  type GithubIntegrationResponse,
  type JiraIntegrationResponse,
  type JiraProjectResponse,
  type RepositoryResponse,
  type RepositorySettings,
} from "./api.js";
import { RepositorySettingsModal } from "./RepositorySettingsModal.js";
import { ProjectContext } from "../projects/ProjectContext.js";

const JIRA_SYNC_POLL_INTERVAL_MS = 1_000;
const JIRA_SYNC_TIMEOUT_MS = 30_000;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function waitForJiraProjectSync(
  integrationId: string,
  previousLastSyncedAt: string,
): Promise<{ integration: JiraIntegrationResponse; projects: JiraProjectResponse[] } | null> {
  const deadline = Date.now() + JIRA_SYNC_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const integration = await getJiraIntegration();
    if (!integration || integration.id !== integrationId) {
      throw new Error("Jira integration is no longer available.");
    }
    if (integration.status === "ERROR") {
      throw new Error("Jira project sync failed. Reconnect Jira Cloud and try again.");
    }
    if (integration.status !== "ACTIVE") {
      throw new Error("Jira integration is no longer active.");
    }
    if (integration.lastSyncedAt !== previousLastSyncedAt) {
      return {
        integration,
        projects: await listJiraProjects(),
      };
    }
    await wait(JIRA_SYNC_POLL_INTERVAL_MS);
  }

  return null;
}

function isRepoDeletedFromGithub(repo: RepositoryResponse, githubLastSyncedAt?: string): boolean {
  return Boolean(
    githubLastSyncedAt &&
    !repo.trackingEnabled &&
    (!repo.lastSyncedAt || new Date(repo.lastSyncedAt).getTime() < new Date(githubLastSyncedAt).getTime())
  );
}

function isRepoConfigurationNeeded(repo: RepositoryResponse): boolean {
  if (!repo.settings) return true;
  const signal = repo.settings.deploymentSignal ?? "WORKFLOW_RUN";
  if (signal === "WORKFLOW_RUN") {
    const workflows = repo.settings.deploymentWorkflowNamePatterns;
    return !workflows || workflows.length === 0;
  }
  if (signal === "DEPLOYMENT") {
    const envs = repo.settings.productionEnvironmentPatterns;
    return !envs || envs.length === 0;
  }
  return false;
}

export function IntegrationsPage() {
  const { state: authState } = useAuth();
  const workspaceTimezone = authState.status === "authenticated" ? authState.currentMembership.timezone : "UTC";

  const [github, setGithub] = useState<GithubIntegrationResponse | null>(null);
  const [jira, setJira] = useState<JiraIntegrationResponse | null>(null);
  const [repositories, setRepositories] = useState<RepositoryResponse[]>([]);
  const [jiraProjects, setJiraProjects] = useState<JiraProjectResponse[]>([]);

  const projectContext = useContext(ProjectContext);
  const projects = projectContext?.projects ?? [];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [trackingFilter, setTrackingFilter] = useState<"ALL" | "TRACKED">("ALL");
  const [glowingRepoId, setGlowingRepoId] = useState<string | null>(null);

  const [releaseConfirmation, setReleaseConfirmation] = useState<{
    title: string;
    message: string;
    projectNames: string[];
    confirmLabel: string;
    action: () => Promise<void>;
  } | null>(null);
  const [confirmingRelease, setConfirmingRelease] = useState(false);

  const [selectedRepoForSettings, setSelectedRepoForSettings] = useState<RepositoryResponse | null>(null);

  const [isPending, startTransition] = useTransition();
  const [syncingGithub, setSyncingGithub] = useState(false);
  const [syncingJira, setSyncingJira] = useState(false);
  const [rebuildingRepositoryId, setRebuildingRepositoryId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const clearWarnings = () => {
    setGlowingRepoId(null);
  };

  useEffect(() => {
    if (!glowingRepoId) {
      return;
    }

    const handleClickAnywhere = () => {
      clearWarnings();
    };

    const timer = setTimeout(() => {
      window.addEventListener("click", handleClickAnywhere);
    }, 0);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("click", handleClickAnywhere);
    };
  }, [glowingRepoId]);

  const getProjectsWithRepo = (repoId: string): string[] => {
    return projects
      .filter((p) => p.repositories?.some((r) => r.id === repoId))
      .map((p) => p.name);
  };

  const getProjectsWithJiraProject = (jiraProjectId: string): string[] => {
    return projects
      .filter((p) =>
        p.jiraProjects?.some((jp) => jp.id === jiraProjectId) ||
        p.repositories?.some((r) => r.jiraProjects?.some((jp) => jp.id === jiraProjectId))
      )
      .map((p) => p.name);
  };

  const getProjectsLinkedToGithub = (): string[] => {
    const linked = new Set<string>();
    for (const repo of repositories) {
      for (const name of getProjectsWithRepo(repo.id)) {
        linked.add(name);
      }
    }
    return Array.from(linked);
  };

  const getProjectsLinkedToJira = (): string[] => {
    const linked = new Set<string>();
    for (const jp of jiraProjects) {
      for (const name of getProjectsWithJiraProject(jp.id)) {
        linked.add(name);
      }
    }
    return Array.from(linked);
  };

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
    setError(null);
    setSyncMessage(null);
    try {
      await syncGithubRepositories(github.id);
      await loadData();
      setSyncMessage("GitHub repositories synchronized successfully.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sync GitHub repositories");
    } finally {
      setSyncingGithub(false);
    }
  };

  const handleDisconnectGithub = async () => {
    clearWarnings();
    if (!github) return;

    const linkedProjects = getProjectsLinkedToGithub();
    if (linkedProjects.length > 0) {
      setReleaseConfirmation({
        title: "Disconnect GitHub and Release Repositories?",
        message: "Disconnecting GitHub will untrack all repositories and release them from active project(s):",
        projectNames: linkedProjects,
        confirmLabel: "Disconnect & Release",
        action: async () => {
          await disconnectGithubIntegration(github.id);
          await loadData();
          await projectContext?.reload();
        },
      });
      return;
    }

    if (!window.confirm("Are you sure you want to disconnect GitHub? Tracking will be stopped for all repositories.")) {
      return;
    }
    try {
      await disconnectGithubIntegration(github.id);
      await loadData();
      await projectContext?.reload();
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
    clearWarnings();
    if (!jira) return;

    const linkedProjects = getProjectsLinkedToJira();
    if (linkedProjects.length > 0) {
      setReleaseConfirmation({
        title: "Disconnect Jira and Release Projects?",
        message: "Disconnecting Jira will untrack all Jira projects and release them from active project(s):",
        projectNames: linkedProjects,
        confirmLabel: "Disconnect & Release",
        action: async () => {
          await disconnectJiraIntegration(jira.id);
          await loadData();
          await projectContext?.reload();
        },
      });
      return;
    }

    if (!window.confirm("Are you sure you want to disconnect Jira? Tracking will be stopped for all Jira projects.")) {
      return;
    }
    try {
      await disconnectJiraIntegration(jira.id);
      await loadData();
      await projectContext?.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to disconnect Jira");
    }
  };

  const handleSyncJira = async () => {
    if (!jira) return;
    setSyncingJira(true);
    setError(null);
    setSyncMessage(null);
    try {
      const previousLastSyncedAt = jira.lastSyncedAt;
      await syncJiraProjects(jira.id);
      const completed = await waitForJiraProjectSync(jira.id, previousLastSyncedAt);
      if (completed) {
        setJira(completed.integration);
        setJiraProjects(completed.projects);
        setSyncMessage("Jira projects synchronized successfully.");
      } else {
        await loadData();
        setSyncMessage("Jira project sync is still processing. The catalog will update on your next visit.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sync Jira projects");
    } finally {
      setSyncingJira(false);
    }
  };

  const handleToggleRepoTracking = async (repo: RepositoryResponse) => {
    clearWarnings();
    if (!repo.trackingEnabled && isRepoConfigurationNeeded(repo)) {
      setGlowingRepoId(repo.id);
      return;
    }
    if (repo.trackingEnabled) {
      const linkedProjects = getProjectsWithRepo(repo.id);
      if (linkedProjects.length > 0) {
        setReleaseConfirmation({
          title: "Release Repository from Active Projects?",
          message: `Untracking repository '${repo.name}' will release it from active project(s):`,
          projectNames: linkedProjects,
          confirmLabel: "Release & Untrack",
          action: async () => {
            const updated = await updateRepository(repo.id, { trackingEnabled: false });
            setRepositories((prev) =>
              prev.map((r) => (r.id === repo.id ? updated : r))
            );
            await projectContext?.reload();
          },
        });
        return;
      }
    }
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
    setGlowingRepoId(null);
    setSelectedRepoForSettings(null);
  };

  const handleRebuildRepoData = async (repo: RepositoryResponse) => {
    if (repo.archived || !repo.trackingEnabled || rebuildingRepositoryId) return;
    setRebuildingRepositoryId(repo.id);
    setError(null);
    setSyncMessage(null);
    try {
      await requestRepositoryBackfill(repo.id);
      setSyncMessage(`DORA rebuild queued for ${repo.fullName}.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to queue DORA data rebuild");
    } finally {
      setRebuildingRepositoryId(null);
    }
  };

  const handleToggleJiraTracking = async (project: JiraProjectResponse) => {
    clearWarnings();
    if (project.trackingEnabled) {
      const linkedProjects = getProjectsWithJiraProject(project.id);
      if (linkedProjects.length > 0) {
        setReleaseConfirmation({
          title: "Release Jira Project from Active Projects?",
          message: `Untracking Jira project '${project.projectKey}' will release it from active project(s):`,
          projectNames: linkedProjects,
          confirmLabel: "Release & Untrack",
          action: async () => {
            const updated = await updateJiraProjectTracking(project.id, false);
            setJiraProjects((prev) =>
              prev.map((p) => (p.id === project.id ? updated : p))
            );
            await projectContext?.reload();
          },
        });
        return;
      }
    }
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

  const filteredRepos = repositories
    .filter((repo) => {
      const matchesSearch =
        repo.fullName.toLowerCase().includes(search.toLowerCase()) ||
        repo.name.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        trackingFilter === "ALL" || (trackingFilter === "TRACKED" && repo.trackingEnabled);
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      const aUnavailable = a.archived || isRepoDeletedFromGithub(a, github?.lastSyncedAt);
      const bUnavailable = b.archived || isRepoDeletedFromGithub(b, github?.lastSyncedAt);

      if (aUnavailable !== bUnavailable) {
        return aUnavailable ? 1 : -1;
      }
      return a.fullName.localeCompare(b.fullName);
    });
  const tourRepositoryId = filteredRepos.find(
    (repo) => !repo.archived && !isRepoDeletedFromGithub(repo, github?.lastSyncedAt),
  )?.id;

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

        {syncMessage && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: "1rem",
              backgroundColor: "rgba(34, 197, 94, 0.1)",
              border: "1px solid rgba(34, 197, 94, 0.45)",
              borderRadius: "8px",
              color: "#4ade80",
              fontSize: "0.9rem",
            }}
          >
            {syncMessage}
          </div>
        )}

        {/* Integration Cards Grid */}
        <div id="integrations-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.5rem" }}>
          {/* GitHub Integration Card */}
          <div
            id="github-integration-card"
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
                        id="sync-github-btn"
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
            id="jira-integration-card"
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
                    <>
                      <button
                        type="button"
                        id="sync-jira-btn"
                        className="primary-button"
                        onClick={() => void handleSyncJira()}
                        disabled={syncingJira}
                        style={{ fontSize: "0.85rem", padding: "0.4rem 0.9rem" }}
                      >
                        {syncingJira ? "Syncing..." : "Sync Jira Projects"}
                      </button>
                      <button
                          type="button"
                          className="button-link"
                          onClick={handleDisconnectJira}
                          disabled={syncingJira}
                          style={{ fontSize: "0.85rem", color: "#f87171", padding: "0.4rem 0.9rem" }}
                        >
                          Disconnect
                        </button>
                    </>
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
        <section id="repository-catalog" style={{ backgroundColor: "var(--card-bg, #161622)", border: "1px solid var(--border-color, #272738)", borderRadius: "10px", padding: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
              marginBottom: "1rem",
            }}
          >
            <div style={{ flex: "1 1 280px", minWidth: 0 }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Repository Catalog</h2>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary, #94a3b8)", display: "block" }}>
                Enable tracking to calculate DORA metrics and ingest deployment workflows.
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem",
                alignItems: "center",
                justifyContent: "flex-end",
                flex: "0 1 auto",
                maxWidth: "100%",
              }}
            >
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
                  width: "180px",
                  maxWidth: "100%",
                  boxSizing: "border-box",
                }}
              />
              <div
                style={{
                  display: "inline-flex",
                  flexShrink: 0,
                  backgroundColor: "var(--input-bg, #242436)",
                  borderRadius: "6px",
                  padding: "2px",
                  border: "1px solid var(--border-color, #3b3b54)",
                  whiteSpace: "nowrap",
                }}
              >
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
                    whiteSpace: "nowrap",
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
                    whiteSpace: "nowrap",
                  }}
                >
                  Tracked Only
                </button>
              </div>
            </div>
          </div>

          {/* Quick Tip for Adding/Removing Repositories */}
          <div
            style={{
              marginBottom: "1.25rem",
              padding: "0.55rem 0.85rem",
              borderRadius: "6px",
              backgroundColor: "rgba(99, 102, 241, 0.08)",
              border: "1px solid rgba(99, 102, 241, 0.2)",
              fontSize: "0.8rem",
              color: "var(--text-secondary, #94a3b8)",
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
            }}
          >
            <strong style={{ color: "var(--primary-light, #818cf8)" }}>Tip:</strong>
            <span>
              To add or remove repositories, update access in <strong>GitHub Settings &rarr; Applications &rarr; Adept-Production</strong>, then click <strong>Configure</strong>.
            </span>
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
                  {filteredRepos.map((repo) => {
                    const isDeletedFromGithub = isRepoDeletedFromGithub(repo, github?.lastSyncedAt);
                    const isUnavailable = repo.archived || isDeletedFromGithub;
                    const isGithubActive = github?.status === "ACTIVE";

                    return (
                      <tr
                        key={repo.id}
                        style={{
                          borderBottom: "1px solid var(--border-color, #272738)",
                          transition: "background-color 0.15s ease",
                          opacity: isUnavailable ? 0.45 : 1,
                          backgroundColor: isUnavailable ? "rgba(255, 255, 255, 0.02)" : undefined,
                        }}
                      >
                        <td style={{ padding: "0.75rem 0.5rem" }}>
                          <input
                              type="checkbox"
                              id={repo.id === tourRepositoryId ? "tour-repo-tracking" : undefined}
                              checked={repo.trackingEnabled}
                              onChange={() => void handleToggleRepoTracking(repo)}
                              disabled={isPending || isUnavailable || !isGithubActive}
                              title={
                                repo.archived
                                  ? "Archived repositories cannot be tracked"
                                  : isDeletedFromGithub
                                    ? "Repository was deleted or removed on GitHub"
                                    : !isGithubActive
                                      ? "Connect or reconnect GitHub App to track repositories"
                                      : !repo.trackingEnabled && isRepoConfigurationNeeded(repo)
                                        ? "Configure in Settings before enabling tracking"
                                        : undefined
                              }
                              style={{
                                width: "1.1rem",
                                height: "1.1rem",
                                cursor: isUnavailable || !isGithubActive ? "not-allowed" : "pointer",
                              }}
                            />
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 600, color: isUnavailable ? "var(--text-secondary, #94a3b8)" : "var(--text-primary, #ffffff)" }}>
                              {repo.fullName}
                            </span>
                            {repo.archived && (
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  padding: "0.15rem 0.45rem",
                                  borderRadius: "4px",
                                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                                  color: "var(--text-secondary, #94a3b8)",
                                  fontWeight: 600,
                                }}
                              >
                                ARCHIVED
                              </span>
                            )}
                            {isDeletedFromGithub && (
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  padding: "0.15rem 0.45rem",
                                  borderRadius: "4px",
                                  backgroundColor: "rgba(239, 68, 68, 0.12)",
                                  color: "#f87171",
                                  fontWeight: 600,
                                }}
                              >
                                DELETED ON GITHUB
                              </span>
                            )}
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
                              color: isUnavailable ? "var(--text-secondary, #94a3b8)" : undefined,
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
                              fontSize: "0.75rem",
                              padding: "0.2rem 0.5rem",
                              borderRadius: "4px",
                              backgroundColor: "rgba(99, 102, 241, 0.1)",
                              color: "var(--primary-light, #818cf8)",
                            }}
                          >
                            {repo.settings?.deploymentSignal ?? "WORKFLOW_RUN"}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="button-link"
                              onClick={() => void handleRebuildRepoData(repo)}
                              disabled={isUnavailable || !repo.trackingEnabled || isRepoConfigurationNeeded(repo) || rebuildingRepositoryId !== null}
                              title={
                                repo.archived
                                  ? "Archived repositories cannot be rebuilt"
                                  : isDeletedFromGithub
                                    ? "Repository was deleted or removed on GitHub"
                                    : !repo.trackingEnabled
                                      ? "Enable tracking before rebuilding DORA data"
                                      : isRepoConfigurationNeeded(repo)
                                        ? "Configure deployment workflow/environment patterns in Settings first"
                                        : "Rebuild DORA data using saved settings"
                              }
                              style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
                            >
                              {rebuildingRepositoryId === repo.id ? "Queuing..." : "Rebuild DORA"}
                            </button>

                            <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                              {glowingRepoId === repo.id && (
                                <div
                                  role="tooltip"
                                  style={{
                                    position: "absolute",
                                    bottom: "calc(100% + 8px)",
                                    right: 0,
                                    zIndex: 20,
                                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                                    border: "1px solid #ef4444",
                                    backdropFilter: "blur(8px)",
                                    borderRadius: "6px",
                                    padding: "0.4rem 0.65rem",
                                    fontSize: "0.75rem",
                                    fontWeight: 500,
                                    color: "#fca5a5",
                                    whiteSpace: "nowrap",
                                    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.5)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.35rem",
                                  }}
                                >
                                  <span>Please configure &quot;{repo.fullName}&quot; in Settings before enabling tracking</span>
                                  {/* Tooltip downward arrow pointing to the button */}
                                  <div
                                    style={{
                                      position: "absolute",
                                      top: "100%",
                                      right: "1.2rem",
                                      width: 0,
                                      height: 0,
                                      borderLeft: "5px solid transparent",
                                      borderRight: "5px solid transparent",
                                      borderTop: "6px solid #ef4444",
                                    }}
                                  />
                                </div>
                              )}
                              <button
                                type="button"
                                id={repo.id === tourRepositoryId ? "tour-repo-settings" : undefined}
                                className="button-link"
                                onClick={() => {
                                  setGlowingRepoId(null);
                                  setSelectedRepoForSettings(repo);
                                }}
                                disabled={isUnavailable}
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "0.3rem 0.6rem",
                                  cursor: isUnavailable ? "not-allowed" : "pointer",
                                  ...(glowingRepoId === repo.id
                                    ? {
                                      boxShadow: "0 0 12px 2px rgba(239, 68, 68, 0.8)",
                                      borderColor: "#ef4444",
                                      color: "#fca5a5",
                                      fontWeight: 700,
                                      animation: "pulse 1.5s infinite",
                                    }
                                    : {}),
                                }}
                              >
                                Settings
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Jira Projects Catalog Section */}
        {jira && (
          <section id="jira-projects-catalog" style={{ backgroundColor: "var(--card-bg, #161622)", border: "1px solid var(--border-color, #272738)", borderRadius: "10px", padding: "1.5rem" }}>
            <div style={{ marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Jira Projects</h2>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary, #94a3b8)" }}>
                Enable tracking to sync incident issues and correlate deployments.
              </span>
            </div>

            {jiraProjects.length === 0 ? (
              <p style={{ color: "var(--text-secondary, #94a3b8)", fontSize: "0.9rem" }}>No Jira projects found in connected site.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
                {jiraProjects.map((proj) => {
                  const isJiraActive = jira.status === "ACTIVE";

                  return (
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
                      <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", cursor: !isJiraActive ? "not-allowed" : "pointer" }}>
                        <input
                          type="checkbox"
                          checked={proj.trackingEnabled}
                          onChange={() => void handleToggleJiraTracking(proj)}
                          disabled={!isJiraActive}
                          title={!isJiraActive ? "Connect or reconnect Jira Cloud to track projects" : undefined}
                          style={{ width: "1rem", height: "1rem", cursor: !isJiraActive ? "not-allowed" : "pointer" }}
                        />
                        <span>Track</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Modals */}
        {selectedRepoForSettings && (
          <RepositorySettingsModal
            key={selectedRepoForSettings.id}
            repository={selectedRepoForSettings}
            onClose={() => setSelectedRepoForSettings(null)}
            onSave={handleSaveRepoSettings}
          />
        )}

        {releaseConfirmation && (
          <div
            className="modal-overlay"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
              padding: "1rem",
            }}
            onClick={() => {
              if (!confirmingRelease) setReleaseConfirmation(null);
            }}
          >
            <div
              className="modal-card"
              style={{
                backgroundColor: "var(--card-bg, #1a1a24)",
                border: "1px solid var(--border-color, #2d2d3d)",
                borderRadius: "8px",
                padding: "1.5rem",
                maxWidth: "480px",
                width: "100%",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 600, margin: 0, color: "var(--text-primary, #ffffff)" }}>
                  {releaseConfirmation.title}
                </h2>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setReleaseConfirmation(null)}
                  disabled={confirmingRelease}
                  aria-label="Close"
                  style={{ background: "none", border: "none", color: "var(--text-secondary, #94a3b8)", cursor: "pointer", fontSize: "1.2rem" }}
                >
                  ✕
                </button>
              </div>

              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary, #94a3b8)", margin: "0 0 0.75rem 0", lineHeight: 1.5 }}>
                {releaseConfirmation.message}
              </p>

              <ul
                style={{
                  margin: "0 0 1.25rem 0",
                  paddingLeft: "1.25rem",
                  fontSize: "0.85rem",
                  color: "var(--text-primary, #ffffff)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                }}
              >
                {releaseConfirmation.projectNames.map((name) => (
                  <li key={name} style={{ fontWeight: 500 }}>
                    {name}
                  </li>
                ))}
              </ul>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  className="button-link"
                  onClick={() => setReleaseConfirmation(null)}
                  disabled={confirmingRelease}
                  style={{ padding: "0.5rem 1rem" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="danger-button"
                  disabled={confirmingRelease}
                  onClick={async () => {
                    setConfirmingRelease(true);
                    setError(null);
                    try {
                      await releaseConfirmation.action();
                      setReleaseConfirmation(null);
                    } catch (err: unknown) {
                      setError(err instanceof Error ? err.message : "Action failed");
                    } finally {
                      setConfirmingRelease(false);
                    }
                  }}
                  style={{ padding: "0.5rem 1.25rem" }}
                >
                  {confirmingRelease ? "Releasing..." : releaseConfirmation.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
