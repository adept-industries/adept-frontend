import type { components } from "../../api/generated/schema.js";

type GeneratedMetricSummary = components["schemas"]["MetricSummaryDto"];
type GeneratedMetricSeriesItem = components["schemas"]["MetricSeriesItemDto"];
type GeneratedSummaryResponse = components["schemas"]["DoraMetricsSummaryResponse"];
type GeneratedSeriesResponse = components["schemas"]["DoraMetricsSeriesResponse"];
type GeneratedDeploymentFrequencyDetail = components["schemas"]["DeploymentFrequencyDetailDto"];

type RequiredGenerated<T> = {
  [K in keyof T]-?: NonNullable<T[K]>;
};

export type MetricRating = NonNullable<GeneratedMetricSummary["rating"]>;
export type MetricType = NonNullable<GeneratedMetricSeriesItem["metricType"]>;
export type MetricGranularity = NonNullable<GeneratedSeriesResponse["granularity"]>;

export type MetricSummaryDto = Omit<RequiredGenerated<GeneratedMetricSummary>, "dimensions"> & {
  dimensions: Record<string, number>;
};

export type MetricSeriesItemDto = Omit<RequiredGenerated<GeneratedMetricSeriesItem>, "dimensions"> & {
  dimensions: Record<string, number>;
};

export type DoraMetricsSummaryResponse = Omit<
  RequiredGenerated<GeneratedSummaryResponse>,
  | "projectId"
  | "repositoryId"
  | "calculatedAt"
  | "deploymentFrequency"
  | "changeLeadTime"
  | "recoveryTime"
  | "changeFailureRate"
> & {
  projectId: string | null;
  repositoryId: string | null;
  calculatedAt: string | null;
  deploymentFrequency: MetricSummaryDto;
  changeLeadTime: MetricSummaryDto;
  recoveryTime: MetricSummaryDto;
  changeFailureRate: MetricSummaryDto;
};

export type DoraMetricsSeriesResponse = Omit<
  RequiredGenerated<GeneratedSeriesResponse>,
  "projectId" | "repositoryId" | "calculatedAt" | "series"
> & {
  projectId: string | null;
  repositoryId: string | null;
  calculatedAt: string | null;
  series: MetricSeriesItemDto[];
};

export interface DoraMetricsFilters {
  projectId?: string | null;
  repositoryId?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface DoraMetricsSeriesFilters extends DoraMetricsFilters {
  metricType?: MetricType | null;
  granularity?: MetricGranularity;
}

export interface DeploymentFrequencyDetailDto {
  id: string;
  repositoryId: string;
  repositoryName: string;
  repositoryFullName: string;
  deployedAt: string;
  environment: string;
  source: NonNullable<GeneratedDeploymentFrequencyDetail["source"]>;
  commitSha: string;
  durationSeconds?: number | null;
}

export interface DeploymentFrequencyDetailsResponse {
  workspaceId: string;
  projectId: string | null;
  repositoryId: string | null;
  repositoryCount: number;
  rangeStart: string;
  rangeEnd: string;
  timezone: string;
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  items: DeploymentFrequencyDetailDto[];
}

export interface MetricDetailsFilters extends DoraMetricsFilters {
  metricType?: MetricType | string | null;
  page?: number;
  size?: number;
}

/**
 * One pull request row returned by the Change Lead Time details endpoint.
 * All time-breakdown fields (coding/review/deploy) are null when the
 * corresponding timestamp is missing from the raw data.
 */
export interface ChangeLeadTimeDetailDto {
  prId: string;
  prNumber: number;
  prTitle: string;
  prUrl: string | null;
  authorLogin: string | null;
  repositoryId: string;
  repositoryName: string;
  repositoryOwnerLogin: string | null;
  repositoryFullName: string;
  firstCommitAt: string | null;
  openedAt: string | null;
  mergedAt: string | null;
  deployedAt: string;
  /** Total lead time in seconds (deployedAt − firstCommitAt). */
  leadTimeSeconds: number | null;
  /** Coding stage in seconds (openedAt − firstCommitAt). */
  codingTimeSeconds: number | null;
  /** Review/merge stage in seconds (mergedAt − openedAt). */
  reviewTimeSeconds: number | null;
  /** Deploy stage in seconds (deployedAt − mergedAt). */
  deployTimeSeconds: number | null;
  deploymentEnvironment: string;
  deploymentCommitSha: string | null;
}

export interface ChangeLeadTimeDetailsResponse {
  workspaceId: string;
  projectId: string | null;
  repositoryId: string | null;
  repositoryCount: number;
  rangeStart: string;
  rangeEnd: string;
  timezone: string;
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  items: ChangeLeadTimeDetailDto[];
}

export type IncidentSource = "JIRA" | "MANUAL" | "GITHUB";
export type IncidentSeverity = "UNKNOWN" | "SEV1" | "SEV2" | "SEV3" | "SEV4";

/** Compact reference to a deployment correlated with an incident. */
export interface RecoveryDeploymentRefDto {
  id: string;
  commitSha: string | null;
  environment: string | null;
  finishedAt: string | null;
}

/**
 * One resolved incident returned by the Recovery Time details endpoint.
 * `resolvedAt` is the instant used by the metric: the recovery deployment's
 * finish time when linked, otherwise the incident's recorded resolution time.
 */
export interface RecoveryTimeDetailDto {
  incidentId: string;
  title: string;
  source: IncidentSource;
  severity: IncidentSeverity;
  repositoryId: string;
  repositoryName: string;
  repositoryFullName: string | null;
  detectedAt: string;
  resolvedAt: string;
  /** Recovery duration in seconds (resolvedAt − detectedAt). */
  recoveryDurationSeconds: number | null;
  failedDeployment: RecoveryDeploymentRefDto | null;
  recoveryDeployment: RecoveryDeploymentRefDto | null;
}

export interface RecoveryTimeDetailsResponse {
  workspaceId: string;
  projectId: string | null;
  repositoryId: string | null;
  repositoryCount: number;
  rangeStart: string;
  rangeEnd: string;
  timezone: string;
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  items: RecoveryTimeDetailDto[];
}
