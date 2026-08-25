import type { components } from "../../api/generated/schema.js";

type GeneratedMetricSummary = components["schemas"]["MetricSummaryDto"];
type GeneratedMetricSeriesItem = components["schemas"]["MetricSeriesItemDto"];
type GeneratedSummaryResponse = components["schemas"]["DoraMetricsSummaryResponse"];
type GeneratedSeriesResponse = components["schemas"]["DoraMetricsSeriesResponse"];

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
