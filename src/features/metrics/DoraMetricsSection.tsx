import { useMemo, useState } from "react";
import { useDoraMetricsSummary, useDoraMetricsSeries } from "./useDoraMetrics.js";
import { DoraMetricCard } from "./DoraMetricCard.js";
import type { DoraMetricsFilters, MetricSeriesItemDto, MetricType } from "./types.js";

// ── Time range presets ─────────────────────────────────────────────────────

type TimeRangePreset = "7d" | "30d" | "90d";

interface Preset {
  label: string;
  value: TimeRangePreset;
  days: number;
}

const PRESETS: Preset[] = [
  { label: "Last 7 Days",  value: "7d",  days: 7  },
  { label: "Last 30 Days", value: "30d", days: 30 },
  { label: "Last 90 Days", value: "90d", days: 90 },
];

function presetToRange(preset: TimeRangePreset): { from: string; to: string } {
  const to   = new Date();
  const from = new Date(to);
  const days = PRESETS.find((p) => p.value === preset)?.days ?? 30;
  from.setDate(from.getDate() - days);
  return {
    from: from.toISOString(),
    to:   to.toISOString(),
  };
}

// ── Skeleton card ─────────────────────────────────────────────────────────

function SkeletonCard({ id }: { id: string }) {
  return (
    <div className="dora-card stat-card dora-skeleton" id={id} aria-busy="true" aria-label="Loading metric">
      <div className="dora-skel-header" />
      <div className="dora-skel-value" />
      <div className="dora-skel-label" />
      <div className="dora-skel-chart" />
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────

const IconRocket = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
);

const IconClock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconShield = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconPercent = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="19" y1="5" x2="5" y2="19" />
    <circle cx="6.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </svg>
);

// ── Helper: filter series by metric type ─────────────────────────────────

function seriesFor(items: MetricSeriesItemDto[], type: MetricType): MetricSeriesItemDto[] {
  return items.filter((s) => s.metricType === type);
}

// ── Main section ─────────────────────────────────────────────────────────

interface DoraMetricsSectionProps {
  selectedProjectId?: string | null;
  repositories?: ReadonlyArray<{
    id: string;
    fullName: string;
  }>;
}

interface RepositorySelection {
  projectId: string | null;
  repositoryId: string | null;
}

export function DoraMetricsSection({
  selectedProjectId,
  repositories = [],
}: DoraMetricsSectionProps) {
  const [preset, setPreset] = useState<TimeRangePreset>("30d");
  const [repositorySelection, setRepositorySelection] = useState<RepositorySelection>({
    projectId: selectedProjectId ?? null,
    repositoryId: null,
  });
  const range = useMemo(() => presetToRange(preset), [preset]);
  const selectedRepositoryId = repositorySelection.projectId === (selectedProjectId ?? null)
    && repositories.some((repository) => repository.id === repositorySelection.repositoryId)
      ? repositorySelection.repositoryId
      : null;

  const filters: DoraMetricsFilters = useMemo(() => ({
    projectId:  selectedProjectId ?? null,
    repositoryId: selectedRepositoryId,
    from: range.from,
    to:   range.to,
  }), [selectedProjectId, selectedRepositoryId, range]);

  const summaryQuery = useDoraMetricsSummary(filters);
  const seriesQuery = useDoraMetricsSeries({
    ...filters,
    granularity: preset === "7d" ? "DAY" : preset === "30d" ? "DAY" : "WEEK",
  });

  const { data: summary, isLoading: summaryLoading } = summaryQuery;
  const { data: seriesData, isLoading: seriesLoading } = seriesQuery;

  const isLoading = summaryLoading || seriesLoading;
  const metricsError = summaryQuery.error ?? seriesQuery.error;
  const allEmpty = !summary || (
    summary.deploymentFrequency.sampleSize === 0 &&
    summary.changeLeadTime.sampleSize === 0 &&
    summary.recoveryTime.sampleSize === 0 &&
    summary.changeFailureRate.sampleSize === 0
  );

  const items = seriesData?.series ?? [];

  return (
    <section className="dora-section" aria-label="DORA Metrics">
      {/* Section header + filter bar */}
      <div className="dora-section-header">
        <h2 className="dash-section-title" style={{ margin: 0 }}>DORA Metrics</h2>
        <div className="dora-filter-controls">
          {selectedProjectId && repositories.length > 0 && (
            <label className="dora-repository-filter">
              <span>Repository</span>
              <select
                aria-label="Repository"
                value={selectedRepositoryId ?? ""}
                onChange={(event) => setRepositorySelection({
                  projectId: selectedProjectId,
                  repositoryId: event.target.value || null,
                })}
              >
                <option value="">All repositories</option>
                {repositories.map((repository) => (
                  <option key={repository.id} value={repository.id}>
                    {repository.fullName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="dora-filter-bar" role="group" aria-label="Time range">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                id={`dora-filter-${p.value}`}
                className={`dora-filter-btn${preset === p.value ? " dora-filter-btn--active" : ""}`}
                aria-pressed={preset === p.value}
                onClick={() => setPreset(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="dash-stats-grid dora-cards-grid" role="list">
        {isLoading ? (
          <>
            <SkeletonCard id="dora-skel-1" />
            <SkeletonCard id="dora-skel-2" />
            <SkeletonCard id="dora-skel-3" />
            <SkeletonCard id="dora-skel-4" />
          </>
        ) : metricsError ? (
          <div className="dora-empty dash-empty" role="alert" style={{ gridColumn: "1 / -1" }}>
            <h3 className="dash-empty-title">DORA metrics could not be loaded</h3>
            <p className="dash-empty-desc">{metricsError instanceof Error ? metricsError.message : "Please try again."}</p>
            <button
              type="button"
              className="dora-filter-btn"
              onClick={() => void Promise.all([summaryQuery.refetch(), seriesQuery.refetch()])}
            >
              Retry
            </button>
          </div>
        ) : allEmpty || !summary ? (
          /* Empty state occupies the full 4-col row */
          <div className="dora-empty dash-empty" style={{ gridColumn: "1 / -1" }}>
            <div className="dash-empty-icon">📊</div>
            <h3 className="dash-empty-title">No deployments recorded in this period</h3>
            <p className="dash-empty-desc">
              Connect your GitHub workflow or webhook to begin tracking DORA metrics.
              Once deployments are recorded, your team&apos;s performance trends will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* 1. Deployment Frequency */}
            <div role="listitem">
              <DoraMetricCard
                cardId="dora-card-df"
                title="Deployment Frequency"
                subtitle="How often code is deployed to production"
                metric={summary.deploymentFrequency}
                series={seriesFor(items, "DEPLOYMENT_FREQUENCY")}
                icon={<IconRocket />}
              />
            </div>

            {/* 2. Change Lead Time */}
            <div role="listitem">
              <DoraMetricCard
                cardId="dora-card-clt"
                title="Change Lead Time"
                subtitle="Time from commit to production"
                metric={summary.changeLeadTime}
                series={seriesFor(items, "CHANGE_LEAD_TIME_HOURS")}
                icon={<IconClock />}
                showPercentiles
              />
            </div>

            {/* 3. Median Recovery Time */}
            <div role="listitem">
              <DoraMetricCard
                cardId="dora-card-rt"
                title="Recovery Time"
                subtitle="Median time to restore service"
                metric={summary.recoveryTime}
                series={seriesFor(items, "FAILED_DEPLOYMENT_RECOVERY_TIME_HOURS")}
                icon={<IconShield />}
              />
            </div>

            {/* 4. Change Failure Rate */}
            <div role="listitem">
              <DoraMetricCard
                cardId="dora-card-cfr"
                title="Change Failure Rate"
                subtitle="Percentage of deployments causing failures"
                metric={summary.changeFailureRate}
                series={seriesFor(items, "CHANGE_FAILURE_RATE_PERCENT")}
                icon={<IconPercent />}
                showFailureBreakdown
              />
            </div>
          </>
        )}
      </div>
      {!isLoading && !metricsError && summary && (
        <p className="dora-calculation-meta" aria-label="Metric calculation status">
          {summary.calculatedAt
            ? `Calculated ${new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: summary.timezone,
              }).format(new Date(summary.calculatedAt))} (${summary.timezone})`
            : "Metrics have not been calculated yet"}
          {summary.stale ? " · Data may be stale" : ""}
        </p>
      )}
    </section>
  );
}
