import { useState } from "react";
import type { RepositoryResponse, RepositorySettings, DeploymentSignal, MetricGranularity } from "./api.js";

interface RepositorySettingsModalProps {
  repository: RepositoryResponse;
  onClose: () => void;
  onSave: (settings: Partial<RepositorySettings>) => Promise<void>;
  onRebuild: () => Promise<void>;
}

export function RepositorySettingsModal({
  repository,
  onClose,
  onSave,
  onRebuild,
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
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildQueued, setRebuildQueued] = useState(false);
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

  const handleRebuild = async () => {
    setRebuilding(true);
    setRebuildQueued(false);
    setError(null);
    try {
      await onRebuild();
      setRebuildQueued(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to queue DORA data rebuild");
    } finally {
      setRebuilding(false);
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
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.25rem" }}>
              Deployment Signal Type
            </label>
            <select
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
              <option value="DEPLOYMENT">GitHub Deployment API Event (AWS rollout)</option>
            </select>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary, #94a3b8)", display: "block", marginTop: "0.25rem" }}>
              Use Deployment API events when image publication and the live rollout are separate steps.
            </span>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.25rem" }}>
              Production Branch Patterns
            </label>
            <input
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
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary, #94a3b8)", display: "block", marginTop: "0.25rem" }}>
              Comma-separated globs to recognize production target branches.
            </span>
          </div>

          {deploymentSignal === "DEPLOYMENT" && (
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.25rem" }}>
                Production Environment Patterns
              </label>
              <input
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
            </div>
          )}

          {deploymentSignal === "WORKFLOW_RUN" && (
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.25rem" }}>
                Deployment Workflow Name Patterns
              </label>
              <input
                type="text"
                value={deploymentWorkflowNamePatterns}
                onChange={(e) => setDeploymentWorkflowNamePatterns(e.target.value)}
                placeholder="*deploy*, *production*, *release*"
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "6px",
                  backgroundColor: "var(--input-bg, #242436)",
                  border: "1px solid var(--border-color, #3b3b54)",
                  color: "var(--text-primary, #ffffff)",
                }}
              />
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
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary, #94a3b8)", display: "block", marginTop: "0.25rem" }}>
              Comma-separated workflow-name or deployment-environment globs to exclude.
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.25rem" }}>
                Incident Source
              </label>
              <select
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
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.25rem" }}>
                Metric Granularity
              </label>
              <select
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
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.25rem" }}>
                Backfill Duration (Days)
              </label>
              <select
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
            </div>
          </div>

          {rebuildQueued && (
            <div role="status" style={{ color: "var(--text-secondary, #94a3b8)", fontSize: "0.8rem" }}>
              DORA data rebuild queued.
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", marginTop: "1rem" }}>
            <button
              type="button"
              className="button-link"
              onClick={() => void handleRebuild()}
              disabled={saving || rebuilding || repository.archived || !repository.trackingEnabled}
              title={!repository.trackingEnabled ? "Enable tracking before rebuilding DORA data" : undefined}
              style={{ padding: "0.5rem 1rem" }}
            >
              {rebuilding ? "Queuing..." : "Rebuild DORA Data"}
            </button>
            <div style={{ display: "flex", gap: "0.75rem" }}>
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
          </div>
        </form>
      </div>
    </div>
  );
}
