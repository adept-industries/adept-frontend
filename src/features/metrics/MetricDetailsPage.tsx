import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useAuth } from "../../auth/AuthProvider.js";
import { AppShell } from "../../components/layout/AppShell.js";
import { useContext } from "react";
import { ProjectContext } from "../projects/ProjectContext.js";
import {
  useChangeFailureRateDetails,
  useChangeLeadTimeDetails,
  useDeploymentFrequencyDetails,
  useDoraMetricsSeries,
  useDoraMetricsSummary,
  useRecoveryTimeDetails,
} from "./useDoraMetrics.js";
import { DoraMetricChart } from "./DoraMetricChart.js";
import type {
  ChangeFailureRateDetailDto,
  ChangeFailureRateDetailsResponse,
  ChangeLeadTimeDetailDto,
  DeploymentFrequencyDetailDto,
  DeploymentStatus,
  DoraMetricsFilters,
  IncidentSeverity,
  IncidentSource,
  MetricRating,
  RecoveryDeploymentRefDto,
  RecoveryTimeDetailDto,
} from "./types.js";

const RATING_CLASS: Record<MetricRating, string> = {
  ELITE: "dora-badge--elite",
  HIGH: "dora-badge--high",
  MEDIUM: "dora-badge--medium",
  LOW: "dora-badge--low",
  UNKNOWN: "dora-badge--unknown",
};

const RATING_LABEL: Record<MetricRating, string> = {
  ELITE: "Elite",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  UNKNOWN: "Unknown",
};

const RATING_COLOR: Record<MetricRating, string> = {
  ELITE: "#10b981",
  HIGH: "#818cf8",
  MEDIUM: "#f59e0b",
  LOW: "#f87171",
  UNKNOWN: "#737373",
};

function formatMetricValue(value: number, unit: string, sampleSize?: number): string {
  if (sampleSize === 0 && !unit.startsWith("deployments")) return "—";
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit.startsWith("deployments")) return `${value % 1 === 0 ? value : value.toFixed(1)}`;
  return `${value % 1 === 0 ? value : value.toFixed(1)}h`;
}

type MetricTypeKey =
  | "DEPLOYMENT_FREQUENCY"
  | "CHANGE_LEAD_TIME_HOURS"
  | "FAILED_DEPLOYMENT_RECOVERY_TIME_HOURS"
  | "CHANGE_FAILURE_RATE_PERCENT";

interface MetricTabConfig {
  key: MetricTypeKey;
  label: string;
  title: string;
}

const METRIC_TABS: MetricTabConfig[] = [
  {
    key: "DEPLOYMENT_FREQUENCY",
    label: "Deployment Frequency",
    title: "Deployment Frequency Details",
  },
  {
    key: "CHANGE_LEAD_TIME_HOURS",
    label: "Change Lead Time",
    title: "Change Lead Time Details",
  },
  {
    key: "FAILED_DEPLOYMENT_RECOVERY_TIME_HOURS",
    label: "Recovery Time",
    title: "Recovery Time Details",
  },
  {
    key: "CHANGE_FAILURE_RATE_PERCENT",
    label: "Change Failure Rate",
    title: "Change Failure Rate Details",
  },
];

type TimeRangePreset = "7d" | "30d" | "90d";

const PRESETS: Array<{ label: string; value: TimeRangePreset; days: number }> = [
  { label: "Last 7 Days", value: "7d", days: 7 },
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
  const from = zonedDateTimeToDate(
    {
      ...localNow,
      year: shiftedDate.getUTCFullYear(),
      month: shiftedDate.getUTCMonth() + 1,
      day: shiftedDate.getUTCDate(),
    },
    to.getUTCMilliseconds(),
    timezone,
  );
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const remSecs = seconds % 60;
  if (mins < 60) return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

function formatTimestamp(isoString: string, timezone: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return isoString;
  }
}

function formatSource(source: DeploymentFrequencyDetailDto["source"]): string {
  switch (source) {
    case "GITHUB_DEPLOYMENT":
      return "GitHub Deployment";
    case "GITHUB_WORKFLOW":
      return "GitHub Workflow";
    case "MANUAL":
      return "Manual";
    default:
      return source;
  }
}

const INCIDENT_SOURCE_LABEL: Record<IncidentSource, string> = {
  GITHUB: "GitHub",
  JIRA: "Jira",
  MANUAL: "Manual",
};

const SEVERITY_CLASS: Record<IncidentSeverity, string> = {
  SEV1: "metric-severity-badge--sev1",
  SEV2: "metric-severity-badge--sev2",
  SEV3: "metric-severity-badge--sev3",
  SEV4: "metric-severity-badge--sev4",
  UNKNOWN: "metric-severity-badge--unknown",
};

const DEPLOYMENT_STATUS_CLASS: Record<DeploymentStatus, string> = {
  SUCCESS: "metric-status-badge--success",
  FAILURE: "metric-status-badge--failure",
  CANCELLED: "metric-status-badge--cancelled",
  QUEUED: "metric-status-badge--pending",
  IN_PROGRESS: "metric-status-badge--pending",
};

function formatDeploymentStatus(status: DeploymentStatus): string {
  return status === "IN_PROGRESS" ? "IN PROGRESS" : status;
}

function formatFailureBreakdown(data: ChangeFailureRateDetailsResponse): string {
  const noun = data.totalDeployments === 1 ? "deployment" : "deployments";
  return `Showing ${data.totalDeployments} total production ${noun} `
    + `(${data.failedDeployments} failed = ${data.failureRatePercent.toFixed(1)}% failure rate)`;
}

function FailureReason({ item }: { item: ChangeFailureRateDetailDto }) {
  if (!item.isFailure) return null;
  const reasons = [
    item.status === "FAILURE" ? "deployment failed" : null,
    item.incident ? "linked incident" : null,
  ].filter(Boolean);
  return <span className="metric-failure-reason">{reasons.join(" + ")}</span>;
}

function DeploymentShaChip({
  deployment,
  repositoryFullName,
  label,
}: {
  deployment: RecoveryDeploymentRefDto | null;
  repositoryFullName: string | null;
  label: string;
}) {
  if (!deployment || !deployment.commitSha) {
    return <span className="metric-details-muted" title={`No ${label} deployment correlated`}>&mdash;</span>;
  }
  const shortSha = deployment.commitSha.slice(0, 7);
  const title = [
    `${label} deployment ${deployment.commitSha}`,
    deployment.environment ? `in ${deployment.environment}` : null,
  ].filter(Boolean).join(" ");

  if (!repositoryFullName) {
    return <code className="metric-commit-sha" title={title}>{shortSha}</code>;
  }
  return (
    <a
      href={`https://github.com/${repositoryFullName}/commit/${deployment.commitSha}`}
      target="_blank"
      rel="noopener noreferrer"
      className="metric-commit-link"
      title={`${title} — view on GitHub`}
    >
      <code>{shortSha}</code>
      <span className="metric-commit-arrow" aria-hidden="true">{"↗"}</span>
    </a>
  );
}

export function MetricDetailsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { state } = useAuth();
  const projectContext = useContext(ProjectContext);
  const projects = projectContext?.projects ?? [];

  const workspaceTimezone =
    state.status === "authenticated"
      ? state.currentMembership.timezone
      : Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Selected metric tab
  const metricParam = searchParams.get("metric") as MetricTypeKey | null;
  const activeMetric: MetricTypeKey =
    metricParam && METRIC_TABS.some((t) => t.key === metricParam)
      ? metricParam
      : "DEPLOYMENT_FREQUENCY";

  // Scope filters
  const projectIdParam = searchParams.get("projectId") || null;
  const repositoryIdParam = searchParams.get("repositoryId") || null;
  const presetParam = searchParams.get("preset") as TimeRangePreset | null;
  const activePreset: TimeRangePreset =
    presetParam === "7d" || presetParam === "90d" ? presetParam : "30d";

  const [workspaceToday, setWorkspaceToday] = useState(() =>
    zonedDateKey(new Date(), workspaceTimezone),
  );

  useEffect(() => {
    const updateWorkspaceToday = () => {
      const nextToday = zonedDateKey(new Date(), workspaceTimezone);
      setWorkspaceToday((currentToday) => (currentToday === nextToday ? currentToday : nextToday));
    };
    updateWorkspaceToday();
    const intervalId = window.setInterval(updateWorkspaceToday, 60_000);
    return () => window.clearInterval(intervalId);
  }, [workspaceTimezone]);

  const range = useMemo(() => {
    const customFrom = searchParams.get("from");
    const customTo = searchParams.get("to");
    if (customFrom && customTo) {
      return { from: customFrom, to: customTo };
    }
    return presetToRange(activePreset, workspaceTimezone, workspaceToday);
  }, [activePreset, searchParams, workspaceTimezone, workspaceToday]);

  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get("page") || "0", 10);
    return Number.isNaN(p) || p < 0 ? 0 : p;
  });

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectIdParam) || null,
    [projects, projectIdParam],
  );

  const availableRepositories = useMemo(
    () =>
      selectedProject?.repositories.filter(
        (r) => r.trackingEnabled && !r.archived,
      ) ?? [],
    [selectedProject],
  );

  const activeTabConfig = METRIC_TABS.find((t) => t.key === activeMetric)!;

  const summaryFilters: DoraMetricsFilters = useMemo(
    () => ({
      projectId: projectIdParam,
      repositoryId: repositoryIdParam,
      from: range.from,
      to: range.to,
    }),
    [projectIdParam, repositoryIdParam, range.from, range.to],
  );

  const summaryQuery = useDoraMetricsSummary(summaryFilters);
  const seriesQuery = useDoraMetricsSeries({
    ...summaryFilters,
    granularity: activePreset === "7d" || activePreset === "30d" ? "DAY" : "WEEK",
  });

  const activeSummaryMetric = useMemo(() => {
    if (!summaryQuery.data) return null;
    switch (activeMetric) {
      case "DEPLOYMENT_FREQUENCY":
        return summaryQuery.data.deploymentFrequency;
      case "CHANGE_LEAD_TIME_HOURS":
        return summaryQuery.data.changeLeadTime;
      case "FAILED_DEPLOYMENT_RECOVERY_TIME_HOURS":
        return summaryQuery.data.recoveryTime;
      case "CHANGE_FAILURE_RATE_PERCENT":
        return summaryQuery.data.changeFailureRate;
      default:
        return null;
    }
  }, [summaryQuery.data, activeMetric]);

  const activeSeries = useMemo(() => {
    const allItems = seriesQuery.data?.series ?? [];
    return allItems.filter((s) => s.metricType === activeMetric);
  }, [seriesQuery.data?.series, activeMetric]);

  const activeRating = activeSummaryMetric?.rating ?? "UNKNOWN";
  const chartColor = RATING_COLOR[activeRating] ?? "#818cf8";

  // Fetch deployment frequency details when active
  const deploymentFrequencyQuery = useDeploymentFrequencyDetails(
    activeMetric === "DEPLOYMENT_FREQUENCY"
      ? {
          projectId: projectIdParam,
          repositoryId: repositoryIdParam,
          from: range.from,
          to: range.to,
          page,
          size: 20,
        }
      : { projectId: null, repositoryId: null },
  );

  // Fetch change lead time details when active
  const changeLeadTimeQuery = useChangeLeadTimeDetails(
    activeMetric === "CHANGE_LEAD_TIME_HOURS"
      ? {
          projectId: projectIdParam,
          repositoryId: repositoryIdParam,
          from: range.from,
          to: range.to,
          page,
          size: 20,
        }
      : { projectId: null, repositoryId: null },
  );

  // Fetch recovery time details when active
  const recoveryTimeQuery = useRecoveryTimeDetails(
    activeMetric === "FAILED_DEPLOYMENT_RECOVERY_TIME_HOURS"
      ? {
          projectId: projectIdParam,
          repositoryId: repositoryIdParam,
          from: range.from,
          to: range.to,
          page,
          size: 20,
        }
      : { projectId: null, repositoryId: null },
  );

  // Fetch change failure rate details when active
  const changeFailureRateQuery = useChangeFailureRateDetails(
    activeMetric === "CHANGE_FAILURE_RATE_PERCENT"
      ? {
          projectId: projectIdParam,
          repositoryId: repositoryIdParam,
          from: range.from,
          to: range.to,
          page,
          size: 20,
        }
      : { projectId: null, repositoryId: null },
  );

  const handleTabChange = (key: MetricTypeKey) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("metric", key);
    newParams.delete("page");
    setPage(0);
    setSearchParams(newParams);
  };

  const handleDownloadPdf = () => {
    const presetLabel = PRESETS.find((p) => p.value === activePreset)?.label ?? activePreset;
    const originalTitle = document.title;
    document.title = `${activeTabConfig.label} – ${presetLabel} – Adept DORA Metrics`;
    window.print();
    document.title = originalTitle;
  };

  const handlePresetChange = (p: TimeRangePreset) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("preset", p);
    newParams.delete("from");
    newParams.delete("to");
    newParams.delete("page");
    setPage(0);
    setSearchParams(newParams);
  };

  const handleRepositoryChange = (repoId: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (repoId) {
      newParams.set("repositoryId", repoId);
    } else {
      newParams.delete("repositoryId");
    }
    newParams.delete("page");
    setPage(0);
    setSearchParams(newParams);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", String(newPage));
    setSearchParams(newParams);
  };

  return (
    <AppShell>
      <div className="metric-details-container">
        {/* Navigation link back to dashboard */}
        <Link to="/dashboard" className="metric-details-back-link">
          &larr; Back to Dashboard
        </Link>

        {/* Header */}
        <div className="metric-details-header">
          <div className="metric-details-header-left">
            <p className="metric-details-eyebrow">DORA Metric Drill-Down</p>
            <h1 className="metric-details-title">{activeTabConfig.title}</h1>
          </div>
          <button
            id="metric-details-download-pdf"
            type="button"
            className="metric-pdf-download-btn"
            onClick={handleDownloadPdf}
            aria-label={`Download ${activeTabConfig.label} report as PDF`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download as PDF
          </button>
        </div>

        {/* Metric Selector Tabs */}
        <div className="metric-details-tabs" role="tablist" aria-label="Metric Type">
          {METRIC_TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              type="button"
              aria-selected={activeMetric === tab.key}
              className={`metric-tab-button ${
                activeMetric === tab.key ? "metric-tab-button--active" : ""
              }`}
              onClick={() => handleTabChange(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scope and Filter Controls Bar */}
        <div className="metric-details-controls-bar">
          <div className="metric-details-scope-info">
            <span>Scope:</span>
            {selectedProject ? (
              <span className="metric-details-scope-pill">
                <strong>Project:</strong> {selectedProject.name}
              </span>
            ) : (
              <span className="metric-details-scope-pill">All accessible projects</span>
            )}

            {availableRepositories.length > 0 && (
              <label className="metric-details-repo-filter">
                <span>Repository:</span>
                <select
                  aria-label="Repository filter"
                  value={repositoryIdParam ?? ""}
                  onChange={(e) => handleRepositoryChange(e.target.value || null)}
                >
                  <option value="">All repositories</option>
                  {availableRepositories.map((repo) => (
                    <option key={repo.id} value={repo.id}>
                      {repo.fullName}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <span className="metric-details-scope-pill">
              <strong>Timezone:</strong> {workspaceTimezone}
            </span>
          </div>

          {/* Time range preset tabs */}
          <div className="dora-filter-bar" role="group" aria-label="Time range">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                id={`metric-details-preset-${p.value}`}
                role="button"
                type="button"
                aria-pressed={activePreset === p.value}
                className={`dora-filter-btn${activePreset === p.value ? " dora-filter-btn--active" : ""}`}
                onClick={() => handlePresetChange(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hidden print-only metadata block rendered at the top of the PDF */}
        <div className="metric-pdf-meta" aria-hidden="true" hidden>
          <div className="metric-pdf-meta-row">
            <span>
              <strong>Date Range:</strong>{" "}
              {PRESETS.find((p) => p.value === activePreset)?.label ?? activePreset}
              {" "}({new Date(range.from).toLocaleDateString(undefined, { dateStyle: "medium" })}
              {" – "}
              {new Date(range.to).toLocaleDateString(undefined, { dateStyle: "medium" })})
            </span>
            <span>
              <strong>Scope:</strong>{" "}
              {selectedProject ? selectedProject.name : "All accessible projects"}
            </span>
            <span>
              <strong>Timezone:</strong> {workspaceTimezone}
            </span>
            {activeSummaryMetric && (
              <span>
                <strong>Period value:</strong>{" "}
                {formatMetricValue(activeSummaryMetric.value, activeSummaryMetric.unit, activeSummaryMetric.sampleSize)}
                {" "}({activeSummaryMetric.unit}) · {activeSummaryMetric.sampleSize} sample{activeSummaryMetric.sampleSize !== 1 ? "s" : ""}
                {" "}· Rating: {activeSummaryMetric.rating}
              </span>
            )}
          </div>
          <div className="metric-pdf-meta-generated">
            Generated: {new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short" }).format(new Date())}
          </div>
        </div>

        {/* Metric Trend Chart Panel */}
        <div className="metric-details-chart-panel">
          <div className="metric-details-chart-header">
            <div className="metric-details-chart-header-left">
              <span className="metric-details-chart-title">
                {activeTabConfig.label} Trend
              </span>
              {activeSummaryMetric && (
                <span className={`dora-badge ${RATING_CLASS[activeSummaryMetric.rating]}`}>
                  {RATING_LABEL[activeSummaryMetric.rating]}
                </span>
              )}
            </div>

            {activeSummaryMetric && (
              <div className="metric-details-chart-stat">
                <span className="metric-details-stat-value">
                  {formatMetricValue(
                    activeSummaryMetric.value,
                    activeSummaryMetric.unit,
                    activeSummaryMetric.sampleSize,
                  )}
                </span>
                <span className="metric-details-stat-unit">{activeSummaryMetric.unit}</span>
                <span className="metric-details-stat-sample">
                  &bull; {activeSummaryMetric.sampleSize} sample{activeSummaryMetric.sampleSize !== 1 ? "s" : ""} in range
                </span>
              </div>
            )}
          </div>

          <div className="metric-details-chart-canvas">
            {seriesQuery.isLoading ? (
              <div className="dora-chart-empty" aria-busy="true">
                <span>Loading chart data&hellip;</span>
              </div>
            ) : (
              <DoraMetricChart
                series={activeSeries}
                color={chartColor}
                label={`${activeTabConfig.label} Trend`}
                preset={activePreset}
                timezone={seriesQuery.data?.timezone ?? workspaceTimezone}
                unit={activeSummaryMetric?.unit}
                variant="details"
              />
            )}
          </div>
        </div>

        {/* Metric Content */}
        {activeMetric === "DEPLOYMENT_FREQUENCY" ? (
          <div className="metric-details-table-panel">
            {deploymentFrequencyQuery.isLoading ? (
              <div className="metric-details-empty" aria-busy="true">
                <p>Loading deployment events&hellip;</p>
              </div>
            ) : deploymentFrequencyQuery.error ? (
              <div className="metric-details-empty" role="alert">
                <h3>Deployment events could not be loaded</h3>
                <p>
                  {deploymentFrequencyQuery.error instanceof Error
                    ? deploymentFrequencyQuery.error.message
                    : "Please try again."}
                </p>
                <button
                  type="button"
                  className="dora-filter-btn"
                  onClick={() => void deploymentFrequencyQuery.refetch()}
                >
                  Retry
                </button>
              </div>
            ) : !deploymentFrequencyQuery.data ||
              deploymentFrequencyQuery.data.items.length === 0 ? (
              <div className="metric-details-empty">
                <h3>No successful production deployments</h3>
                <p>
                  There are no successful production deployments recorded in this time range for
                  the selected repository scope.
                </p>
              </div>
            ) : (
              <>
                <table
                  className="metric-details-table"
                  aria-label="Successful production deployments"
                >
                  <thead>
                    <tr>
                      <th scope="col">Deployed Time</th>
                      <th scope="col">Repository</th>
                      <th scope="col">Environment</th>
                      <th scope="col">Source</th>
                      <th scope="col">Commit SHA</th>
                      <th scope="col">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deploymentFrequencyQuery.data.items.map((item) => (
                      <tr key={item.id}>
                        <td>{formatTimestamp(item.deployedAt, workspaceTimezone)}</td>
                        <td>
                          <strong>{item.repositoryFullName}</strong>
                        </td>
                        <td>
                          <span className="metric-env-badge">{item.environment}</span>
                        </td>
                        <td>
                          <span className="metric-source-badge">{formatSource(item.source)}</span>
                        </td>
                        <td>
                          {item.commitSha ? (
                            <a
                              href={`https://github.com/${item.repositoryFullName}/commit/${item.commitSha}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="metric-commit-link"
                              title={`View commit ${item.commitSha} on GitHub`}
                            >
                              <code>
                                {item.commitSha.length > 7
                                  ? item.commitSha.slice(0, 7)
                                  : item.commitSha}
                              </code>
                              <span className="metric-commit-arrow" aria-hidden="true">{"↗"}</span>
                            </a>
                          ) : (
                            <span className="metric-details-muted">&mdash;</span>
                          )}
                        </td>
                        <td>{formatDuration(item.durationSeconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                <div className="metric-details-pagination">
                  <span>
                    Showing{" "}
                    {deploymentFrequencyQuery.data.totalElements === 0
                      ? 0
                      : deploymentFrequencyQuery.data.page * deploymentFrequencyQuery.data.size + 1}
                    –
                    {Math.min(
                      (deploymentFrequencyQuery.data.page + 1) *
                        deploymentFrequencyQuery.data.size,
                      deploymentFrequencyQuery.data.totalElements,
                    )}{" "}
                    of {deploymentFrequencyQuery.data.totalElements} deployments
                  </span>

                  <div className="metric-details-pagination-buttons">
                    <button
                      type="button"
                      className="metric-pagination-btn"
                      onClick={() => handlePageChange(Math.max(0, page - 1))}
                      disabled={page === 0}
                    >
                      Previous
                    </button>
                    <span>
                      Page {deploymentFrequencyQuery.data.page + 1} of{" "}
                      {Math.max(1, deploymentFrequencyQuery.data.totalPages)}
                    </span>
                    <button
                      type="button"
                      className="metric-pagination-btn"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page + 1 >= deploymentFrequencyQuery.data.totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : activeMetric === "CHANGE_LEAD_TIME_HOURS" ? (
          <div className="metric-details-table-panel">
            {changeLeadTimeQuery.isLoading ? (
              <div className="metric-details-empty" aria-busy="true">
                <p>Loading pull request events&hellip;</p>
              </div>
            ) : changeLeadTimeQuery.error ? (
              <div className="metric-details-empty" role="alert">
                <h3>Pull request events could not be loaded</h3>
                <p>
                  {changeLeadTimeQuery.error instanceof Error
                    ? changeLeadTimeQuery.error.message
                    : "Please try again."}
                </p>
                <button
                  type="button"
                  className="dora-filter-btn"
                  onClick={() => void changeLeadTimeQuery.refetch()}
                >
                  Retry
                </button>
              </div>
            ) : !changeLeadTimeQuery.data ||
              changeLeadTimeQuery.data.items.length === 0 ? (
              <div className="metric-details-empty">
                <h3>No change lead time events</h3>
                <p>
                  There are no merged pull requests with a successful production deployment
                  recorded in this time range for the selected repository scope.
                </p>
              </div>
            ) : (
              <>
                <table
                  className="metric-details-table"
                  aria-label="Change lead time pull request events"
                >
                  <thead>
                    <tr>
                      <th scope="col">Pull Request</th>
                      <th scope="col">Repository</th>
                      <th scope="col">Author</th>
                      <th scope="col">First Commit</th>
                      <th scope="col">Merged</th>
                      <th scope="col">Deployed</th>
                      <th scope="col">Lead Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changeLeadTimeQuery.data.items.map((item: ChangeLeadTimeDetailDto) => (
                      <tr key={item.prId}>
                        <td>
                          {item.prUrl ? (
                            <a
                              href={item.prUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="metric-commit-link"
                              title={`Open PR #${item.prNumber} on GitHub`}
                            >
                              <strong>#{item.prNumber}</strong>
                              {" "}– {item.prTitle}
                              <span className="metric-commit-arrow" aria-hidden="true">{"↗"}</span>
                            </a>
                          ) : (
                            <span><strong>#{item.prNumber}</strong> – {item.prTitle}</span>
                          )}
                        </td>
                        <td><strong>{item.repositoryFullName}</strong></td>
                        <td>{item.authorLogin ?? <span className="metric-details-muted">&mdash;</span>}</td>
                        <td>
                          {item.firstCommitAt
                            ? formatTimestamp(item.firstCommitAt, workspaceTimezone)
                            : <span className="metric-details-muted">&mdash;</span>}
                        </td>
                        <td>
                          {item.mergedAt
                            ? formatTimestamp(item.mergedAt, workspaceTimezone)
                            : <span className="metric-details-muted">&mdash;</span>}
                        </td>
                        <td>{formatTimestamp(item.deployedAt, workspaceTimezone)}</td>
                        <td>
                          <span
                            className="metric-lead-time-cell"
                            title={[
                              item.codingTimeSeconds != null ? `Coding: ${formatDuration(item.codingTimeSeconds)}` : null,
                              item.reviewTimeSeconds != null ? `Review: ${formatDuration(item.reviewTimeSeconds)}` : null,
                              item.deployTimeSeconds != null ? `Deploy: ${formatDuration(item.deployTimeSeconds)}` : null,
                            ].filter(Boolean).join(" · ") || undefined}
                          >
                            {item.leadTimeSeconds != null
                              ? formatDuration(item.leadTimeSeconds)
                              : <span className="metric-details-muted">&mdash;</span>}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                <div className="metric-details-pagination">
                  <span>
                    Showing{" "}
                    {changeLeadTimeQuery.data.totalElements === 0
                      ? 0
                      : changeLeadTimeQuery.data.page * changeLeadTimeQuery.data.size + 1}
                    –
                    {Math.min(
                      (changeLeadTimeQuery.data.page + 1) * changeLeadTimeQuery.data.size,
                      changeLeadTimeQuery.data.totalElements,
                    )}{" "}
                    of {changeLeadTimeQuery.data.totalElements} pull requests
                  </span>

                  <div className="metric-details-pagination-buttons">
                    <button
                      type="button"
                      className="metric-pagination-btn"
                      onClick={() => handlePageChange(Math.max(0, page - 1))}
                      disabled={page === 0}
                    >
                      Previous
                    </button>
                    <span>
                      Page {changeLeadTimeQuery.data.page + 1} of{" "}
                      {Math.max(1, changeLeadTimeQuery.data.totalPages)}
                    </span>
                    <button
                      type="button"
                      className="metric-pagination-btn"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page + 1 >= changeLeadTimeQuery.data.totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : activeMetric === "FAILED_DEPLOYMENT_RECOVERY_TIME_HOURS" ? (
          <>
            <div className="metric-details-notice" role="note">
              <strong>Only resolved incidents are counted.</strong>{" "}
              Recovery time includes incidents whose resolution falls inside this window. When a
              recovery deployment is linked, its finish time is used as the resolution time.
              Open incidents are excluded and tracked under{" "}
              <Link to="/dashboard/alerts">Alerts</Link>.
            </div>
            <div className="metric-details-table-panel">
              {recoveryTimeQuery.isLoading ? (
                <div className="metric-details-empty" aria-busy="true">
                  <p>Loading resolved incidents&hellip;</p>
                </div>
              ) : recoveryTimeQuery.error ? (
                <div className="metric-details-empty" role="alert">
                  <h3>Resolved incidents could not be loaded</h3>
                  <p>
                    {recoveryTimeQuery.error instanceof Error
                      ? recoveryTimeQuery.error.message
                      : "Please try again."}
                  </p>
                  <button
                    type="button"
                    className="dora-filter-btn"
                    onClick={() => void recoveryTimeQuery.refetch()}
                  >
                    Retry
                  </button>
                </div>
              ) : !recoveryTimeQuery.data ||
                recoveryTimeQuery.data.items.length === 0 ? (
                <div className="metric-details-empty">
                  <h3>No resolved incidents</h3>
                  <p>
                    No incidents were resolved in this time range for the selected repository
                    scope.
                  </p>
                </div>
              ) : (
                <>
                  <table
                    className="metric-details-table"
                    aria-label="Resolved incidents contributing to recovery time"
                  >
                    <thead>
                      <tr>
                        <th scope="col">Incident</th>
                        <th scope="col">Repository</th>
                        <th scope="col">Severity</th>
                        <th scope="col">Detected</th>
                        <th scope="col">Resolved</th>
                        <th scope="col">Recovery Time</th>
                        <th scope="col">Failed Deployment</th>
                        <th scope="col">Recovery Deployment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recoveryTimeQuery.data.items.map((item: RecoveryTimeDetailDto) => (
                        <tr key={item.incidentId}>
                          <td>
                            <div className="metric-incident-cell">
                              <span className="metric-incident-title">{item.title}</span>
                              <span className="metric-source-badge">
                                {INCIDENT_SOURCE_LABEL[item.source] ?? item.source}
                              </span>
                            </div>
                          </td>
                          <td><strong>{item.repositoryFullName ?? item.repositoryName}</strong></td>
                          <td>
                            <span className={`metric-severity-badge ${SEVERITY_CLASS[item.severity] ?? SEVERITY_CLASS.UNKNOWN}`}>
                              {item.severity === "UNKNOWN" ? "Unknown" : item.severity}
                            </span>
                          </td>
                          <td>{formatTimestamp(item.detectedAt, workspaceTimezone)}</td>
                          <td>{formatTimestamp(item.resolvedAt, workspaceTimezone)}</td>
                          <td>
                            <span className="metric-lead-time-cell">
                              {item.recoveryDurationSeconds != null
                                ? formatDuration(item.recoveryDurationSeconds)
                                : <span className="metric-details-muted">&mdash;</span>}
                            </span>
                          </td>
                          <td>
                            <DeploymentShaChip
                              deployment={item.failedDeployment}
                              repositoryFullName={item.repositoryFullName}
                              label="Failed"
                            />
                          </td>
                          <td>
                            <DeploymentShaChip
                              deployment={item.recoveryDeployment}
                              repositoryFullName={item.repositoryFullName}
                              label="Recovery"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  <div className="metric-details-pagination">
                    <span>
                      Showing{" "}
                      {recoveryTimeQuery.data.totalElements === 0
                        ? 0
                        : recoveryTimeQuery.data.page * recoveryTimeQuery.data.size + 1}
                      –
                      {Math.min(
                        (recoveryTimeQuery.data.page + 1) * recoveryTimeQuery.data.size,
                        recoveryTimeQuery.data.totalElements,
                      )}{" "}
                      of {recoveryTimeQuery.data.totalElements} incidents
                    </span>

                    <div className="metric-details-pagination-buttons">
                      <button
                        type="button"
                        className="metric-pagination-btn"
                        onClick={() => handlePageChange(Math.max(0, page - 1))}
                        disabled={page === 0}
                      >
                        Previous
                      </button>
                      <span>
                        Page {recoveryTimeQuery.data.page + 1} of{" "}
                        {Math.max(1, recoveryTimeQuery.data.totalPages)}
                      </span>
                      <button
                        type="button"
                        className="metric-pagination-btn"
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page + 1 >= recoveryTimeQuery.data.totalPages}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            {changeFailureRateQuery.data && changeFailureRateQuery.data.totalDeployments > 0 && (
              <div
                className="metric-details-summary-chip"
                role="status"
                aria-label="Change failure rate breakdown"
              >
                {formatFailureBreakdown(changeFailureRateQuery.data)}
              </div>
            )}
            <div className="metric-details-table-panel">
              {changeFailureRateQuery.isLoading ? (
                <div className="metric-details-empty" aria-busy="true">
                  <p>Loading production deployments&hellip;</p>
                </div>
              ) : changeFailureRateQuery.error ? (
                <div className="metric-details-empty" role="alert">
                  <h3>Production deployments could not be loaded</h3>
                  <p>
                    {changeFailureRateQuery.error instanceof Error
                      ? changeFailureRateQuery.error.message
                      : "Please try again."}
                  </p>
                  <button
                    type="button"
                    className="dora-filter-btn"
                    onClick={() => void changeFailureRateQuery.refetch()}
                  >
                    Retry
                  </button>
                </div>
              ) : !changeFailureRateQuery.data ||
                changeFailureRateQuery.data.items.length === 0 ? (
                <div className="metric-details-empty">
                  <h3>No finished production deployments</h3>
                  <p>
                    There are no finished production deployments recorded in this time range for
                    the selected repository scope.
                  </p>
                </div>
              ) : (
                <>
                  <table
                    className="metric-details-table"
                    aria-label="Production deployments counted in change failure rate"
                  >
                    <thead>
                      <tr>
                        <th scope="col">Finished Time</th>
                        <th scope="col">Repository</th>
                        <th scope="col">Environment</th>
                        <th scope="col">Status</th>
                        <th scope="col">Commit SHA</th>
                        <th scope="col">Counted as Failure</th>
                        <th scope="col">Linked Incident</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changeFailureRateQuery.data.items.map((item: ChangeFailureRateDetailDto) => (
                        <tr
                          key={item.deploymentId}
                          className={item.isFailure ? "metric-details-row--failure" : undefined}
                        >
                          <td>{formatTimestamp(item.finishedAt, workspaceTimezone)}</td>
                          <td><strong>{item.repositoryFullName ?? item.repositoryName}</strong></td>
                          <td>
                            <span className="metric-env-badge">{item.environment}</span>
                          </td>
                          <td>
                            <span
                              className={`metric-status-badge ${
                                DEPLOYMENT_STATUS_CLASS[item.status] ?? "metric-status-badge--pending"
                              }`}
                            >
                              {formatDeploymentStatus(item.status)}
                            </span>
                          </td>
                          <td>
                            {item.commitSha ? (
                              item.repositoryFullName ? (
                                <a
                                  href={`https://github.com/${item.repositoryFullName}/commit/${item.commitSha}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="metric-commit-link"
                                  title={`View commit ${item.commitSha} on GitHub`}
                                >
                                  <code>{item.commitSha.slice(0, 7)}</code>
                                  <span className="metric-commit-arrow" aria-hidden="true">{"↗"}</span>
                                </a>
                              ) : (
                                <code className="metric-commit-sha" title={item.commitSha}>
                                  {item.commitSha.slice(0, 7)}
                                </code>
                              )
                            ) : (
                              <span className="metric-details-muted">&mdash;</span>
                            )}
                          </td>
                          <td>
                            <div className="metric-failure-cell">
                              <span
                                className={`metric-failure-flag ${
                                  item.isFailure ? "metric-failure-flag--yes" : "metric-failure-flag--no"
                                }`}
                              >
                                {item.isFailure ? "Yes" : "No"}
                              </span>
                              <FailureReason item={item} />
                            </div>
                          </td>
                          <td>
                            {item.incident ? (
                              <div className="metric-incident-cell">
                                <span className="metric-incident-title">{item.incident.title}</span>
                                <span
                                  className={`metric-severity-badge ${
                                    SEVERITY_CLASS[item.incident.severity] ?? SEVERITY_CLASS.UNKNOWN
                                  }`}
                                >
                                  {item.incident.severity === "UNKNOWN" ? "Unknown" : item.incident.severity}
                                </span>
                              </div>
                            ) : (
                              <span className="metric-details-muted">&mdash;</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  <div className="metric-details-pagination">
                    <span>
                      Showing{" "}
                      {changeFailureRateQuery.data.totalElements === 0
                        ? 0
                        : changeFailureRateQuery.data.page * changeFailureRateQuery.data.size + 1}
                      –
                      {Math.min(
                        (changeFailureRateQuery.data.page + 1) * changeFailureRateQuery.data.size,
                        changeFailureRateQuery.data.totalElements,
                      )}{" "}
                      of {changeFailureRateQuery.data.totalElements} deployments
                    </span>

                    <div className="metric-details-pagination-buttons">
                      <button
                        type="button"
                        className="metric-pagination-btn"
                        onClick={() => handlePageChange(Math.max(0, page - 1))}
                        disabled={page === 0}
                      >
                        Previous
                      </button>
                      <span>
                        Page {changeFailureRateQuery.data.page + 1} of{" "}
                        {Math.max(1, changeFailureRateQuery.data.totalPages)}
                      </span>
                      <button
                        type="button"
                        className="metric-pagination-btn"
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page + 1 >= changeFailureRateQuery.data.totalPages}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}

      </div>
    </AppShell>
  );
}
