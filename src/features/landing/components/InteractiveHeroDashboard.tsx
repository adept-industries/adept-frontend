import { useState } from "react";

export function InteractiveHeroDashboard() {
  const [activeTab, setActiveTab] = useState<"dora" | "risk">("dora");

  return (
    <div className="hero-showcase-container">
      {/* Background radial glow */}
      <div className="hero-showcase-glow" aria-hidden="true" />

      {/* Main glassmorphic container */}
      <div className="hero-dashboard-frame">
        {/* Top OS-style frame bar */}
        <div className="hero-frame-topbar">
          <div className="hero-frame-dots">
            <span className="hero-frame-dot red" />
            <span className="hero-frame-dot yellow" />
            <span className="hero-frame-dot green" />
          </div>

          <div className="hero-frame-title">
            app.adeptindustries.dev/analytics • live telemetry
          </div>

          <div className="hero-frame-sync-pill">
            <span className="landing-status-dot" aria-hidden="true" />
            <span>GitHub App & Jira Synced</span>
          </div>
        </div>

        {/* Dashboard inner content */}
        <div className="hero-dashboard-body">
          {/* Sub-nav switcher inside dashboard */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
            <button
              type="button"
              onClick={() => setActiveTab("dora")}
              className="landing-btn-ghost"
              style={{
                background: activeTab === "dora" ? "rgba(99, 102, 241, 0.18)" : "transparent",
                borderColor: activeTab === "dora" ? "rgba(99, 102, 241, 0.5)" : "transparent",
                color: activeTab === "dora" ? "#818cf8" : "var(--landing-text-secondary)",
                padding: "0.35rem 0.85rem",
                fontSize: "0.8rem",
                minHeight: "auto",
              }}
            >
              ⚡ DORA Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("risk")}
              className="landing-btn-ghost"
              style={{
                background: activeTab === "risk" ? "rgba(99, 102, 241, 0.18)" : "transparent",
                borderColor: activeTab === "risk" ? "rgba(99, 102, 241, 0.5)" : "transparent",
                color: activeTab === "risk" ? "#818cf8" : "var(--landing-text-secondary)",
                padding: "0.35rem 0.85rem",
                fontSize: "0.8rem",
                minHeight: "auto",
              }}
            >
              🛡️ PR Risk Radar
            </button>
          </div>

          {/* 4 DORA Metrics Showcase Grid */}
          <div className="dora-showcase-grid">
            <div className="dora-showcase-card">
              <span className="dora-card-badge badge-elite">Elite Tier</span>
              <div className="dora-card-label">Deployment Frequency</div>
              <div className="dora-card-val">18.4 / wk</div>
              <div className="dora-card-trend">
                <span>↑ 24%</span>
                <span style={{ color: "var(--landing-text-muted)", fontWeight: 400 }}>vs last cycle</span>
              </div>
            </div>

            <div className="dora-showcase-card">
              <span className="dora-card-badge badge-elite">Top 5%</span>
              <div className="dora-card-label">Lead Time for Changes</div>
              <div className="dora-card-val">1.4 hrs</div>
              <div className="dora-card-trend">
                <span>↓ 42m</span>
                <span style={{ color: "var(--landing-text-muted)", fontWeight: 400 }}>cycle time</span>
              </div>
            </div>

            <div className="dora-showcase-card">
              <span className="dora-card-badge badge-elite">Sub-Hour</span>
              <div className="dora-card-label">Mean Time to Recovery</div>
              <div className="dora-card-val">18 mins</div>
              <div className="dora-card-trend">
                <span>✓ 0 active</span>
                <span style={{ color: "var(--landing-text-muted)", fontWeight: 400 }}>incidents</span>
              </div>
            </div>

            <div className="dora-showcase-card">
              <span className="dora-card-badge badge-high">Low Risk</span>
              <div className="dora-card-label">Change Failure Rate</div>
              <div className="dora-card-val">1.2%</div>
              <div className="dora-card-trend">
                <span>98.8%</span>
                <span style={{ color: "var(--landing-text-muted)", fontWeight: 400 }}>success rate</span>
              </div>
            </div>
          </div>

          {/* Secondary Panel: PR Review Risk Engine Preview & Activity */}
          <div className="hero-secondary-grid">
            <div className="hero-panel-card">
              <div className="hero-panel-title-bar">
                <span className="hero-panel-title">
                  <span style={{ color: "var(--landing-primary-light)" }}>●</span> JIT-Fine PR Review Risk Detection
                </span>
                <span style={{ fontSize: "0.7rem", color: "var(--landing-text-muted)" }}>ML Model v2.1</span>
              </div>

              <div className="pr-risk-item">
                <div>
                  <div className="pr-risk-title">
                    <span className="pr-num">#402</span> Auth session coordinator refactor
                  </div>
                  <div className="pr-risk-meta">
                    adept-frontend • 4 files • +84 / -12 lines
                  </div>
                </div>
                <div className="pr-risk-score-badge">
                  <span className="score-tag score-low">12% LOW RISK</span>
                  <span style={{ fontSize: "0.65rem", color: "var(--landing-emerald)" }}>✓ Auto-Approved</span>
                </div>
              </div>

              <div className="pr-risk-item">
                <div>
                  <div className="pr-risk-title">
                    <span className="pr-num">#398</span> Flyway V12 migration & multi-site sync
                  </div>
                  <div className="pr-risk-meta">
                    adept-api • 12 files • +312 / -45 lines • Schema change
                  </div>
                </div>
                <div className="pr-risk-score-badge">
                  <span className="score-tag score-med">48% MODERATE</span>
                  <span style={{ fontSize: "0.65rem", color: "var(--landing-amber)" }}>2 Reviews Required</span>
                </div>
              </div>
            </div>

            <div className="hero-panel-card">
              <div className="hero-panel-title-bar">
                <span className="hero-panel-title">
                  <span style={{ color: "var(--landing-emerald)" }}>●</span> Live Signal Ingestion
                </span>
                <span style={{ fontSize: "0.7rem", color: "var(--landing-text-muted)" }}>0s latency</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", fontSize: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--landing-text-secondary)" }}>
                  <span>GitHub Webhook (push: main)</span>
                  <span style={{ color: "var(--landing-emerald)", fontFamily: "monospace" }}>200 OK</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--landing-text-secondary)" }}>
                  <span>Jira Issue (PROJ-1044 resolved)</span>
                  <span style={{ color: "var(--landing-emerald)", fontFamily: "monospace" }}>Correlated</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--landing-text-secondary)" }}>
                  <span>Lightsail Production Deploy</span>
                  <span style={{ color: "var(--landing-primary-light)", fontFamily: "monospace" }}>Recorded</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--landing-text-secondary)" }}>
                  <span>DORA Aggregation Snapshot</span>
                  <span style={{ color: "var(--landing-emerald)", fontFamily: "monospace" }}>Updated</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
