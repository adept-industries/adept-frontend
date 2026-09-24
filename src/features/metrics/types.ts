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
