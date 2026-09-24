import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthProvider.js";
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

interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedDateTimeParts(date: Date, timezone: string): ZonedDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function zonedDateKey(date: Date, timezone: string): string {
  const { year, month, day } = zonedDateTimeParts(date, timezone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function zonedDateTimeToDate(parts: ZonedDateTimeParts, milliseconds: number, timezone: string): Date {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, milliseconds);
  let timestamp = target;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = zonedDateTimeParts(new Date(timestamp), timezone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second, milliseconds);
    const adjustment = target - represented;
    if (adjustment === 0) break;
    timestamp += adjustment;
  }

  return new Date(timestamp);
}

function presetToRange(preset: TimeRangePreset, timezone: string, today: string): { from: string; to: string } {
  const to = new Date();
  const localNow = zonedDateTimeParts(to, timezone);
  const [year, month, day] = today.split("-").map(Number);
  const days = PRESETS.find((p) => p.value === preset)?.days ?? 30;
  const shiftedDate = new Date(Date.UTC(year, month - 1, day - days));
  const from = zonedDateTimeToDate({
    ...localNow,
    year: shiftedDate.getUTCFullYear(),
    month: shiftedDate.getUTCMonth() + 1,
    day: shiftedDate.getUTCDate(),
  }, to.getUTCMilliseconds(), timezone);
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

export const IconRocket = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
);

export const IconClock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export const IconShield = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export const IconPercent = () => (
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
  const { state } = useAuth();
  const workspaceTimezone = state.status === "authenticated"
    ? state.currentMembership.timezone
    : Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [preset, setPreset] = useState<TimeRangePreset>("30d");
  const [workspaceToday, setWorkspaceToday] = useState(() => zonedDateKey(new Date(), workspaceTimezone));
  const [repositorySelection, setRepositorySelection] = useState<RepositorySelection>({
    projectId: selectedProjectId ?? null,
    repositoryId: null,
  });
  useEffect(() => {
    const updateWorkspaceToday = () => {
      const nextToday = zonedDateKey(new Date(), workspaceTimezone);
      setWorkspaceToday((currentToday) => currentToday === nextToday ? currentToday : nextToday);
    };
    updateWorkspaceToday();
    const intervalId = window.setInterval(updateWorkspaceToday, 60_000);
    return () => window.clearInterval(intervalId);
  }, [workspaceTimezone]);
  const range = useMemo(
    () => presetToRange(preset, workspaceTimezone, workspaceToday),
    [preset, workspaceTimezone, workspaceToday],
  );
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
  // When tracked repositories exist (repositoryCount > 0), show the DORA cards even if 0 deployments occurred.
  // Only show the empty onboarding banner when no repositories are tracked or available.
  const hasTrackedRepositories = (summary?.repositoryCount ?? 0) > 0 || repositories.length > 0;
  const allEmpty = !summary || (!hasTrackedRepositories && (
    summary.deploymentFrequency.sampleSize === 0 &&
    summary.changeLeadTime.sampleSize === 0 &&
    summary.recoveryTime.sampleSize === 0 &&
    summary.changeFailureRate.sampleSize === 0
  ));

  const items = seriesData?.series ?? [];
  const timezone = seriesData?.timezone ?? workspaceTimezone;

  const buildDetailsLink = (metric: string) => {
    const params = new URLSearchParams();
    params.set("metric", metric);
    if (selectedProjectId) params.set("projectId", selectedProjectId);
    if (selectedRepositoryId) params.set("repositoryId", selectedRepositoryId);
    if (preset) params.set("preset", preset);
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    return `/dashboard/metrics/details?${params.toString()}`;
  };

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
            <div className="dora-cards-col">
              <SkeletonCard id="dora-skel-1" />
              <SkeletonCard id="dora-skel-3" />
            </div>
            <div className="dora-cards-col">
              <SkeletonCard id="dora-skel-2" />
              <SkeletonCard id="dora-skel-4" />
            </div>
          </>
        ) : metricsError ? (
          <div className="dora-empty dash-empty" role="alert" style={{ width: "100%" }}>
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
          /* Empty state occupies the full width */
          <div className="dora-empty dash-empty" style={{ width: "100%" }}>
            <h3 className="dash-empty-title">No deployments recorded in this period</h3>
            <p className="dash-empty-desc">
              Connect your GitHub workflow or webhook to begin tracking DORA metrics.
              Once deployments are recorded, your team&apos;s performance trends will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Column 1: Deployment Frequency & Recovery Time */}
            <div className="dora-cards-col">
              <div role="listitem">
                <DoraMetricCard
                  cardId="dora-card-df"
                  title="Deployment Frequency"
                  subtitle="How often code is deployed to production"
                  metric={summary.deploymentFrequency}
                  series={seriesFor(items, "DEPLOYMENT_FREQUENCY")}
                  icon={<IconRocket />}
                  preset={preset}
                  timezone={timezone}
                  detailsLink={buildDetailsLink("DEPLOYMENT_FREQUENCY")}
                />
              </div>
              <div role="listitem">
                <DoraMetricCard
                  cardId="dora-card-rt"
                  title="Recovery Time"
                  subtitle="Median time to restore service"
                  metric={summary.recoveryTime}
                  series={seriesFor(items, "FAILED_DEPLOYMENT_RECOVERY_TIME_HOURS")}
                  icon={<IconShield />}
                  preset={preset}
                  timezone={timezone}
                  detailsLink={buildDetailsLink("FAILED_DEPLOYMENT_RECOVERY_TIME_HOURS")}
                />
              </div>
            </div>

            {/* Column 2: Change Lead Time & Change Failure Rate */}
            <div className="dora-cards-col">
              <div role="listitem">
                <DoraMetricCard
                  cardId="dora-card-clt"
                  title="Change Lead Time"
                  subtitle="Time from commit to production"
                  metric={summary.changeLeadTime}
                  series={seriesFor(items, "CHANGE_LEAD_TIME_HOURS")}
                  icon={<IconClock />}
                  showPercentiles
                  preset={preset}
                  timezone={timezone}
                  detailsLink={buildDetailsLink("CHANGE_LEAD_TIME_HOURS")}
                />
              </div>
              <div role="listitem">
                <DoraMetricCard
                  cardId="dora-card-cfr"
                  title="Change Failure Rate"
                  subtitle="Percentage of deployments causing failures"
                  metric={summary.changeFailureRate}
                  series={seriesFor(items, "CHANGE_FAILURE_RATE_PERCENT")}
                  icon={<IconPercent />}
                  showFailureBreakdown
                  preset={preset}
                  timezone={timezone}
                  detailsLink={buildDetailsLink("CHANGE_FAILURE_RATE_PERCENT")}
                />
              </div>
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
