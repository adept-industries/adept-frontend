/**
 * DORA Metrics — TypeScript types mirroring the adept-api backend schemas.
 *
 * Endpoint A: GET /api/v1/metrics/summary  → DoraMetricsSummaryResponse
 * Endpoint B: GET /api/v1/metrics/series   → DoraMetricsSeriesResponse
 */

// ── Enum-like string literals ──────────────────────────────────────────────

export type MetricRating = "ELITE" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export type MetricType =
  | "DEPLOYMENT_FREQUENCY"
  | "CHANGE_LEAD_TIME_HOURS"
  | "FAILED_DEPLOYMENT_RECOVERY_TIME_HOURS"
  | "CHANGE_FAILURE_RATE_PERCENT";

export type MetricGranularity = "DAY" | "WEEK" | "MONTH";

// ── Shared metric summary ──────────────────────────────────────────────────

/**
 * A single aggregated metric value (e.g. deployment frequency or lead time).
 * `dimensions` carries metric-specific breakdowns such as percentiles.
 */
export interface MetricSummaryDto {
  value: number;
  unit: string;
  sampleSize: number;
  rating: MetricRating;
  dimensions: Record<string, number>;
}

// ── Summary endpoint response ──────────────────────────────────────────────

export interface DoraMetricsSummaryResponse {
  workspaceId: string;
  projectId: string | null;
  repositoryId: string | null;
  repositoryCount: number;
  periodStart: string; // ISO instant
  periodEnd: string;   // ISO instant
  deploymentFrequency: MetricSummaryDto;
  changeLeadTime: MetricSummaryDto;
  recoveryTime: MetricSummaryDto;
  changeFailureRate: MetricSummaryDto;
  calculatedAt: string; // ISO instant
}

// ── Series endpoint ────────────────────────────────────────────────────────

export interface MetricSeriesItemDto {
  metricType: MetricType;
  periodStart: string; // ISO instant
  periodEnd: string;   // ISO instant
  value: number;
  unit: string;
  sampleSize: number;
  dimensions: Record<string, number>;
}

export interface DoraMetricsSeriesResponse {
  workspaceId: string;
  projectId: string | null;
  repositoryId: string | null;
  repositoryCount: number;
  granularity: MetricGranularity;
  series: MetricSeriesItemDto[];
}

// ── Filter params shared by both hooks ────────────────────────────────────

export interface DoraMetricsFilters {
  projectId?: string | null;
  repositoryId?: string | null;
  from?: string | null; // ISO instant
  to?: string | null;   // ISO instant
}

export interface DoraMetricsSeriesFilters extends DoraMetricsFilters {
  metricType?: MetricType | null;
  granularity?: MetricGranularity;
}
