import type { components } from "../../api/generated/schema.js";
import { apiRequest } from "../../api/client.js";

export type AlertRuleResponse = components["schemas"]["AlertRuleResponse"];
export type CreateAlertRuleRequest = components["schemas"]["CreateAlertRuleRequest"];
export type UpdateAlertRuleRequest = components["schemas"]["UpdateAlertRuleRequest"];
export type AlertMetricType = components["schemas"]["AlertRuleResponse"]["metricType"];
export type AlertComparator = components["schemas"]["AlertRuleResponse"]["comparator"];

export function listAlertRules(
  repositoryId?: string,
  signal?: AbortSignal,
): Promise<AlertRuleResponse[]> {
  const query = repositoryId ? `?repositoryId=${encodeURIComponent(repositoryId)}` : "";
  return apiRequest<AlertRuleResponse[]>({
    method: "GET",
    path: `/alert-rules${query}`,
    auth: "bearer",
    signal,
  });
}

export function createAlertRule(
  body: CreateAlertRuleRequest,
): Promise<AlertRuleResponse> {
  return apiRequest<AlertRuleResponse, CreateAlertRuleRequest>({
    method: "POST",
    path: "/alert-rules",
    auth: "bearer",
    body,
  });
}

export function updateAlertRule(
  id: string,
  body: UpdateAlertRuleRequest,
): Promise<AlertRuleResponse> {
  return apiRequest<AlertRuleResponse, UpdateAlertRuleRequest>({
    method: "PATCH",
    path: `/alert-rules/${id}`,
    auth: "bearer",
    body,
  });
}

export function deleteAlertRule(id: string): Promise<void> {
  return apiRequest<void>({
    method: "DELETE",
    path: `/alert-rules/${id}`,
    auth: "bearer",
  });
}
