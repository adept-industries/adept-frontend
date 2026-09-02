import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider.js";
import { AppShell } from "../../components/layout/AppShell.js";
import { InlineAlert } from "../../components/ui/InlineAlert.js";
import { formatWorkspaceDateTime } from "../../lib/timezone.js";
import {
  listRepositories,
  type RepositoryResponse,
} from "../integrations/api.js";
import {
  createAlertRule,
  deleteAlertRule,
  listAlertRules,
  updateAlertRule,
  type AlertComparator,
  type AlertMetricType,
  type AlertRuleResponse,
} from "./api.js";

const METRIC_OPTIONS: { label: string; value: AlertMetricType; unit: string; description: string }[] = [
  {
    label: "Change Failure Rate (%)",
    value: "CHANGE_FAILURE_RATE_PERCENT",
    unit: "%",
    description: "Percentage of production deployments that resulted in failure or incident.",
  },
  {
    label: "Change Lead Time (Hours)",
    value: "CHANGE_LEAD_TIME_HOURS",
    unit: "hours",
    description: "Time from first commit to deployment in production.",
  },
  {
    label: "Deployment Frequency",
    value: "DEPLOYMENT_FREQUENCY",
    unit: "deploys",
    description: "Frequency of successful deployments into production environments.",
  },
  {
    label: "Recovery Time (Hours)",
    value: "FAILED_DEPLOYMENT_RECOVERY_TIME_HOURS",
    unit: "hours",
    description: "Time to restore service after a production failure/incident (MTTR).",
  },
  {
    label: "PR Estimated Review Risk",
    value: "PR_RISK_SCORE",
    unit: "score",
    description: "Machine learning estimated review risk score for open pull requests (0.00 to 1.00).",
  },
];

const COMPARATOR_OPTIONS: { label: string; value: AlertComparator }[] = [
  { label: "> Greater than", value: "GT" },
  { label: ">= Greater than or equal to", value: "GTE" },
  { label: "< Less than", value: "LT" },
  { label: "<= Less than or equal to", value: "LTE" },
  { label: "= Equal to", value: "EQ" },
];

const MINUTES_PER_HOUR = 60;

function hoursToMinutes(value: string): number {
  const hours = Number(value);
  if (!Number.isFinite(hours)) return Number.NaN;
  if (hours < 0) return -1;
  return Math.round(hours * MINUTES_PER_HOUR);
}

function minutesToHoursInput(minutes: number): string {
  return String(Number((minutes / MINUTES_PER_HOUR).toFixed(4)));
}

function formatDurationHours(minutes: number): string {
  const hours = minutes / MINUTES_PER_HOUR;
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(hours)}h`;
}

function validateRuleValues(
  metricType: AlertMetricType,
  threshold: number,
  evaluationWindowMinutes: number,
  cooldownMinutes: number,
): string | null {
  if (!Number.isFinite(threshold)) {
    return "Provide a valid numeric threshold.";
  }
  if (metricType === "PR_RISK_SCORE" && (threshold < 0 || threshold > 1)) {
    return "PR risk thresholds must be between 0 and 1.";
  }
  if (metricType === "CHANGE_FAILURE_RATE_PERCENT" && (threshold < 0 || threshold > 100)) {
    return "Change failure rate thresholds must be between 0% and 100%.";
  }
  if (
    metricType !== "PR_RISK_SCORE"
    && metricType !== "CHANGE_FAILURE_RATE_PERCENT"
    && threshold < 0
  ) {
    return "Deployment and duration thresholds cannot be negative.";
  }
  if (!Number.isInteger(evaluationWindowMinutes) || evaluationWindowMinutes < 1) {
    return "Evaluation window must be greater than 0 hours.";
  }
  if (!Number.isInteger(cooldownMinutes) || cooldownMinutes < 0) {
    return "Cooldown must be 0 hours or greater.";
  }
  return null;
}

export function AlertsPage() {
  const { state } = useAuth();
  const isAuthenticated = state.status === "authenticated";
  const userEmail = isAuthenticated ? state.user.email : "";
  const workspaceTimezone = isAuthenticated ? state.currentMembership.timezone : "UTC";
  const currentMembershipId = isAuthenticated ? state.currentMembership.id : "";
  const isManager = isAuthenticated && state.currentMembership.role === "MANAGER";

  const [rules, setRules] = useState<AlertRuleResponse[]>([]);
  const [repositories, setRepositories] = useState<RepositoryResponse[]>([]);
  const [selectedRepoFilter, setSelectedRepoFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Create form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [repositoryId, setRepositoryId] = useState("");
  const [metricType, setMetricType] = useState<AlertMetricType>("CHANGE_FAILURE_RATE_PERCENT");
  const [comparator, setComparator] = useState<AlertComparator>("GT");
  const [thresholdValue, setThresholdValue] = useState<string>("15.0");
  const [evaluationWindowHours, setEvaluationWindowHours] = useState("24");
  const [cooldownHours, setCooldownHours] = useState("24");
  const [destination, setDestination] = useState("");

  // Edit state
  const [editingRule, setEditingRule] = useState<AlertRuleResponse | null>(null);
  const [editName, setEditName] = useState("");
  const [editComparator, setEditComparator] = useState<AlertComparator>("GT");
  const [editThresholdValue, setEditThresholdValue] = useState<string>("");
  const [editEvaluationWindowHours, setEditEvaluationWindowHours] = useState("24");
  const [editCooldownHours, setEditCooldownHours] = useState("24");
  const [editDestination, setEditDestination] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);

  const fetchCatalog = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);
      const [fetchedRules, fetchedRepos] = await Promise.all([
        listAlertRules(selectedRepoFilter === "ALL" ? undefined : selectedRepoFilter, signal),
        listRepositories(true, signal),
      ]);
      if (signal?.aborted) return;
      setRules(fetchedRules);
      const activeRepos = (fetchedRepos ?? []).filter((r) => r.trackingEnabled && !r.archived);
      setRepositories(activeRepos);
      setRepositoryId((current) => (
        activeRepos.some((repository) => repository.id === current)
          ? current
          : (activeRepos[0]?.id ?? "")
      ));
    } catch (err: unknown) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "Failed to load alert rules.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [selectedRepoFilter]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    void fetchCatalog(controller.signal);
    return () => controller.abort();
  }, [fetchCatalog, isAuthenticated]);

  const handleOpenCreateModal = () => {
    if (repositories.length === 0) {
      setError("Track an accessible repository before creating an alert rule.");
      return;
    }
    setRuleName("");
    setMetricType("CHANGE_FAILURE_RATE_PERCENT");
    setComparator("GT");
    setThresholdValue("15.0");
    setEvaluationWindowHours("24");
    setCooldownHours("24");
    setDestination(userEmail);
    if (repositories.length > 0) {
      setRepositoryId(selectedRepoFilter !== "ALL" ? selectedRepoFilter : repositories[0].id);
    }
    setError(null);
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = ruleName.trim();
    if (!trimmedName || !repositoryId) return;

    const parsedThreshold = Number(thresholdValue);
    const evaluationWindowMinutes = hoursToMinutes(evaluationWindowHours);
    const cooldownMinutes = hoursToMinutes(cooldownHours);
    const validationError = validateRuleValues(
      metricType,
      parsedThreshold,
      evaluationWindowMinutes,
      cooldownMinutes,
    );
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await createAlertRule({
        name: trimmedName,
        repositoryId,
        metricType,
        comparator,
        thresholdValue: parsedThreshold,
        evaluationWindowMinutes,
        cooldownMinutes,
        destination: destination.trim() || userEmail,
        enabled: true,
        channel: "EMAIL",
      });
      setShowCreateModal(false);
      setSuccessMessage(`Alert rule "${trimmedName}" created successfully.`);
      await fetchCatalog();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create alert rule.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (rule: AlertRuleResponse) => {
    setEditingRule(rule);
    setEditName(rule.name);
    setEditComparator(rule.comparator);
    setEditThresholdValue(String(rule.thresholdValue));
    setEditEvaluationWindowHours(minutesToHoursInput(rule.evaluationWindowMinutes));
    setEditCooldownHours(minutesToHoursInput(rule.cooldownMinutes));
    setEditDestination(rule.destination);
    setEditEnabled(rule.enabled);
    setError(null);
    setFormError(null);
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingRule) return;

    const parsedThreshold = Number(editThresholdValue);
    const editEvaluationWindowMinutes = hoursToMinutes(editEvaluationWindowHours);
    const editCooldownMinutes = hoursToMinutes(editCooldownHours);
    const validationError = validateRuleValues(
      editingRule.metricType,
      parsedThreshold,
      editEvaluationWindowMinutes,
      editCooldownMinutes,
    );
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await updateAlertRule(editingRule.id, {
        name: editName.trim() || undefined,
        comparator: editComparator,
        thresholdValue: parsedThreshold,
        evaluationWindowMinutes: Number(editEvaluationWindowMinutes),
        cooldownMinutes: Number(editCooldownMinutes),
        destination: editDestination.trim() || undefined,
        enabled: editEnabled,
      });
      setEditingRule(null);
      setSuccessMessage(`Alert rule "${editingRule.name}" updated successfully.`);
      await fetchCatalog();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to update alert rule.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleEnabled = async (rule: AlertRuleResponse) => {
    if (!isManager && rule.createdByMembershipId !== currentMembershipId) return;
    try {
      setError(null);
      await updateAlertRule(rule.id, { enabled: !rule.enabled });
      await fetchCatalog();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to toggle rule state.");
    }
  };

  const handleDelete = async (rule: AlertRuleResponse) => {
    if (!isManager && rule.createdByMembershipId !== currentMembershipId) return;
    if (!window.confirm(`Are you sure you want to delete alert rule "${rule.name}"?`)) return;
    try {
      setError(null);
      await deleteAlertRule(rule.id);
      setSuccessMessage(`Alert rule "${rule.name}" deleted.`);
      await fetchCatalog();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete alert rule.");
    }
  };

  return (
    <AppShell>
      <div className="dash-header-row">
        <div className="dash-welcome">
          <p className="dash-welcome-eyebrow">Repository Threshold Monitoring</p>
          <h1 id="alerts-title" className="dash-welcome-title">Alert Rules</h1>
          <p className="dash-welcome-sub">
            Email workspace members when repository DORA metrics or estimated PR review risk match a rule.
          </p>
        </div>

        <div className="dash-inline-controls">
          <button
            type="button"
            id="create-alert-btn"
            className="primary-button"
            onClick={handleOpenCreateModal}
            disabled={loading || repositories.length === 0}
            title={repositories.length === 0 ? "Track an accessible repository first" : undefined}
            style={{ padding: "0.55rem 1.25rem", fontSize: "0.9rem" }}
          >
            + New Alert Rule
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: "1.25rem" }}>
          <InlineAlert message={error} kind="error" id="alerts-error" />
        </div>
      )}

      {successMessage && (
        <div style={{ marginBottom: "1.25rem" }}>
          <InlineAlert message={successMessage} kind="success" id="alerts-success" />
        </div>
      )}

      {/* Filter and Stats Toolbar */}
      <div className="alerts-toolbar">
        <div className="alerts-toolbar__filter">
          <label htmlFor="repo-filter">
            Repository:
          </label>
          <select
            id="repo-filter"
            className="alerts-toolbar__select"
            value={selectedRepoFilter}
            onChange={(e) => setSelectedRepoFilter(e.target.value)}
          >
            <option value="ALL">All Accessible Repositories</option>
            {repositories.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.fullName}
              </option>
            ))}
          </select>
        </div>

        <div
          className="alerts-toolbar__summary"
          aria-label={`${rules.length} total rules, ${rules.filter((rule) => rule.enabled).length} active`}
        >
          <span>Total Rules: <strong>{rules.length}</strong></span>
          <span className="alerts-toolbar__divider" aria-hidden="true" />
          <span>Active: <strong className="alerts-toolbar__active-count">{rules.filter((rule) => rule.enabled).length}</strong></span>
        </div>
      </div>

      {/* Alert Rules Table */}
      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
          Loading alert rules...
        </div>
      ) : rules.length === 0 ? (
        <div
          style={{
            padding: "3.5rem 1.5rem",
            textAlign: "center",
            backgroundColor: "var(--card-bg)",
            borderRadius: "10px",
            border: "1px dashed var(--border-color)",
          }}
        >
          <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>No alert rules found</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", maxWidth: "460px", margin: "0 auto 1.5rem auto" }}>
            {selectedRepoFilter === "ALL"
              ? "Keep your team informed when metrics exceed thresholds by creating your first alert rule."
              : "No alert rules configured for this repository yet."}
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={handleOpenCreateModal}
            disabled={repositories.length === 0}
            style={{ fontSize: "0.875rem", padding: "0.5rem 1rem" }}
          >
            Create Rule
          </button>
        </div>
      ) : (
        <div className="alerts-table-panel">
          <table className="alerts-table">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Repository</th>
                <th>Condition</th>
                <th>Window / Cooldown</th>
                <th>Destination</th>
                <th>Status</th>
                <th>Last Triggered</th>
                <th className="alerts-table__actions-heading">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const metricMeta = METRIC_OPTIONS.find((m) => m.value === rule.metricType);
                const canManage = isManager || rule.createdByMembershipId === currentMembershipId;
                return (
                  <tr
                    key={rule.id}
                    className={rule.enabled ? undefined : "alerts-table__row--disabled"}
                  >
                    <td data-label="Rule">
                      <div className="alerts-table__rule">
                        <strong>{rule.name}</strong>
                        <span>{metricMeta?.label ?? rule.metricType}</span>
                      </div>
                    </td>
                    <td data-label="Repository">
                      <code className="alerts-table__repository">{rule.repositoryFullName}</code>
                    </td>
                    <td data-label="Condition">
                      <span className="alerts-table__condition">
                        {rule.comparator} {rule.thresholdValue} {metricMeta?.unit}
                      </span>
                    </td>
                    <td data-label="Window / Cooldown">
                      <div className="alerts-table__timing">
                        <span><strong>Window:</strong> {formatDurationHours(rule.evaluationWindowMinutes)}</span>
                        <span><strong>Cooldown:</strong> {formatDurationHours(rule.cooldownMinutes)}</span>
                      </div>
                    </td>
                    <td data-label="Destination">
                      <span className="alerts-table__destination">{rule.destination}</span>
                    </td>
                    <td data-label="Status">
                      <div>
                        {canManage ? (
                          <button
                            type="button"
                            className={`alerts-status ${rule.enabled ? "alerts-status--active" : "alerts-status--disabled"}`}
                            onClick={() => handleToggleEnabled(rule)}
                            aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.name}`}
                          >
                            {rule.enabled ? "Active" : "Disabled"}
                          </button>
                        ) : (
                          <span
                            className={`alerts-status ${rule.enabled ? "alerts-status--active" : "alerts-status--disabled"}`}
                          >
                            {rule.enabled ? "Active" : "Disabled"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Last Triggered">
                      <span className="alerts-table__last-triggered">
                        {rule.lastTriggeredAt
                          ? formatWorkspaceDateTime(rule.lastTriggeredAt, workspaceTimezone)
                          : "Never"}
                      </span>
                    </td>
                    <td data-label="Actions" className="alerts-table__actions-cell">
                      {canManage ? (
                        <div className="alerts-table__actions">
                          <button
                            type="button"
                            className="button-link"
                            onClick={() => handleStartEdit(rule)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="button-link"
                            onClick={() => handleDelete(rule)}
                            data-variant="danger"
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <span className="alerts-table__read-only">
                          Read only
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Create Alert Rule */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1.5rem",
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-create-title"
        >
          <div
            style={{
              backgroundColor: "var(--card-bg)",
              border: "1px solid var(--border-color)",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "580px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "1.75rem",
              boxShadow: "var(--popover-shadow)",
            }}
          >
            <h2 id="modal-create-title" style={{ margin: "0 0 1.25rem 0", fontSize: "1.25rem", fontWeight: 600 }}>
              Create Alert Rule
            </h2>

            {formError && (
              <div style={{ marginBottom: "1rem" }}>
                <InlineAlert message={formError} kind="error" id="create-alert-error" />
              </div>
            )}

            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <label htmlFor="create-rule-name" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                  Rule Name *
                </label>
                <input
                  id="create-rule-name"
                  type="text"
                  required
                  maxLength={160}
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. High Change Failure Rate Alert"
                  style={{
                    width: "100%",
                    padding: "0.55rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <label htmlFor="create-rule-repo" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                  Repository *
                </label>
                <select
                  id="create-rule-repo"
                  required
                  value={repositoryId}
                  onChange={(e) => setRepositoryId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.55rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                >
                  {repositories.map((repo) => (
                    <option key={repo.id} value={repo.id}>
                      {repo.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <label htmlFor="create-rule-metric" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                  Metric to Evaluate *
                </label>
                <select
                  id="create-rule-metric"
                  required
                  value={metricType}
                  onChange={(e) => setMetricType(e.target.value as AlertMetricType)}
                  style={{
                    width: "100%",
                    padding: "0.55rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                >
                  {METRIC_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem", display: "block" }}>
                  {METRIC_OPTIONS.find((m) => m.value === metricType)?.description}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label htmlFor="create-rule-comparator" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                    Comparator *
                  </label>
                  <select
                    id="create-rule-comparator"
                    required
                    value={comparator}
                    onChange={(e) => setComparator(e.target.value as AlertComparator)}
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color)",
                      backgroundColor: "var(--input-bg)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {COMPARATOR_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label htmlFor="create-rule-threshold" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                    Threshold ({METRIC_OPTIONS.find((m) => m.value === metricType)?.unit ?? "val"}) *
                  </label>
                  <input
                    id="create-rule-threshold"
                    type="number"
                    step="any"
                    required
                    value={thresholdValue}
                    onChange={(e) => setThresholdValue(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color)",
                      backgroundColor: "var(--input-bg)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label htmlFor="create-rule-window" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                    Evaluation Window (Hours) *
                  </label>
                  <input
                    id="create-rule-window"
                    type="number"
                    min={0.01}
                    step="any"
                    required
                    value={evaluationWindowHours}
                    onChange={(e) => setEvaluationWindowHours(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color)",
                      backgroundColor: "var(--input-bg)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label htmlFor="create-rule-cooldown" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                    Cooldown Period (Hours) *
                  </label>
                  <input
                    id="create-rule-cooldown"
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={cooldownHours}
                    onChange={(e) => setCooldownHours(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color)",
                      backgroundColor: "var(--input-bg)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <label htmlFor="create-rule-destination" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                  Destination Email *
                </label>
                <input
                  id="create-rule-destination"
                  type="email"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.55rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                The enabled rule is evaluated after creation using data inside its selected window.
              </p>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
                <button
                  type="button"
                  className="button-link"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormError(null);
                  }}
                  disabled={submitting}
                  style={{ padding: "0.55rem 1rem" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={submitting}
                  style={{ padding: "0.55rem 1.25rem" }}
                >
                  {submitting ? "Creating..." : "Create Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Alert Rule */}
      {editingRule && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1.5rem",
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-edit-title"
        >
          <div
            style={{
              backgroundColor: "var(--card-bg)",
              border: "1px solid var(--border-color)",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "580px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "1.75rem",
              boxShadow: "var(--popover-shadow)",
            }}
          >
            <h2 id="modal-edit-title" style={{ margin: "0 0 1.25rem 0", fontSize: "1.25rem", fontWeight: 600 }}>
              Edit Alert Rule: {editingRule.name}
            </h2>

            {formError && (
              <div style={{ marginBottom: "1rem" }}>
                <InlineAlert message={formError} kind="error" id="edit-alert-error" />
              </div>
            )}

            <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <label htmlFor="edit-rule-name" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                  Rule Name *
                </label>
                <input
                  id="edit-rule-name"
                  type="text"
                  required
                  maxLength={160}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.55rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label htmlFor="edit-rule-comparator" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                    Comparator *
                  </label>
                  <select
                    id="edit-rule-comparator"
                    required
                    value={editComparator}
                    onChange={(e) => setEditComparator(e.target.value as AlertComparator)}
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color)",
                      backgroundColor: "var(--input-bg)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {COMPARATOR_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label htmlFor="edit-rule-threshold" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                    Threshold Value *
                  </label>
                  <input
                    id="edit-rule-threshold"
                    type="number"
                    step="any"
                    required
                    value={editThresholdValue}
                    onChange={(e) => setEditThresholdValue(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color)",
                      backgroundColor: "var(--input-bg)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label htmlFor="edit-rule-window" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                    Evaluation Window (Hours) *
                  </label>
                  <input
                    id="edit-rule-window"
                    type="number"
                    min={0.01}
                    step="any"
                    required
                    value={editEvaluationWindowHours}
                    onChange={(e) => setEditEvaluationWindowHours(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color)",
                      backgroundColor: "var(--input-bg)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label htmlFor="edit-rule-cooldown" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                    Cooldown Period (Hours) *
                  </label>
                  <input
                    id="edit-rule-cooldown"
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={editCooldownHours}
                    onChange={(e) => setEditCooldownHours(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color)",
                      backgroundColor: "var(--input-bg)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <label htmlFor="edit-rule-destination" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                  Destination Email *
                </label>
                <input
                  id="edit-rule-destination"
                  type="email"
                  required
                  value={editDestination}
                  onChange={(e) => setEditDestination(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.55rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  id="edit-rule-enabled"
                  type="checkbox"
                  checked={editEnabled}
                  onChange={(e) => setEditEnabled(e.target.checked)}
                />
                <label htmlFor="edit-rule-enabled" style={{ fontSize: "0.875rem", cursor: "pointer" }}>
                  Rule enabled and active for evaluation
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
                <button
                  type="button"
                  className="button-link"
                  onClick={() => {
                    setEditingRule(null);
                    setFormError(null);
                  }}
                  disabled={submitting}
                  style={{ padding: "0.55rem 1rem" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={submitting}
                  style={{ padding: "0.55rem 1.25rem" }}
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
