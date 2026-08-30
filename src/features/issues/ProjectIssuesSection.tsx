import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthProvider.js";
import {
  syncProjectIssues,
  type ProjectGithubIssue,
  type ProjectJiraIssue,
} from "./api.js";
import { useProjectGithubIssues, useProjectJiraIssues } from "./useProjectIssues.js";

const PAGE_SIZE = 10;
type IssueSource = "github" | "jira";

function relativeTime(timestamp: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(timestamp).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function GithubIssueRow({ issue }: { issue: ProjectGithubIssue }) {
  return (
    <article className="project-issue-row">
      <div className="project-issue-title-line">
        <a href={issue.url} target="_blank" rel="noreferrer" className="project-issue-title">
          {issue.title}<span className="pr-risk-external" aria-hidden="true">↗</span>
        </a>
        {issue.labels.slice(0, 3).map((label) => (
          <span key={label} className="project-issue-badge project-issue-badge--label">{label}</span>
        ))}
      </div>
      <p className="project-issue-meta">
        <span>{issue.repositoryFullName} #{issue.number}</span>
        <span aria-hidden="true">·</span>
        <span>opened {relativeTime(issue.createdAt)}</span>
        {issue.authorLogin && <><span aria-hidden="true">·</span><span>by {issue.authorLogin}</span></>}
        <span aria-hidden="true">·</span>
        <span>{issue.commentsCount} {issue.commentsCount === 1 ? "comment" : "comments"}</span>
      </p>
      {issue.assigneeLogins.length > 0 && (
        <p className="project-issue-detail">Assigned to {issue.assigneeLogins.join(", ")}</p>
      )}
    </article>
  );
}

function JiraIssueRow({ issue }: { issue: ProjectJiraIssue }) {
  return (
    <article className="project-issue-row">
      <div className="project-issue-title-line">
        <a href={issue.url} target="_blank" rel="noreferrer" className="project-issue-title">
          {issue.issueKey}: {issue.summary}<span className="pr-risk-external" aria-hidden="true">↗</span>
        </a>
        {issue.statusName && (
          <span className="project-issue-badge project-issue-badge--status">{issue.statusName}</span>
        )}
        {issue.priorityName && (
          <span className="project-issue-badge project-issue-badge--priority">{issue.priorityName}</span>
        )}
      </div>
      <p className="project-issue-meta">
        <span>{issue.jiraProjectKey} — {issue.jiraProjectName}</span>
        {issue.issueType && <><span aria-hidden="true">·</span><span>{issue.issueType}</span></>}
        <span aria-hidden="true">·</span>
        <span>updated {relativeTime(issue.updatedAt ?? issue.createdAt)}</span>
      </p>
    </article>
  );
}

interface PaginationProps {
  page: number;
  totalElements: number;
  totalPages: number;
  label: string;
  onPageChange(page: number): void;
}

function Pagination({ page, totalElements, totalPages, label, onPageChange }: PaginationProps) {
  return (
    <div className="pr-risk-pagination">
      <span>{totalElements} open {totalElements === 1 ? label : `${label}s`}</span>
      <div>
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page === 0}>
          Previous
        </button>
        <span>Page {page + 1} of {Math.max(1, totalPages)}</span>
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page + 1 >= totalPages}>
          Next
        </button>
      </div>
    </div>
  );
}

interface ProjectIssuesSectionProps {
  selectedProjectId: string | null;
}

export function ProjectIssuesSection({ selectedProjectId }: ProjectIssuesSectionProps) {
  const { state } = useAuth();
  const isManager = state.status === "authenticated" && state.currentMembership.role === "MANAGER";
  const [source, setSource] = useState<IssueSource>("github");
  const [githubPage, setGithubPage] = useState(0);
  const [jiraPage, setJiraPage] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const githubRequest = useMemo(() => ({ page: githubPage, size: PAGE_SIZE }), [githubPage]);
  const jiraRequest = useMemo(() => ({ page: jiraPage, size: PAGE_SIZE }), [jiraPage]);
  const githubQuery = useProjectGithubIssues(selectedProjectId, githubRequest);
  const jiraQuery = useProjectJiraIssues(selectedProjectId, jiraRequest);

  useEffect(() => {
    setGithubPage(0);
    setJiraPage(0);
    setSyncMessage(null);
    setSyncError(null);
  }, [selectedProjectId]);

  const refresh = () => {
    void githubQuery.refetch();
    void jiraQuery.refetch();
  };

  const synchronize = async () => {
    if (!selectedProjectId || syncing) return;
    setSyncing(true);
    setSyncMessage(null);
    setSyncError(null);
    try {
      const result = await syncProjectIssues(selectedProjectId);
      const queued = result.queuedGithubRepositories + result.queuedJiraIntegrations;
      const pending = result.alreadyQueuedGithubRepositories + result.alreadyQueuedJiraIntegrations;
      setSyncMessage(
        queued > 0
          ? `Issue synchronization queued for ${queued} ${queued === 1 ? "source" : "sources"}. Refresh after processing completes.`
          : pending > 0
            ? "Issue synchronization is already in progress. Refresh after processing completes."
            : "There are no tracked GitHub repositories or Jira projects to synchronize.",
      );
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Issue synchronization could not be queued.");
    } finally {
      setSyncing(false);
    }
  };

  const activeQuery = source === "github" ? githubQuery : jiraQuery;
  const activeData = activeQuery.data;

  return (
    <section className="project-issues-section" aria-labelledby="project-issues-heading">
      <div className="pr-risk-section-header">
        <div>
          <h2 id="project-issues-heading" className="dash-section-title pr-risk-heading">Open issues</h2>
          <p className="pr-risk-section-description">
            GitHub issues follow repository access. Jira issues belong to the selected project.
          </p>
        </div>
        {selectedProjectId && (
          <div className="pr-risk-actions">
            <button
              type="button"
              className="pr-risk-secondary-button"
              onClick={refresh}
              disabled={githubQuery.isFetching || jiraQuery.isFetching}
            >
              {(githubQuery.isFetching || jiraQuery.isFetching) && !activeQuery.isLoading ? "Refreshing…" : "Refresh"}
            </button>
            {isManager && (
              <button
                type="button"
                className="pr-risk-secondary-button"
                onClick={() => void synchronize()}
                disabled={syncing}
              >
                {syncing ? "Queuing…" : "Sync issues"}
              </button>
            )}
          </div>
        )}
      </div>

      {!selectedProjectId ? (
        <div className="pr-risk-empty project-issues-panel">
          <h3>Select a project</h3>
          <p>Choose a project to view its GitHub and Jira issues.</p>
        </div>
      ) : (
        <>
          <div className="project-issue-tabs" role="tablist" aria-label="Issue source">
            <button
              type="button"
              role="tab"
              id="github-issues-tab"
              aria-controls="project-issues-panel"
              aria-selected={source === "github"}
              className={source === "github" ? "project-issue-tab--active" : undefined}
              onClick={() => setSource("github")}
            >
              GitHub{githubQuery.data ? ` (${githubQuery.data.totalElements})` : ""}
            </button>
            <button
              type="button"
              role="tab"
              id="jira-issues-tab"
              aria-controls="project-issues-panel"
              aria-selected={source === "jira"}
              className={source === "jira" ? "project-issue-tab--active" : undefined}
              onClick={() => setSource("jira")}
            >
              Jira{jiraQuery.data ? ` (${jiraQuery.data.totalElements})` : ""}
            </button>
          </div>

          {syncMessage && <p className="pr-risk-notice" role="status">{syncMessage}</p>}
          {syncError && <p className="pr-risk-error" role="alert">{syncError}</p>}

          <div
            id="project-issues-panel"
            className="pr-risk-panel project-issues-panel"
            role="tabpanel"
            aria-labelledby={`${source}-issues-tab`}
          >
            {activeQuery.isLoading ? (
              <div className="pr-risk-empty" aria-busy="true"><p>Loading {source} issues…</p></div>
            ) : activeQuery.error ? (
              <div className="pr-risk-empty" role="alert">
                <h3>{source === "github" ? "GitHub" : "Jira"} issues could not be loaded</h3>
                <p>{activeQuery.error instanceof Error ? activeQuery.error.message : "Please try again."}</p>
                <button type="button" onClick={() => void activeQuery.refetch()}>Retry</button>
              </div>
            ) : !activeData || activeData.items.length === 0 ? (
              <div className="pr-risk-empty">
                <h3>No open {source === "github" ? "GitHub" : "Jira"} issues</h3>
                <p>
                  {isManager
                    ? "Use Sync issues to fetch the latest issues from the connected provider."
                    : "A Manager can synchronize the latest issues from the connected provider."}
                </p>
              </div>
            ) : source === "github" && githubQuery.data ? (
              <>
                <div className="pr-risk-list">
                  {githubQuery.data.items.map((issue) => <GithubIssueRow key={issue.id} issue={issue} />)}
                </div>
                <Pagination
                  page={githubQuery.data.page}
                  totalElements={githubQuery.data.totalElements}
                  totalPages={githubQuery.data.totalPages}
                  label="GitHub issue"
                  onPageChange={setGithubPage}
                />
              </>
            ) : jiraQuery.data ? (
              <>
                <div className="pr-risk-list">
                  {jiraQuery.data.items.map((issue) => <JiraIssueRow key={issue.id} issue={issue} />)}
                </div>
                <Pagination
                  page={jiraQuery.data.page}
                  totalElements={jiraQuery.data.totalElements}
                  totalPages={jiraQuery.data.totalPages}
                  label="Jira issue"
                  onPageChange={setJiraPage}
                />
              </>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
