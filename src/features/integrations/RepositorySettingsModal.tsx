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
          <div style={{ padding: "0.75rem", border: "1px solid var(--border-color, #3b3b54)", borderRadius: "6px" }}>
            <p style={{ ...helpTextStyle, margin: 0 }}>
              Choose the GitHub event that confirms a production deployment. Check these defaults against your repository's delivery process.
            </p>
            <p style={helpTextStyle}>
              Patterns ignore letter case. Separate values with commas; <code>*</code> matches any text.
              For example, <code>*deploy*</code> matches <code>Deploy Production</code>.
            </p>
          </div>
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
                ? "Counts completed workflow runs matching the branch and workflow name below. Use this when a successful run means production is live. Runs that only test, build images, or skip deployment can produce misleading metrics."
                : "Counts GitHub deployment success or failure statuses for the environments below. Your delivery process must report its rollout result to GitHub. Works with any hosting provider, including AWS and Railway."}
            </p>
            {deploymentSignal === "WORKFLOW_RUN" && (
              <p style={helpTextStyle}>
                If your workflow has a separate deployment job with a GitHub environment, consider GitHub Deployment API Event to track that job's rollout result.
              </p>
            )}
          </div>

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
                Match the branch of the workflow run, for example <code>main</code> or <code>release/*</code>.
                Both this branch and the workflow name must match. Deployment API events use environment names instead.
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
                Use the environment name recorded in GitHub Deployments. For a deployment job with <code>environment: production</code>,
                enter <code>production</code>, even if the job is called <code>deploy</code>.
                Workflow names and branch patterns do not filter these events.
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
                Use the workflow's top-level <code>name:</code> shown in GitHub Actions.
                For <code>name: CI</code> with a job called <code>deploy</code>, the matching value is <code>CI</code>.
                Individual job and step names are not matched. Only choose <code>CI</code> if its successful runs actually deploy to production.
              </p>
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
                ? "Exclude matching workflow names, even if the branch and workflow patterns above match."
                : "Exclude matching deployment environments, even if the production environment patterns above match."}
              {" "}For example, <code>*staging*</code> or <code>*preview*</code>. Leave empty to exclude nothing.
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
                Failed production deployments create incidents. The next success records their recovery time. Jira issues are not used for DORA incidents yet.
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
                Saved grouping preference. The dashboard currently uses daily points for 7/30 days and weekly points for 90 days, regardless of this preference.
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
                How much past PR and deployment history to import from the GitHub API during a rebuild. This is separate from the dashboard's date range; new events arrive through webhooks.
              </p>
            </div>
          </div>

          <p style={helpTextStyle}>
            {repository.trackingEnabled && !repository.archived
              ? "Saving changed settings automatically queues a DORA rebuild for this repository. Wait for processing to finish, then refresh the dashboard. No separate rebuild click is needed."
              : "Settings are saved now. History is imported when tracking is enabled for a non-archived repository."}
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
