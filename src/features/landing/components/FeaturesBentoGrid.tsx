import { useState } from "react";

export function FeaturesBentoGrid() {
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "90d">("30d");

  return (
    <section className="landing-section" id="features">
      <div className="landing-content-wrap">
        {/* Section Header */}
        <div className="landing-section-header">
          <div className="landing-eyebrow">
            <span className="landing-eyebrow-pill" aria-hidden="true" />
            <span>Comprehensive Platform Architecture</span>
          </div>
          <h2 className="landing-section-title">
            Built for Elite Engineering <span className="landing-gradient-text">Teams and Leaders.</span>
          </h2>
          <p className="landing-section-desc">
            Adept eliminates manual spreadsheets, subjective velocity guesses, and review bottlenecks
            with automated telemetry and actionable engineering intelligence.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="bento-grid">
          {/* Bento Card 1: DORA Metrics Engine (Large 2-column) */}
          <div className="bento-card bento-card-large" id="dora-metrics">
            <div>
              <div className="bento-icon-wrapper">📊</div>
              <h3 className="bento-card-title">Automated 4 DORA Metrics Calculation</h3>
              <p className="bento-card-desc">
                Real-time tracking of Deployment Frequency, Lead Time for Changes, Mean Time to Recovery (MTTR),
                and Change Failure Rate. Normalized across multi-repo projects and categorized into industry percentiles.
              </p>
            </div>

            <div className="bento-card-visual">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <span style={{ color: "var(--landing-text-secondary)", fontWeight: 600 }}>DORA Velocity Curve</span>
                <div style={{ display: "flex", gap: "0.25rem" }}>
                  {(["7d", "30d", "90d"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTimeframe(t)}
                      style={{
                        background: timeframe === t ? "var(--landing-primary)" : "transparent",
                        color: timeframe === t ? "#ffffff" : "var(--landing-text-muted)",
                        border: "none",
                        borderRadius: "0.25rem",
                        padding: "0.15rem 0.45rem",
                        fontSize: "0.7rem",
                        cursor: "pointer",
                        minHeight: "auto",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visual mini-bar simulation */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", height: "64px", padding: "0.5rem 0" }}>
                <div style={{ flex: 1, background: "rgba(99, 102, 241, 0.3)", height: "45%", borderRadius: "2px" }} />
                <div style={{ flex: 1, background: "rgba(99, 102, 241, 0.4)", height: "60%", borderRadius: "2px" }} />
                <div style={{ flex: 1, background: "rgba(99, 102, 241, 0.5)", height: "75%", borderRadius: "2px" }} />
                <div style={{ flex: 1, background: "rgba(99, 102, 241, 0.7)", height: "65%", borderRadius: "2px" }} />
                <div style={{ flex: 1, background: "rgba(99, 102, 241, 0.8)", height: "85%", borderRadius: "2px" }} />
                <div style={{ flex: 1, background: "var(--landing-emerald)", height: "95%", borderRadius: "2px", boxShadow: "0 0 10px rgba(16, 185, 129, 0.5)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--landing-text-muted)", marginTop: "0.25rem" }}>
                <span>Past Period: 12.1/wk</span>
                <span style={{ color: "var(--landing-emerald)", fontWeight: 700 }}>Current: 18.4/wk (Elite)</span>
              </div>
            </div>
          </div>

          {/* Bento Card 2: JIT-Fine PR Review Risk */}
          <div className="bento-card" id="pr-risk">
            <div>
              <div className="bento-icon-wrapper">🛡️</div>
              <h3 className="bento-card-title">JIT-Fine PR Review Risk Engine</h3>
              <p className="bento-card-desc">
                Machine learning model evaluating code churn, file entropy, and bug-fix patterns.
                Fast-tracks routine PRs and pinpoints high-risk changes before merging.
              </p>
            </div>

            <div className="bento-card-visual" style={{ borderLeft: "3px solid var(--landing-emerald)" }}>
              <div style={{ color: "#ffffff", fontWeight: 700, marginBottom: "0.25rem" }}>Low Risk PR Identified</div>
              <div style={{ color: "var(--landing-text-muted)", fontSize: "0.75rem" }}>
                Entropy: 0.14 • Churn: Low • Bug Keywords: 0
              </div>
              <div style={{ color: "var(--landing-emerald)", fontSize: "0.75rem", marginTop: "0.35rem", fontWeight: 600 }}>
                ⚡ Recommended for instant peer review
              </div>
            </div>
          </div>

          {/* Bento Card 3: GitHub & Jira 3LO */}
          <div className="bento-card">
            <div>
              <div className="bento-icon-wrapper">🔗</div>
              <h3 className="bento-card-title">Zero-Secret-Leak Provider Sync</h3>
              <p className="bento-card-desc">
                Direct integration with GitHub App RS256 JWT tokens and Atlassian Jira Cloud OAuth 2.0 (3LO)
                with AES-256-GCM token encryption. Tokens never leak into URLs or logs.
              </p>
            </div>

            <div className="bento-card-visual" style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "var(--landing-text-secondary)" }}>
              <div>&gt; GitHub JWT generated (in-memory)</div>
              <div>&gt; Jira PKCE state validated</div>
              <div>&gt; AES-256-GCM ciphertext persisted</div>
              <div style={{ color: "var(--landing-emerald)" }}>&gt; Webhook delivery: OK</div>
            </div>
          </div>

          {/* Bento Card 4: Proactive Alerts */}
          <div className="bento-card">
            <div>
              <div className="bento-icon-wrapper">🔔</div>
              <h3 className="bento-card-title">Real-Time SLA & Alert Rules</h3>
              <p className="bento-card-desc">
                Configurable threshold triggers for MTTR spikes, deployment failures, and high-risk PR merges.
                Transactional cooldown prevents notification fatigue.
              </p>
            </div>

            <div className="bento-card-visual" style={{ borderLeft: "3px solid var(--landing-amber)" }}>
              <div style={{ color: "#ffffff", fontWeight: 700 }}>Rule: MTTR &gt; 60m</div>
              <div style={{ color: "var(--landing-text-muted)", fontSize: "0.75rem" }}>
                Target: dev-leads@adeptindustries.dev
              </div>
              <div style={{ color: "var(--landing-amber)", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                Cooldown: 60 min transactional lock
              </div>
            </div>
          </div>

          {/* Bento Card 5: Role-Based Workspace Isolation */}
          <div className="bento-card">
            <div>
              <div className="bento-icon-wrapper">👥</div>
              <h3 className="bento-card-title">Manager & Lead Workspace Roles</h3>
              <p className="bento-card-desc">
                Multi-tenant isolation. Workspace Managers govern global settings and billing, while
                Leads access only assigned repositories and related project telemetry.
              </p>
            </div>

            <div className="bento-card-visual" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ color: "#ffffff", fontWeight: 700 }}>Manager</span>
                <span style={{ color: "var(--landing-text-muted)", display: "block", fontSize: "0.7rem" }}>All Repositories</span>
              </div>
              <span style={{ color: "var(--landing-primary-light)" }}>⇄</span>
              <div>
                <span style={{ color: "var(--landing-primary-light)", fontWeight: 700 }}>Lead</span>
                <span style={{ color: "var(--landing-text-muted)", display: "block", fontSize: "0.7rem" }}>Scoped Repositories</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
