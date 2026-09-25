import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../auth/AuthProvider.js";
import { queryKeys } from "../../api/queryKeys.js";
import {
  fetchDoraMetricsSummary,
  fetchDoraMetricsSeries,
  fetchDeploymentFrequencyDetails,
  fetchChangeLeadTimeDetails,
  fetchRecoveryTimeDetails,
} from "./api.js";
import type {
  DoraMetricsFilters,
  DoraMetricsSeriesFilters,
  DoraMetricsSummaryResponse,
  DoraMetricsSeriesResponse,
  DeploymentFrequencyDetailsResponse,
  ChangeLeadTimeDetailsResponse,
  RecoveryTimeDetailsResponse,
  MetricDetailsFilters,
} from "./types.js";

/**
 * React Query hook for DORA metrics summary.
 * Automatically re-fetches when `filters` change (project, time range, etc.).
 * Returns `undefined` while loading / when not authenticated.
 */
export function useDoraMetricsSummary(filters: DoraMetricsFilters) {
  const { state } = useAuth();
  const workspaceId = state.status === "authenticated"
    ? state.currentMembership.workspaceId
    : null;

  return useQuery<DoraMetricsSummaryResponse>({
    queryKey: workspaceId
      ? queryKeys.doraMetricsSummary(workspaceId, filters)
      : ["metrics-summary-disabled"],
    queryFn: ({ signal }) => fetchDoraMetricsSummary(filters, signal),
    enabled: !!workspaceId,
    staleTime: 60 * 1000, // 1 min — metrics don't change second-by-second
  });
}

/**
 * React Query hook for DORA metrics time series.
 * Automatically re-fetches when `filters` change.
 * Returns `undefined` while loading / when not authenticated.
 */
export function useDoraMetricsSeries(filters: DoraMetricsSeriesFilters) {
  const { state } = useAuth();
  const workspaceId = state.status === "authenticated"
    ? state.currentMembership.workspaceId
    : null;

  return useQuery<DoraMetricsSeriesResponse>({
    queryKey: workspaceId
      ? queryKeys.doraMetricsSeries(workspaceId, filters)
      : ["metrics-series-disabled"],
    queryFn: ({ signal }) => fetchDoraMetricsSeries(filters, signal),
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  });
}

/**
 * React Query hook for Deployment Frequency event drill-down details.
 */
export function useDeploymentFrequencyDetails(filters: MetricDetailsFilters) {
  const { state } = useAuth();
  const workspaceId = state.status === "authenticated"
    ? state.currentMembership.workspaceId
    : null;

  return useQuery<DeploymentFrequencyDetailsResponse>({
    queryKey: workspaceId
      ? queryKeys.deploymentFrequencyDetails(workspaceId, filters)
      : ["deployment-frequency-details-disabled"],
    queryFn: ({ signal }) => fetchDeploymentFrequencyDetails(filters, signal),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
  });
}

/**
 * React Query hook for Change Lead Time event drill-down details.
 */
export function useChangeLeadTimeDetails(filters: MetricDetailsFilters) {
  const { state } = useAuth();
  const workspaceId = state.status === "authenticated"
    ? state.currentMembership.workspaceId
    : null;

  return useQuery<ChangeLeadTimeDetailsResponse>({
    queryKey: workspaceId
      ? queryKeys.changeLeadTimeDetails(workspaceId, filters)
      : ["change-lead-time-details-disabled"],
    queryFn: ({ signal }) => fetchChangeLeadTimeDetails(filters, signal),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
  });
}

/**
 * React Query hook for Failed Deployment Recovery Time drill-down details.
 */
export function useRecoveryTimeDetails(filters: MetricDetailsFilters) {
  const { state } = useAuth();
  const workspaceId = state.status === "authenticated"
    ? state.currentMembership.workspaceId
    : null;

  return useQuery<RecoveryTimeDetailsResponse>({
    queryKey: workspaceId
      ? queryKeys.recoveryTimeDetails(workspaceId, filters)
      : ["recovery-time-details-disabled"],
    queryFn: ({ signal }) => fetchRecoveryTimeDetails(filters, signal),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
  });
}
