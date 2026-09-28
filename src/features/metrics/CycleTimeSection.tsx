import { useCycleTime } from "./useDoraMetrics.js";
import { CycleTimeChart } from "./CycleTimeChart.js";
import { CYCLE_TIME_STAGES, formatCycleHours, stageColorVar } from "./cycleTime.js";
import type { CycleTimeFilters, CycleTimeStage } from "./types.js";

const BOTTLENECK_EXPLANATIONS: Record<CycleTimeStage, (duration: string) => string> = {
  CODING: (duration) => `work took a median ${duration} before pull requests were ready for review.`,
  PICKUP: (duration) => `pull requests waited a median ${duration} for their first review.`,
  REVIEW: (duration) => `review took a median ${duration} from first review to approval.`,
  MERGE: (duration) => `approved pull requests waited a median ${duration} to be merged.`,
  DEPLOY: (duration) => `merged pull requests waited a median ${duration} to reach production.`,
};

const STAGE_DESCRIPTIONS: Record<CycleTimeStage, string> = {
  CODING: "First commit to ready for review",
  PICKUP: "Ready for review to first review",
  REVIEW: "First review to approval",
  MERGE: "Approval to merge",
  DEPLOY: "Merge to production",
};

const IconReview = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="6" cy="6" r="3" />
    <circle cx="18" cy="18" r="3" />
    <path d="M6 9v12" />
    <path d="M13 6h3a2 2 0 0 1 2 2v7" />
  </svg>
);

function formatOptionalHours(hours: number | null): string {
  return hours === null ? "—" : formatCycleHours(hours);
}

interface CycleTimeSectionProps {
  filters: CycleTimeFilters;
  fallbackTimezone: string;
}

export function CycleTimeSection({ filters, fallbackTimezone }: CycleTimeSectionProps) {
  const query = useCycleTime(filters);
  const { data, isLoading, error } = query;
  const timezone = data?.timezone ?? fallbackTimezone;

  return (
    <section className="dora-section cycle-time-section" aria-label="Code review cycle time">
      <div className="dora-section-header">
        <div>
          <h2 className="dash-section-title" style={{ margin: 0 }}>Code Review Cycle Time</h2>
          <p className="cycle-time-intro">
            Median time merged pull requests spent in each stage, using the filters above.
          </p>
        </div>
      </div>

      <div className="stat-card cycle-time-card">
        {isLoading ? (
          <div className="cycle-time-skeleton dora-skeleton" aria-busy="true" aria-label="Loading cycle time">
            <div className="dora-skel-header" />
            <div className="dora-skel-value" />
            <div className="dora-skel-chart" />
          </div>
        ) : error ? (
          <div className="dash-empty cycle-time-empty" role="alert">
            <h3 className="dash-empty-title">Cycle time could not be loaded</h3>
            <p className="dash-empty-desc">{error instanceof Error ? error.message : "Please try again."}</p>
            <button type="button" className="dora-filter-btn" onClick={() => void query.refetch()}>
              Retry
            </button>
          </div>
        ) : !data || data.pullRequestCount === 0 ? (
          <div className="dash-empty cycle-time-empty">
            <h3 className="dash-empty-title">No merged pull requests in this period</h3>
            <p className="dash-empty-desc">
              Stage times appear once pull requests in the selected repositories are reviewed and merged.
            </p>
          </div>
        ) : (
          <>
            <div className="dora-card-header">
              <div className="cycle-time-heading">
                <span className="dora-card-icon-wrap"><IconReview /></span>
                <div>
                  <div className="dora-card-title">Where merged pull requests spend their time</div>
                  <div className="dora-card-subtitle">
                    {data.pullRequestCount} merged pull request{data.pullRequestCount === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
            </div>

            {data.bottleneck && (() => {
              const stage = data.stages.find((item) => item.stage === data.bottleneck);
              const label = CYCLE_TIME_STAGES.find((item) => item.stage === data.bottleneck)?.label;
              return stage && label ? (
                <p className="cycle-time-bottleneck" role="status">
                  <span className="cycle-time-dot" style={{ background: stageColorVar(stage.stage) }} aria-hidden="true" />
                  <strong>Bottleneck: {label}</strong>
                  <span>— {BOTTLENECK_EXPLANATIONS[stage.stage](formatCycleHours(stage.medianHours))}</span>
                </p>
              ) : null;
            })()}

            <ul className="cycle-time-stages" aria-label="Stage medians">
              {CYCLE_TIME_STAGES.map(({ stage, label }) => {
                const value = data.stages.find((item) => item.stage === stage);
                const isBottleneck = data.bottleneck === stage;
                return (
                  <li
                    key={stage}
                    className={`cycle-time-stage${isBottleneck ? " cycle-time-stage--bottleneck" : ""}`}
                    style={{ borderTopColor: stageColorVar(stage) }}
                  >
                    <span className="cycle-time-stage-label">{label}</span>
                    <span className="cycle-time-stage-value">
                      {value && value.sampleSize > 0 ? formatCycleHours(value.medianHours) : "—"}
                    </span>
                    <span className="cycle-time-stage-meta" title={STAGE_DESCRIPTIONS[stage]}>
                      {STAGE_DESCRIPTIONS[stage]}
                    </span>
                    <span className="cycle-time-stage-meta">
                      {value?.sampleSize ?? 0} PR{value?.sampleSize === 1 ? "" : "s"}
                    </span>
                  </li>
                );
              })}
            </ul>

            <CycleTimeChart series={data.series} timezone={timezone} granularity={data.granularity} />

            <div className="cycle-time-legend" aria-hidden="true">
              {CYCLE_TIME_STAGES.map(({ stage, label }) => (
                <span key={stage}>
                  <span className="cycle-time-dot" style={{ background: stageColorVar(stage) }} />
                  {label}
                </span>
              ))}
            </div>

            <div className="cycle-time-insights">
              <div className="cycle-time-insight">
                <h3 className="cycle-time-insight-title">Pull request size</h3>
                <table className="cycle-time-size-table">
                  <thead>
                    <tr>
                      <th scope="col">Size</th>
                      <th scope="col">PRs</th>
                      <th scope="col">Pickup</th>
                      <th scope="col">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sizeBreakdown.map((bucket) => (
                      <tr key={bucket.size}>
                        <th scope="row">{bucket.size}</th>
                        <td>{bucket.pullRequestCount}</td>
                        <td>{formatOptionalHours(bucket.pickupMedianHours)}</td>
                        <td>{formatOptionalHours(bucket.reviewMedianHours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="cycle-time-footnote">
                  Changed lines: XS ≤ 10, S ≤ 100, M ≤ 400, L ≤ 1,000, XL &gt; 1,000.
                </p>
              </div>

              <div className="cycle-time-insight">
                <h3 className="cycle-time-insight-title">Review rounds</h3>
                <div className="dora-card-value-row">
                  <span className="stat-card-value dora-card-value">
                    {data.reviewRounds.averageRounds.toFixed(1)}
                  </span>
                  <span className="dora-card-unit">changes requested per reviewed PR</span>
                </div>
                <p className="cycle-time-footnote">
                  {data.reviewRounds.pullRequestsWithChangesRequested} of {data.reviewRounds.reviewedPullRequestCount} reviewed
                  pull request{data.reviewRounds.reviewedPullRequestCount === 1 ? "" : "s"} had changes requested.
                </p>
              </div>
            </div>

            <p className="cycle-time-footnote">
              Pull requests are grouped by merge date. Each stage is a separate median, so stage values
              do not add up to a total cycle time. Bot reviews and authors replying to comments are excluded.
            </p>
          </>
        )}
      </div>
      {!isLoading && !error && data && (
        <p className="dora-calculation-meta" aria-label="Cycle time calculation status">
          {data.calculatedAt
            ? `Calculated ${new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: data.timezone,
              }).format(new Date(data.calculatedAt))} (${data.timezone})`
            : "Cycle time has not been calculated yet"}
          {data.stale ? " · Data may be stale" : ""}
        </p>
      )}
    </section>
  );
}
