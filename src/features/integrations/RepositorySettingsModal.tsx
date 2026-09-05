import { useState, type CSSProperties } from "react";
import type { RepositoryResponse, RepositorySettings, DeploymentSignal, MetricGranularity } from "./api.js";

const helpTextStyle: CSSProperties = {
  fontSize: "0.8rem",
  color: "var(--text-secondary, #94a3b8)",
  lineHeight: 1.5,
  margin: "0.35rem 0 0",
};

interface RepositorySettingsModalProps {
  repository: RepositoryResponse;
  onClose: () => void;
  onSave: (settings: Partial<RepositorySettings>) => Promise<void>;
}

export function RepositorySettingsModal({
  repository,
  onClose,
  onSave,
}: RepositorySettingsModalProps) {
  const current = repository.settings;

  const [deploymentSignal, setDeploymentSignal] = useState<DeploymentSignal>(
    current?.deploymentSignal ?? "WORKFLOW_RUN"
  );
  const [productionBranchPatterns, setProductionBranchPatterns] = useState<string>(
    (current?.productionBranchPatterns ?? ["main", "master", "release/*"]).join(", ")
  );
  const [productionEnvironmentPatterns, setProductionEnvironmentPatterns] = useState<string>(
    (current?.productionEnvironmentPatterns ?? ["production", "prod", "live"]).join(", ")
  );
  const [deploymentWorkflowNamePatterns, setDeploymentWorkflowNamePatterns] = useState<string>(
    (current?.deploymentWorkflowNamePatterns ?? ["*deploy*", "*production*", "*release*"]).join(", ")
  );
  const [incidentSource, setIncidentSource] = useState<"GITHUB" | "JIRA" | "MANUAL" | "BOTH">(
    current?.incidentSource ?? "GITHUB"
  );
  const [doraExclusions, setDoraExclusions] = useState<string>(
    (current?.doraExclusions ?? []).join(", ")
  );
  const [defaultMetricGranularity, setDefaultMetricGranularity] = useState<MetricGranularity>(
    current?.defaultMetricGranularity ?? "WEEK"
  );
  const [backfillDays, setBackfillDays] = useState<number>(current?.backfillDays ?? 90);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const parseList = (val: string) =>
      val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    try {
      await onSave({
        deploymentSignal,
        productionBranchPatterns: parseList(productionBranchPatterns),
        productionEnvironmentPatterns: parseList(productionEnvironmentPatterns),
        deploymentWorkflowNamePatterns: parseList(deploymentWorkflowNamePatterns),
        incidentSource,
        doraExclusions: parseList(doraExclusions),
        defaultMetricGranularity,
        backfillDays: Number(backfillDays),
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update repository settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        className="modal-card"
        style={{
          backgroundColor: "var(--card-bg, #1a1a24)",
          border: "1px solid var(--border-color, #2d2d3d)",
          borderRadius: "8px",
          padding: "1.5rem",
          maxWidth: "580px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
              Repository Settings
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary, #94a3b8)", margin: "0.25rem 0 0 0" }}>
              {repository.fullName}
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", color: "var(--text-secondary, #94a3b8)", cursor: "pointer", fontSize: "1.2rem" }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: "0.75rem",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid #ef4444",
              borderRadius: "6px",
              color: "#f87171",
              fontSize: "0.85rem",
              marginBottom: "1rem",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label htmlFor="repository-deployment-signal" style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.25rem" }}>
              Deployment Signal Type
            </label>
            <select
              id="repository-deployment-signal"
              aria-describedby="repository-deployment-signal-help"
              value={deploymentSignal}
              onChange={(e) => setDeploymentSignal(e.target.value as DeploymentSignal)}
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: "6px",
                backgroundColor: "var(--input-bg, #242436)",
                border: "1px solid var(--border-color, #3b3b54)",
                color: "var(--text-primary, #ffffff)",
              }}
            >
              <option value="WORKFLOW_RUN">GitHub Actions Workflow Run</option>
              <option value="DEPLOYMENT">GitHub Deployment API Event</option>
            </select>
            <p id="repository-deployment-signal-help" style={helpTextStyle}>
              {deploymentSignal === "WORKFLOW_RUN"
                ? "Use when a successful workflow run means production is live."
                : "Use when your deployment reports success or failure to GitHub."}
            </p>
          </div>

          <p style={helpTextStyle}>
            Patterns ignore case. Separate with commas; <code>*</code> matches any text.
          </p>

          {deploymentSignal === "WORKFLOW_RUN" && (
            <div>
              <label htmlFor="repository-production-branches" style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.25rem" }}>
                Production Branch Patterns
              </label>
              <input
                id="repository-production-branches"
                aria-describedby="repository-production-branches-help"
                type="text"
                value={productionBranchPatterns}
                onChange={(e) => setProductionBranchPatterns(e.target.value)}
                placeholder="main, master, release/*"
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "6px",
                  backgroundColor: "var(--input-bg, #242436)",
                  border: "1px solid var(--border-color, #3b3b54)",
                  color: "var(--text-primary, #ffffff)",
                }}
              />
              <p id="repository-production-branches-help" style={helpTextStyle}>
                Match production branches, e.g. <code>main</code> or <code>release/*</code>.
              </p>
            </div>
          )}

          {deploymentSignal === "DEPLOYMENT" && (
            <div>
              <label htmlFor="repository-production-environments" style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.25rem" }}>
                Production Environment Patterns
              </label>
              <input
                id="repository-production-environments"
                aria-describedby="repository-production-environments-help"
                type="text"
                value={productionEnvironmentPatterns}
                onChange={(e) => setProductionEnvironmentPatterns(e.target.value)}
                placeholder="production, prod, live"
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "6px",
                  backgroundColor: "var(--input-bg, #242436)",
                  border: "1px solid var(--border-color, #3b3b54)",
                  color: "var(--text-primary, #ffffff)",
                }}
              />
              <p id="repository-production-environments-help" style={helpTextStyle}>
                Match the GitHub deployment environment, e.g. <code>production</code>.
              </p>
            </div>
          )}

          {deploymentSignal === "WORKFLOW_RUN" && (
            <div>
              <label htmlFor="repository-deployment-workflows" style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.25rem" }}>
                Deployment Workflow Name Patterns
              </label>
              <input
                id="repository-deployment-workflows"
                aria-describedby="repository-deployment-workflows-help"
                type="text"
                value={deploymentWorkflowNamePatterns}
                onChange={(e) => setDeploymentWorkflowNamePatterns(e.target.value)}
                placeholder="Deploy Production, *deploy*"
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "6px",
                  backgroundColor: "var(--input-bg, #242436)",
                  border: "1px solid var(--border-color, #3b3b54)",
                  color: "var(--text-primary, #ffffff)",
                }}
              />
              <p id="repository-deployment-workflows-help" style={helpTextStyle}>
                Match the workflow name in GitHub Actions, not a job or step name.
              </p>
              <details style={helpTextStyle}>
                <summary style={{ cursor: "pointer", color: "var(--text-primary, #ffffff)" }}>See example</summary>
                <p style={helpTextStyle}>
                  Workflow <code>name: CI</code> with a job called <code>deploy</code>: enter <code>CI</code>.
                  Use only if successful runs deploy to production.
                </p>
              </details>
            </div>
          )}

          <div>
            <label
              htmlFor="repository-dora-exclusions"
              style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.25rem" }}
            >
              DORA Exclusions
            </label>
            <input
              id="repository-dora-exclusions"
              aria-describedby="repository-dora-exclusions-help"
              type="text"
              value={doraExclusions}
              onChange={(e) => setDoraExclusions(e.target.value)}
              placeholder="*preview*, *staging*"
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: "6px",
                backgroundColor: "var(--input-bg, #242436)",
                border: "1px solid var(--border-color, #3b3b54)",
                color: "var(--text-primary, #ffffff)",
              }}
            />
            <p id="repository-dora-exclusions-help" style={helpTextStyle}>
              {deploymentSignal === "WORKFLOW_RUN"
                ? "Ignore matching workflow names. Leave empty to exclude nothing."
                : "Ignore matching environments. Leave empty to exclude nothing."}
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 14rem), 1fr))", gap: "1rem" }}>
            <div style={{ minWidth: 0 }}>
              <label htmlFor="repository-incident-source" style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.25rem" }}>
                Incident Source
              </label>
              <select
                id="repository-incident-source"
                aria-describedby="repository-incident-source-help"
                value={incidentSource}
                onChange={(e) => setIncidentSource(e.target.value as "GITHUB" | "JIRA" | "MANUAL" | "BOTH")}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "6px",
                  backgroundColor: "var(--input-bg, #242436)",
                  border: "1px solid var(--border-color, #3b3b54)",
                  color: "var(--text-primary, #ffffff)",
                }}
              >
                <option value="GITHUB">GitHub deployment outcomes</option>
                <option value="BOTH" disabled>GitHub & Jira (Phase 9)</option>
                <option value="JIRA" disabled>Jira incidents (Phase 9)</option>
                <option value="MANUAL" disabled>Manual incidents (Phase 9)</option>
              </select>
              <p id="repository-incident-source-help" style={helpTextStyle}>
                Tracks failed deployments until the next successful deployment.
              </p>
            </div>

            <div style={{ minWidth: 0 }}>
              <label htmlFor="repository-metric-granularity" style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.25rem" }}>
                Metric Granularity
              </label>
              <select
                id="repository-metric-granularity"
                aria-describedby="repository-metric-granularity-help"
                value={defaultMetricGranularity}
                onChange={(e) => setDefaultMetricGranularity(e.target.value as MetricGranularity)}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "6px",
                  backgroundColor: "var(--input-bg, #242436)",
                  border: "1px solid var(--border-color, #3b3b54)",
                  color: "var(--text-primary, #ffffff)",
                }}
              >
                <option value="DAY">Day</option>
                <option value="WEEK">Week (Default)</option>
                <option value="MONTH">Month</option>
              </select>
              <p id="repository-metric-granularity-help" style={helpTextStyle}>
                Saved preference; dashboard chart grouping follows its selected period instead.
              </p>
            </div>

            <div style={{ minWidth: 0 }}>
              <label htmlFor="repository-backfill-days" style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.25rem" }}>
                Backfill Duration (Days)
              </label>
              <select
                id="repository-backfill-days"
                aria-describedby="repository-backfill-days-help"
                value={backfillDays}
                onChange={(e) => setBackfillDays(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "6px",
                  backgroundColor: "var(--input-bg, #242436)",
                  border: "1px solid var(--border-color, #3b3b54)",
                  color: "var(--text-primary, #ffffff)",
                }}
              >
                <option value={30}>30 Days</option>
                <option value={60}>60 Days</option>
                <option value={90}>90 Days (Default)</option>
                <option value={180}>180 Days</option>
                <option value={365}>1 Year</option>
              </select>
              <p id="repository-backfill-days-help" style={helpTextStyle}>
                Days of past PR and deployment history to import.
              </p>
            </div>
          </div>

          <p style={helpTextStyle}>
            {repository.trackingEnabled && !repository.archived
              ? "Saving changes automatically queues a DORA rebuild."
              : "History imports when the repository is tracked and not archived."}
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <button
              type="button"
              className="button-link"
              onClick={onClose}
              disabled={saving}
              style={{ padding: "0.5rem 1rem" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={saving}
              style={{ padding: "0.5rem 1.25rem" }}
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
