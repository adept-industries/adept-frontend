import { apiRequest } from "../../api/client.js";
import type {
  DoraMetricsFilters,
  DoraMetricsSeriesFilters,
  DoraMetricsSummaryResponse,
  DoraMetricsSeriesResponse,
  DeploymentFrequencyDetailsResponse,
  ChangeLeadTimeDetailsResponse,
  MetricDetailsFilters,
} from "./types.js";

function buildSearchParams(filters: DoraMetricsFilters & {
  metricType?: string | null;
  granularity?: string;
  page?: number;
  size?: number;
}): string {
  const params = new URLSearchParams();
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.repositoryId) params.set("repositoryId", filters.repositoryId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.metricType) params.set("metricType", filters.metricType);
  if (filters.granularity) params.set("granularity", filters.granularity);
  if (filters.page !== undefined && filters.page !== null) params.set("page", String(filters.page));
  if (filters.size !== undefined && filters.size !== null) params.set("size", String(filters.size));
  const str = params.toString();
  return str ? `?${str}` : "";
}

export function fetchDoraMetricsSummary(
  filters: DoraMetricsFilters,
  signal?: AbortSignal,
): Promise<DoraMetricsSummaryResponse> {
  return apiRequest<DoraMetricsSummaryResponse>(
    {
      method: "GET",
      path: `/metrics/summary${buildSearchParams(filters)}`,
      auth: "bearer",
      signal,
    }
  );
}

export function fetchDoraMetricsSeries(
  filters: DoraMetricsSeriesFilters,
  signal?: AbortSignal,
): Promise<DoraMetricsSeriesResponse> {
  return apiRequest<DoraMetricsSeriesResponse>(
    {
      method: "GET",
      path: `/metrics/series${buildSearchParams(filters)}`,
      auth: "bearer",
      signal,
    }
  );
}

export function fetchDeploymentFrequencyDetails(
  filters: MetricDetailsFilters,
  signal?: AbortSignal,
): Promise<DeploymentFrequencyDetailsResponse> {
  return apiRequest<DeploymentFrequencyDetailsResponse>(
    {
      method: "GET",
      path: `/metrics/deployment-frequency/details${buildSearchParams(filters)}`,
      auth: "bearer",
      signal,
    }
  );
}

export function fetchChangeLeadTimeDetails(
  filters: MetricDetailsFilters,
  signal?: AbortSignal,
): Promise<ChangeLeadTimeDetailsResponse> {
  return apiRequest<ChangeLeadTimeDetailsResponse>(
    {
      method: "GET",
      path: `/metrics/change-lead-time/details${buildSearchParams(filters)}`,
      auth: "bearer",
      signal,
    }
  );
}
