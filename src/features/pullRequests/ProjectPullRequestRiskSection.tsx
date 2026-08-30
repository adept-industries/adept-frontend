import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthProvider.js";
import {
  rebuildProjectPullRequestRisks,
  type ProjectPullRequestRiskItem,
  type PullRequestRiskLevel,
} from "./api.js";
import { useProjectPullRequestRisks } from "./useProjectPullRequestRisks.js";

const PAGE_SIZE = 10;

const RISK_LEVELS: Array<{ value: "" | PullRequestRiskLevel; label: string }> = [
  { value: "", label: "All risk levels" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

const FEATURE_LABELS: Record<string, string> = {
  ns: "Subsystems",
  nd: "Directories",
  nf: "Files changed",
  entropy: "Change spread",
  la: "Lines added",
  ld: "Lines deleted",
  fix: "Fix keyword",
};

function scorePercent(score: number): string {
  return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`;
}

function openedFor(openedAt: string): string {
  const elapsedMs = Math.max(0, Date.now() - new Date(openedAt).getTime());
  const hours = Math.floor(elapsedMs / (60 * 60 * 1000));
  if (hours < 1) return "Opened less than an hour ago";
  if (hours < 24) return `Open for ${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.floor(hours / 24);
  return `Open for ${days} ${days === 1 ? "day" : "days"}`;
}

function factorText(factor: Record<string, unknown>): string | null {
  const feature = typeof factor.feature === "string" ? factor.feature : null;
  const value = factor.value;
  if (!feature || (typeof value !== "number" && typeof value !== "string")) return null;
  return `${FEATURE_LABELS[feature] ?? feature}: ${String(value)}`;
}

function PullRequestRiskRow({ item }: { item: ProjectPullRequestRiskItem }) {
  const factors = item.topFactors
    .map(factorText)
    .filter((factor): factor is string => factor !== null);

  return (
    <article className="pr-risk-row">
      <div className="pr-risk-row-main">
        <div className="pr-risk-copy">
          <div className="pr-risk-title-line">
            <a
              className="pr-risk-title"
              href={item.url}
              target="_blank"
              rel="noreferrer"
            >
              {item.title}
              <span className="pr-risk-external" aria-hidden="true">↗</span>
            </a>
            {item.draft && <span className="pr-risk-neutral-badge">Draft</span>}
            {item.stalled && <span className="pr-risk-stalled-badge">Stalled</span>}
          </div>
          <p className="pr-risk-meta">
            <span>{item.repositoryFullName} #{item.number}</span>
            <span aria-hidden="true">·</span>
            <span>{openedFor(item.openedAt)}</span>
            {item.authorLogin && (
              <>
                <span aria-hidden="true">·</span>
                <span>by {item.authorLogin}</span>
              </>
            )}
          </p>
          {factors.length > 0 && (
            <p className="pr-risk-factors" aria-label="Model inputs">
              <span className="pr-risk-factors-label">Top model inputs:</span>{" "}
              {factors.join(" · ")}
            </p>
          )}
        </div>
        <div className="pr-risk-score" aria-label={`${item.riskLevel.toLowerCase()} risk, ${scorePercent(item.riskScore)}`}>
          <span className={`pr-risk-level pr-risk-level--${item.riskLevel.toLowerCase()}`}>
            {item.riskLevel.toLowerCase()}
          </span>
          <strong>{scorePercent(item.riskScore)}</strong>
        </div>
      </div>
    </article>
  );
}

interface ProjectPullRequestRiskSectionProps {
  selectedProjectId: string | null;
}

export function ProjectPullRequestRiskSection({
  selectedProjectId,
}: ProjectPullRequestRiskSectionProps) {
  const { state } = useAuth();
  const isManager = state.status === "authenticated"
    && state.currentMembership.role === "MANAGER";
  const [page, setPage] = useState(0);
  const [riskLevel, setRiskLevel] = useState<"" | PullRequestRiskLevel>("");
  const [stalledOnly, setStalledOnly] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildMessage, setRebuildMessage] = useState<string | null>(null);
  const [rebuildError, setRebuildError] = useState<string | null>(null);

  useEffect(() => {
    setPage(0);
    setRebuildMessage(null);
    setRebuildError(null);
  }, [selectedProjectId, riskLevel, stalledOnly]);

  const filters = useMemo(() => ({
    page,
    size: PAGE_SIZE,
    riskLevel: riskLevel || undefined,
    stalledOnly,
  }), [page, riskLevel, stalledOnly]);
  const query = useProjectPullRequestRisks(selectedProjectId, filters);

  const handleRebuild = async () => {
    if (!selectedProjectId || rebuilding) return;
    setRebuilding(true);
    setRebuildMessage(null);
    setRebuildError(null);
    try {
      const result = await rebuildProjectPullRequestRisks(selectedProjectId);
      const queued = result.queuedRepositories;
      const pending = result.alreadyQueuedRepositories;
      setRebuildMessage(
        queued > 0
          ? `Risk scoring queued for ${queued} ${queued === 1 ? "repository" : "repositories"}. Refresh after processing completes.`
          : pending > 0
            ? "Risk scoring is already in progress. Refresh after processing completes."
            : "There are no eligible repositories to score.",
      );
    } catch (error) {
      setRebuildError(error instanceof Error ? error.message : "Risk scoring could not be queued.");
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <section className="pr-risk-section" aria-labelledby="pr-risk-heading">
      <div className="pr-risk-section-header">
        <div>
          <h2 id="pr-risk-heading" className="dash-section-title pr-risk-heading">
            Pull request review queue
          </h2>
          <p className="pr-risk-section-description">
            Open pull requests for the selected project, prioritized by estimated review risk.
          </p>
        </div>
        {selectedProjectId && (
          <div className="pr-risk-actions">
            <button
              type="button"
              className="pr-risk-secondary-button"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              {query.isFetching && !query.isLoading ? "Refreshing…" : "Refresh"}
            </button>
            {isManager && (
              <button
                type="button"
                className="pr-risk-secondary-button"
                onClick={() => void handleRebuild()}
                disabled={rebuilding}
              >
                {rebuilding ? "Queuing…" : "Score open PRs"}
              </button>
            )}
          </div>
        )}
      </div>

      {!selectedProjectId ? (
        <div className="pr-risk-empty">
          <h3>Select a project</h3>
          <p>Choose a project to view its open pull requests.</p>
        </div>
      ) : (
        <>
          <div className="pr-risk-toolbar" aria-label="Pull request filters">
            <label className="pr-risk-select-label">
              <span>Risk</span>
              <select
                value={riskLevel}
                onChange={(event) => setRiskLevel(event.target.value as "" | PullRequestRiskLevel)}
              >
                {RISK_LEVELS.map((level) => (
                  <option key={level.value || "all"} value={level.value}>{level.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={`pr-risk-filter-button${stalledOnly ? " pr-risk-filter-button--active" : ""}`}
              aria-pressed={stalledOnly}
              onClick={() => setStalledOnly((current) => !current)}
            >
              Stalled over 48 hours
            </button>
          </div>

          {rebuildMessage && <p className="pr-risk-notice" role="status">{rebuildMessage}</p>}
          {rebuildError && <p className="pr-risk-error" role="alert">{rebuildError}</p>}

          <div className="pr-risk-panel">
            {query.isLoading ? (
              <div className="pr-risk-empty" aria-busy="true">
                <p>Loading pull requests…</p>
              </div>
            ) : query.error ? (
              <div className="pr-risk-empty" role="alert">
                <h3>Pull requests could not be loaded</h3>
                <p>{query.error instanceof Error ? query.error.message : "Please try again."}</p>
                <button type="button" onClick={() => void query.refetch()}>Retry</button>
              </div>
            ) : !query.data || query.data.items.length === 0 ? (
              <div className="pr-risk-empty">
                <h3>{riskLevel || stalledOnly ? "No matching pull requests" : "No scored open pull requests"}</h3>
                <p>
                  {riskLevel || stalledOnly
                    ? "Change the filters to view other open pull requests."
                    : isManager
                      ? "New pull requests are scored automatically. Use Score open PRs to process existing open pull requests."
                      : "New pull requests are scored automatically. A Manager can also queue existing pull requests for scoring."}
                </p>
              </div>
            ) : (
              <>
                <div className="pr-risk-list">
                  {query.data.items.map((item) => (
                    <PullRequestRiskRow key={item.pullRequestId} item={item} />
                  ))}
                </div>
                <div className="pr-risk-pagination">
                  <span>
                    {query.data.totalElements} open {query.data.totalElements === 1 ? "pull request" : "pull requests"}
                  </span>
                  <div>
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(0, current - 1))}
                      disabled={page === 0}
                    >
                      Previous
                    </button>
                    <span>Page {query.data.page + 1} of {Math.max(1, query.data.totalPages)}</span>
                    <button
                      type="button"
                      onClick={() => setPage((current) => current + 1)}
                      disabled={page + 1 >= query.data.totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
                <p className="pr-risk-disclaimer">{query.data.disclaimer}</p>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
