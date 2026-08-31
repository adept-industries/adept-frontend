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

export function AlertsPage() {
  const { state } = useAuth();
  const isAuthenticated = state.status === "authenticated";
  const userEmail = isAuthenticated ? state.user.email : "";
  const workspaceTimezone = isAuthenticated ? state.currentMembership.timezone : "UTC";

  const [rules, setRules] = useState<AlertRuleResponse[]>([]);
  const [repositories, setRepositories] = useState<RepositoryResponse[]>([]);
  const [selectedRepoFilter, setSelectedRepoFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Create form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [repositoryId, setRepositoryId] = useState("");
  const [metricType, setMetricType] = useState<AlertMetricType>("CHANGE_FAILURE_RATE_PERCENT");
  const [comparator, setComparator] = useState<AlertComparator>("GT");
  const [thresholdValue, setThresholdValue] = useState<string>("15.0");
  const [evaluationWindowMinutes, setEvaluationWindowMinutes] = useState<number>(1440);
  const [cooldownMinutes, setCooldownMinutes] = useState<number>(1440);
  const [destination, setDestination] = useState("");

  // Edit state
  const [editingRule, setEditingRule] = useState<AlertRuleResponse | null>(null);
  const [editName, setEditName] = useState("");
  const [editComparator, setEditComparator] = useState<AlertComparator>("GT");
  const [editThresholdValue, setEditThresholdValue] = useState<string>("");
  const [editEvaluationWindowMinutes, setEditEvaluationWindowMinutes] = useState<number>(1440);
  const [editCooldownMinutes, setEditCooldownMinutes] = useState<number>(1440);
  const [editDestination, setEditDestination] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);

  const fetchCatalog = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [fetchedRules, fetchedRepos] = await Promise.all([
        listAlertRules(selectedRepoFilter === "ALL" ? undefined : selectedRepoFilter),
        listRepositories(true).catch(() => []),
      ]);
      setRules(fetchedRules);
      const activeRepos = (fetchedRepos ?? []).filter((r) => r.trackingEnabled && !r.archived);
      setRepositories(activeRepos);
      if (activeRepos.length > 0 && !repositoryId) {
        setRepositoryId(activeRepos[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load alert rules.");
    } finally {
      setLoading(false);
    }
  }, [selectedRepoFilter, repositoryId]);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchCatalog();
    }
  }, [fetchCatalog, isAuthenticated]);

  const handleOpenCreateModal = () => {
    setRuleName("");
    setMetricType("CHANGE_FAILURE_RATE_PERCENT");
    setComparator("GT");
    setThresholdValue("15.0");
    setEvaluationWindowMinutes(1440);
    setCooldownMinutes(1440);
    setDestination(userEmail);
    if (repositories.length > 0) {
      setRepositoryId(selectedRepoFilter !== "ALL" ? selectedRepoFilter : repositories[0].id);
    }
    setError(null);
    setShowCreateModal(true);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = ruleName.trim();
    if (!trimmedName || !repositoryId) return;

    const parsedThreshold = parseFloat(thresholdValue);
    if (isNaN(parsedThreshold)) {
      setError("Please provide a valid numeric threshold value.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createAlertRule({
        name: trimmedName,
        repositoryId,
        metricType,
        comparator,
        thresholdValue: parsedThreshold,
        evaluationWindowMinutes: Number(evaluationWindowMinutes) || 1440,
        cooldownMinutes: Number(cooldownMinutes) || 1440,
        destination: destination.trim() || userEmail,
        enabled: true,
        channel: "EMAIL",
      });
      setShowCreateModal(false);
      setSuccessMessage(`Alert rule "${trimmedName}" created successfully.`);
      await fetchCatalog();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create alert rule.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (rule: AlertRuleResponse) => {
    setEditingRule(rule);
    setEditName(rule.name);
    setEditComparator(rule.comparator);
    setEditThresholdValue(String(rule.thresholdValue));
    setEditEvaluationWindowMinutes(rule.evaluationWindowMinutes);
    setEditCooldownMinutes(rule.cooldownMinutes);
    setEditDestination(rule.destination);
    setEditEnabled(rule.enabled);
    setError(null);
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingRule) return;

    const parsedThreshold = parseFloat(editThresholdValue);
    if (isNaN(parsedThreshold)) {
      setError("Please provide a valid numeric threshold value.");
      return;
    }

    setSubmitting(true);
    setError(null);
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
      setError(err instanceof Error ? err.message : "Failed to update alert rule.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleEnabled = async (rule: AlertRuleResponse) => {
    try {
      setError(null);
      await updateAlertRule(rule.id, { enabled: !rule.enabled });
      await fetchCatalog();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to toggle rule state.");
    }
  };

  const handleDelete = async (rule: AlertRuleResponse) => {
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
          <p className="dash-welcome-eyebrow">Real-Time Threshold Monitoring</p>
          <h1 id="alerts-title" className="dash-welcome-title">Alert Rules</h1>
          <p className="dash-welcome-sub">
            Configure automated email notifications for your tracked repositories when DORA metrics or PR review risk exceed thresholds.
          </p>
        </div>

        <div className="dash-inline-controls">
          <button
            type="button"
            id="create-alert-btn"
            className="primary-button"
            onClick={handleOpenCreateModal}
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
          padding: "1rem 1.25rem",
          backgroundColor: "var(--card-bg)",
          borderRadius: "8px",
          border: "1px solid var(--border-color)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <label htmlFor="repo-filter" style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>
            Repository:
          </label>
          <select
            id="repo-filter"
            value={selectedRepoFilter}
            onChange={(e) => setSelectedRepoFilter(e.target.value)}
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--input-bg)",
              color: "var(--text-primary)",
              fontSize: "0.875rem",
            }}
          >
            <option value="ALL">All Accessible Repositories</option>
            {repositories.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.fullName}
              </option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          Total Rules: <strong style={{ color: "var(--text-primary)" }}>{rules.length}</strong>
          {" | "}
          Active: <strong style={{ color: "var(--primary)" }}>{rules.filter((r) => r.enabled).length}</strong>
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
            style={{ fontSize: "0.875rem", padding: "0.5rem 1rem" }}
          >
            Create Rule
          </button>
        </div>
      ) : (
        <div
          style={{
            overflowX: "auto",
            backgroundColor: "var(--card-bg)",
            borderRadius: "10px",
            border: "1px solid var(--border-color)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--surface-muted)" }}>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600 }}>Rule Name</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600 }}>Repository</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600 }}>Condition</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600 }}>Window / Cooldown</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600 }}>Destination</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600 }}>Status</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600 }}>Last Triggered</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const metricMeta = METRIC_OPTIONS.find((m) => m.value === rule.metricType);
                return (
                  <tr
                    key={rule.id}
                    style={{
                      borderBottom: "1px solid var(--border-color)",
                      opacity: rule.enabled ? 1 : 0.65,
                    }}
                  >
                    <td style={{ padding: "1rem", fontWeight: 500 }}>
                      <div style={{ color: "var(--text-primary)" }}>{rule.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        {metricMeta?.label ?? rule.metricType}
                      </div>
                    </td>
                    <td style={{ padding: "1rem", color: "var(--text-primary)" }}>
                      <code>{rule.repositoryFullName}</code>
                    </td>
                    <td style={{ padding: "1rem" }}>
                      <span
                        style={{
                          padding: "0.2rem 0.5rem",
                          borderRadius: "4px",
                          backgroundColor: "var(--surface-muted)",
                          border: "1px solid var(--border-color)",
                          fontFamily: "monospace",
                        }}
                      >
                        {rule.comparator} {rule.thresholdValue} {metricMeta?.unit}
                      </span>
                    </td>
                    <td style={{ padding: "1rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      <div>Window: {rule.evaluationWindowMinutes}m</div>
                      <div>Cooldown: {rule.cooldownMinutes}m</div>
                    </td>
                    <td style={{ padding: "1rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                      {rule.destination}
                    </td>
                    <td style={{ padding: "1rem" }}>
                      <button
                        type="button"
                        onClick={() => handleToggleEnabled(rule)}
                        style={{
                          padding: "0.25rem 0.6rem",
                          borderRadius: "9999px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          border: "none",
                          backgroundColor: rule.enabled ? "rgba(16, 185, 129, 0.15)" : "var(--surface-muted)",
                          color: rule.enabled ? "#10b981" : "var(--text-secondary)",
                        }}
                        title="Click to toggle rule status"
                      >
                        {rule.enabled ? "Active" : "Disabled"}
                      </button>
                    </td>
                    <td style={{ padding: "1rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      {rule.lastTriggeredAt
                        ? formatWorkspaceDateTime(rule.lastTriggeredAt, workspaceTimezone)
                        : "Never"}
                    </td>
                    <td style={{ padding: "1rem", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                        <button
                          type="button"
                          className="button-link"
                          onClick={() => handleStartEdit(rule)}
                          style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="button-link"
                          onClick={() => handleDelete(rule)}
                          style={{ fontSize: "0.8rem", color: "var(--danger-color)", padding: "0.3rem 0.6rem" }}
                        >
                          Delete
                        </button>
                      </div>
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
                    Evaluation Window (Minutes) *
                  </label>
                  <input
                    id="create-rule-window"
                    type="number"
                    min={1}
                    required
                    value={evaluationWindowMinutes}
                    onChange={(e) => setEvaluationWindowMinutes(parseInt(e.target.value, 10) || 1440)}
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
                    Cooldown Period (Minutes) *
                  </label>
                  <input
                    id="create-rule-cooldown"
                    type="number"
                    min={0}
                    required
                    value={cooldownMinutes}
                    onChange={(e) => setCooldownMinutes(parseInt(e.target.value, 10) || 0)}
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

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
                <button
                  type="button"
                  className="button-link"
                  onClick={() => setShowCreateModal(false)}
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
                    Evaluation Window (Minutes) *
                  </label>
                  <input
                    id="edit-rule-window"
                    type="number"
                    min={1}
                    required
                    value={editEvaluationWindowMinutes}
                    onChange={(e) => setEditEvaluationWindowMinutes(parseInt(e.target.value, 10) || 1440)}
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
                    Cooldown Period (Minutes) *
                  </label>
                  <input
                    id="edit-rule-cooldown"
                    type="number"
                    min={0}
                    required
                    value={editCooldownMinutes}
                    onChange={(e) => setEditCooldownMinutes(parseInt(e.target.value, 10) || 0)}
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
                  onClick={() => setEditingRule(null)}
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
