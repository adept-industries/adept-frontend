import { useCycleTime } from "./useDoraMetrics.js";
import { CycleTimeChart } from "./CycleTimeChart.js";
import { CYCLE_TIME_STAGES, formatCycleHours, stageColorVar } from "./cycleTime.js";
import type { CycleTimeFilters, CycleTimeStage } from "./types.js";

const STAGE_DESCRIPTIONS: Record<CycleTimeStage, string> = {
  CODING: "First commit to ready for review",
  PICKUP: "Ready for review to first review",
  REVIEW: "First review to merge",
  DEPLOY: "Merge to production",
};

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
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
            {data.bottleneck && (() => {
              const stage = data.stages.find((item) => item.stage === data.bottleneck);
              const label = CYCLE_TIME_STAGES.find((item) => item.stage === data.bottleneck)?.label;
              return stage && label ? (
                <p className="cycle-time-bottleneck" role="status">
                  <span className="cycle-time-dot" style={{ background: stageColorVar(stage.stage) }} aria-hidden="true" />
                  <strong>Bottleneck: {label}</strong>
                  <span>· {formatCycleHours(stage.medianHours)}</span>
                </p>
              ) : null;
            })()}

            <ul className="cycle-time-stages" aria-label="Stage medians">
              {CYCLE_TIME_STAGES.map(({ stage, label }) => {
                const value = data.stages.find((item) => item.stage === stage);
                const sampleSize = value?.sampleSize ?? 0;
                const isBottleneck = data.bottleneck === stage;
                // Pickup and review only exist once someone reviews a pull request.
                const needsReview = stage === "PICKUP" || stage === "REVIEW";
                return (
                  <li
                    key={stage}
                    className={`cycle-time-stage${isBottleneck ? " cycle-time-stage--bottleneck" : ""}`}
                    style={{ borderTopColor: stageColorVar(stage) }}
                  >
                    <span className="cycle-time-stage-label">{label}</span>
                    <span className="cycle-time-stage-value">
                      {value && sampleSize > 0 ? formatCycleHours(value.medianHours) : "—"}
                    </span>
                    <span className="cycle-time-stage-meta" title={STAGE_DESCRIPTIONS[stage]}>
                      {STAGE_DESCRIPTIONS[stage]}
                    </span>
                    <span className="cycle-time-stage-meta">
                      {sampleSize === 0 && needsReview ? "No reviewed PRs" : plural(sampleSize, "PR")}
                    </span>
                  </li>
                );
              })}
            </ul>

            {data.unreviewedPullRequestCount > 0 && (
              <p className="cycle-time-unreviewed">
                {data.unreviewedPullRequestCount} of {plural(data.pullRequestCount, "pull request")} were
                merged without a review.
              </p>
            )}

            <CycleTimeChart series={data.series} timezone={timezone} granularity={data.granularity} />

            <div className="cycle-time-legend" aria-hidden="true">
              {CYCLE_TIME_STAGES.map(({ stage, label }) => (
                <span key={stage}>
                  <span className="cycle-time-dot" style={{ background: stageColorVar(stage) }} />
                  {label}
                </span>
              ))}
            </div>

            <p className="cycle-time-footnote">
              Pull requests are grouped by merge week. Each stage is a separate median, so stages do not
              add up exactly. Bot reviews and authors reviewing their own pull requests are excluded.
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
