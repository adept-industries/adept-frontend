import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../auth/AuthProvider";
import logoUrl from "../../assets/logo.png";
import "./LandingPage.css";

export function LandingPage() {
  const [activeFilter, setActiveFilter] = useState<"7d" | "30d" | "90d">("30d");
  const [email, setEmail] = useState("");
  const navigate = useNavigate();
  const { state: authState } = useAuth();
  const isAuthenticated = authState.status === "authenticated";

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      navigate(`/signup?email=${encodeURIComponent(email.trim())}`);
    } else {
      navigate("/signup");
    }
  };

  return (
    <div className="adept-landing-root">
      {/* Atmospheric Background Glow */}
      <div className="adept-bg-grid" aria-hidden="true" />
      <div className="adept-hero-glow" aria-hidden="true" />

      {/* SECTION 1: MINIMAL BRAND HEADER (Clean Bar) */}
      <header className="adept-header" role="banner">
        <div className="adept-header-inner">
          {/* Brand Link */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Link to="/" className="adept-brand-link">
              <img src={logoUrl} alt="Adept Logo" className="adept-logo-img" />
              <span className="adept-brand-text">Adept</span>
            </Link>
          </div>

          {/* Right Trailing Action */}
          <div className="adept-header-actions">
            {isAuthenticated ? (
              <Link to="/dashboard" className="adept-btn-white">
                <span>Console</span>
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }} aria-hidden="true">arrow_forward</span>
              </Link>
            ) : (
              <Link to="/login" className="adept-btn-white">
                <span>Log In</span>
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }} aria-hidden="true">arrow_forward</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT CONTAINER */}
      <main style={{ position: "relative", zIndex: 10 }}>
        {/* SECTION 2: HERO SECTION */}
        <section className="adept-hero-section">
          <div style={{ maxWidth: "56rem", margin: "0 auto 3.5rem" }}>
            {/* Main Headline */}
            <h1 className="adept-hero-title">
              Turn DevOps Signals into <br style={{ display: "inline" }} />
              <span className="adept-title-gradient">
                Unstoppable Engineering Velocity
              </span>
            </h1>

            {/* Subtitle */}
            <p className="adept-hero-subtitle">
              Adept seamlessly unifies GitHub, Jira Cloud, and CI/CD pipelines into automated real-time DORA metrics, machine-learning pull-request risk detection, and proactive SLA governance.
            </p>

            {/* Single Primary CTA Button */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Link to="/signup" className="adept-btn-white adept-btn-white-lg">
                <span>Start Free Trial</span>
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }} aria-hidden="true">arrow_forward</span>
              </Link>
            </div>
          </div>

          {/* Hero Showcase: Exact DORA Metrics Dashboard Component */}
          <div className="adept-dashboard-showcase">
            {/* Dashboard Header Controls */}
            <div className="adept-dash-topbar">
              <div>
                <h2 className="adept-dash-heading">DORA Metrics</h2>
              </div>
              <div className="adept-dash-controls">
                {/* Repository Selector */}
                <div className="adept-repo-select-wrap">
                  <span className="adept-repo-label">REPOSITORY</span>
                  <div style={{ position: "relative" }}>
                    <button type="button" className="adept-repo-btn">
                      <span>All repositories</span>
                      <span style={{ color: "#a3a3a3", fontSize: "10px" }}>▼</span>
                    </button>
                  </div>
                </div>

                {/* Segmented Filter Pills */}
                <div className="adept-pills-container">
                  <button
                    type="button"
                    onClick={() => setActiveFilter("7d")}
                    className={`adept-pill-btn ${activeFilter === "7d" ? "active" : ""}`}
                  >
                    Last 7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter("30d")}
                    className={`adept-pill-btn ${activeFilter === "30d" ? "active" : ""}`}
                  >
                    Last 30 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter("90d")}
                    className={`adept-pill-btn ${activeFilter === "90d" ? "active" : ""}`}
                  >
                    Last 90 Days
                  </button>
                </div>
              </div>
            </div>

            {/* 4 DORA Metric Cards Grid */}
            <div className="adept-dora-grid">
              {/* Card 1: Deployment Frequency */}
              <div className="adept-dora-card">
                <div>
                  <div className="adept-card-top-row">
                    <div className="adept-icon-box purple">
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>rocket_launch</span>
                    </div>
                    <span className="adept-tier-tag purple">HIGH</span>
                  </div>
                  <div style={{ marginBottom: "0.5rem" }}>
                    <div className="adept-metric-number-row">
                      <span className="adept-metric-val">3.5</span>
                      <span className="adept-metric-unit">deployments/week</span>
                    </div>
                  </div>
                  <h3 className="adept-card-title">Deployment Frequency</h3>
                  <p className="adept-card-desc">How often code is deployed to production</p>
                  <span className="adept-card-meta" style={{ display: "block" }}>15 samples</span>
                </div>

                {/* Sparkline SVG */}
                <div className="adept-sparkline-wrap">
                  <svg style={{ width: "100%", height: "100%", overflow: "visible" }} preserveAspectRatio="none" viewBox="0 0 100 24">
                    <defs>
                      <linearGradient id="purpleGrad" x1="0%" x2="0%" y1="0%" y2="100%">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path d="M0 22 L65 22 L70 19 L75 22 L80 6 L92 6 L100 10 L100 24 L0 24 Z" fill="url(#purpleGrad)" />
                    <path d="M0 22 L65 22 L70 19 L75 22 L80 6 L92 6 L100 10" fill="none" stroke="#6366f1" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                    <circle cx="100" cy="10" fill="#818cf8" r="2.5" />
                  </svg>
                </div>
              </div>

              {/* Card 2: Change Lead Time */}
              <div className="adept-dora-card">
                <div>
                  <div className="adept-card-top-row">
                    <div className="adept-icon-box emerald">
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>schedule</span>
                    </div>
                    <span className="adept-tier-tag emerald">ELITE</span>
                  </div>
                  <div style={{ marginBottom: "0.5rem" }}>
                    <div className="adept-metric-number-row">
                      <span className="adept-metric-val">0.1h</span>
                      <span className="adept-metric-unit">hours</span>
                    </div>
                  </div>
                  <h3 className="adept-card-title">Change Lead Time</h3>
                  <p className="adept-card-desc">Time from commit to production</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px", marginBottom: "1rem" }}>
                    <span style={{ color: "#a1a1aa" }}>15 samples</span>
                    <span style={{ color: "#818cf8", cursor: "pointer" }}>Show percentiles ▾</span>
                  </div>
                </div>

                {/* Sparkline SVG */}
                <div className="adept-sparkline-wrap">
                  <svg style={{ width: "100%", height: "100%", overflow: "visible" }} preserveAspectRatio="none" viewBox="0 0 100 24">
                    <path d="M0 22 L65 22 L70 18 L75 22 L85 22 L93 18 L98 6" fill="none" stroke="#10b981" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                    <circle cx="98" cy="6" fill="#34d399" r="2.5" />
                  </svg>
                </div>
              </div>

              {/* Card 3: Recovery Time */}
              <div className="adept-dora-card">
                <div>
                  <div className="adept-card-top-row">
                    <div className="adept-icon-box emerald">
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>shield</span>
                    </div>
                    <span className="adept-tier-tag emerald">ELITE</span>
                  </div>
                  <div style={{ marginBottom: "0.5rem" }}>
                    <div className="adept-metric-number-row">
                      <span className="adept-metric-val">0.3h</span>
                      <span className="adept-metric-unit">hours</span>
                    </div>
                  </div>
                  <h3 className="adept-card-title">Recovery Time</h3>
                  <p className="adept-card-desc">Median time to restore service</p>
                  <span className="adept-card-meta" style={{ display: "block" }}>2 samples</span>
                </div>

                {/* Sparkline SVG */}
                <div className="adept-sparkline-wrap">
                  <svg style={{ width: "100%", height: "100%", overflow: "visible" }} preserveAspectRatio="none" viewBox="0 0 100 24">
                    <path d="M0 22 L82 22 L88 6 L93 22 L100 22" fill="none" stroke="#10b981" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                    <circle cx="100" cy="22" fill="#34d399" r="2.5" />
                  </svg>
                </div>
              </div>

              {/* Card 4: Change Failure Rate */}
              <div className="adept-dora-card">
                <div>
                  <div className="adept-card-top-row">
                    <div className="adept-icon-box amber">
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>percent</span>
                    </div>
                    <span className="adept-tier-tag amber">MEDIUM</span>
                  </div>
                  <div style={{ marginBottom: "0.5rem" }}>
                    <div className="adept-metric-number-row">
                      <span className="adept-metric-val">11.8%</span>
                      <span className="adept-metric-unit">percent</span>
                    </div>
                  </div>
                  <h3 className="adept-card-title">Change Failure Rate</h3>
                  <p className="adept-card-desc">Percentage of deployments causing failures</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px", marginBottom: "1rem" }}>
                    <span style={{ color: "#a1a1aa" }}>17 samples</span>
                    <span>
                      <span style={{ color: "#f43f5e", fontWeight: 600 }}>2 failed</span>
                      <span style={{ color: "#71717a" }}> / 17 total</span>
                    </span>
                  </div>
                </div>

                {/* Sparkline SVG */}
                <div className="adept-sparkline-wrap">
                  <svg style={{ width: "100%", height: "100%", overflow: "visible" }} preserveAspectRatio="none" viewBox="0 0 100 24">
                    <path d="M0 22 L85 22 L91 6 L97 22 L100 22" fill="none" stroke="#f59e0b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                    <circle cx="100" cy="22" fill="#fbbf24" r="2.5" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: FOCUSED GITHUB & JIRA INTEGRATION */}
        <section className="adept-ecosystem-section" id="integrations">
          <div className="adept-ecosystem-inner">
            <div>
              <div className="adept-eco-pill">
                Ecosystem Native
              </div>
              <h3 className="adept-eco-title">Native GitHub &amp; Atlassian Jira Integration</h3>
              <p className="adept-eco-desc">
                Zero webhook script configuration. Connect your GitHub organization and Jira Cloud workspace in under 60 seconds with automated repository event tracking and end-to-end pull request risk telemetry.
              </p>
            </div>

            {/* Integrated Badges */}
            <div className="adept-eco-cards-row">
              {/* GitHub Card */}
              <div className="adept-eco-card">
                <svg style={{ width: "1.75rem", height: "1.75rem", fill: "#ffffff" }} viewBox="0 0 24 24">
                  <path clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" fillRule="evenodd" />
                </svg>
                <div>
                  <span className="adept-eco-card-title">GitHub App</span>
                  <span className="adept-eco-card-status" style={{ color: "#34d399" }}>Connected &amp; Verified</span>
                </div>
              </div>

              {/* Jira Card */}
              <div className="adept-eco-card">
                <svg style={{ width: "1.75rem", height: "1.75rem" }} fill="none" viewBox="0 0 24 24">
                  <path d="M11.53 2C11.53 7.26 7.26 11.53 2 11.53V2h9.53z" fill="#0052CC" />
                  <path d="M12.47 2C12.47 7.26 16.74 11.53 22 11.53V2h-9.53z" fill="#2684FF" />
                  <path d="M11.53 12.47C11.53 17.74 7.26 22 2 22v-9.53h9.53z" fill="#2684FF" />
                  <path d="M12.47 12.47C12.47 17.74 16.74 22 22 22v-9.53h-9.53z" fill="#0052CC" />
                </svg>
                <div>
                  <span className="adept-eco-card-title">Atlassian Jira</span>
                  <span className="adept-eco-card-status" style={{ color: "#818cf8" }}>Cloud Workspace Synced</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: UNIFORM CORE VALUE PILLARS (4-Card Grid) */}
        <section className="adept-pillars-section" id="dora-metrics">
          <div className="adept-section-header">
            <span className="adept-section-eyebrow">Architected for Precision</span>
            <h2 className="adept-section-title">
              Everything Engineering Leaders Need to Drive Velocity
            </h2>
            <p className="adept-section-sub">
              Eliminate intuition-based decisions with deterministically tracked pull request telemetry, DORA scoring, and SLA triggers.
            </p>
          </div>

          {/* Uniform 4-card Grid */}
          <div className="adept-pillars-grid">
            {/* Card 1: Zero-Secret-Leak */}
            <div className="adept-glass-panel adept-pillar-card">
              <div>
                <div className="adept-pillar-icon-box">
                  <span className="material-symbols-outlined" style={{ color: "#ffffff" }}>lock</span>
                </div>
                <h3 className="adept-pillar-title">Zero-Secret-Leak Sync</h3>
                <p className="adept-pillar-desc">
                  Ephemeral in-memory JWT tokens and deterministic issue linking with versioned AES-256-GCM encrypted payloads.
                </p>
              </div>
              <div className="adept-snippet-box">
                <div style={{ color: "#34d399" }}>// zero-persistence payload</div>
                <div style={{ color: "#d4d4d8" }}>aes_gcm: "v2:0x89fa...2d"</div>
                <div style={{ color: "#818cf8" }}>memory_lifetime: 200ms</div>
              </div>
            </div>

            {/* Card 2: JIT-Fine PR Risk Engine */}
            <div className="adept-glass-panel adept-pillar-card" id="pr-risk">
              <div>
                <div className="adept-pillar-icon-box">
                  <span className="material-symbols-outlined" style={{ color: "#818cf8" }}>psychology</span>
                </div>
                <h3 className="adept-pillar-title">JIT-Fine Risk Engine</h3>
                <p className="adept-pillar-desc">
                  Machine learning models calculate code churn velocity, file entropy, and regression probabilities prior to PR merges.
                </p>
              </div>
              <div className="adept-snippet-box" style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>File Entropy</span>
                  <span style={{ color: "#34d399" }}>0.08 (Minimal)</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Bug-Fix Prob.</span>
                  <span style={{ color: "#818cf8" }}>4.1%</span>
                </div>
              </div>
            </div>

            {/* Card 3: Proactive Alerting & SLA Governance */}
            <div className="adept-glass-panel adept-pillar-card">
              <div>
                <div className="adept-pillar-icon-box">
                  <span className="material-symbols-outlined" style={{ color: "#34d399" }}>notifications_active</span>
                </div>
                <h3 className="adept-pillar-title">Proactive SLA Governance</h3>
                <p className="adept-pillar-desc">
                  Multi-channel triggers for deployment failure bursts, MTTR anomalies, and pull request stagnation with automated de-duping.
                </p>
              </div>
              <div className="adept-snippet-box" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "#34d399" }}>check_circle</span>
                <span style={{ color: "#d4d4d8" }}>Slack #eng-alerts synced</span>
              </div>
            </div>

            {/* Card 4: Multi-Tenant Workspace */}
            <div className="adept-glass-panel adept-pillar-card">
              <div>
                <div className="adept-pillar-icon-box">
                  <span className="material-symbols-outlined" style={{ color: "#d4d4d8" }}>group_work</span>
                </div>
                <h3 className="adept-pillar-title">Multi-Tenant Scoping</h3>
                <p className="adept-pillar-desc">
                  Workspace admin delegation vs granular repository access. Instant member onboarding with SSO and SAML 2.0 integration.
                </p>
              </div>
              <div className="adept-snippet-box" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Role: Staff Eng</span>
                <span style={{ color: "#ffffff", fontWeight: 600 }}>Scope: Global Org</span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5: ENGINEERING ROI & BENCHMARK COMPARISON */}
        <section className="adept-roi-section" id="benchmarks">
          <div className="adept-glass-panel adept-roi-inner">
            <div style={{ textAlign: "center", maxWidth: "42rem", margin: "0 auto 3rem" }}>
              <span className="adept-section-eyebrow">Demonstrated Impact</span>
              <h2 className="adept-section-title" style={{ fontSize: "2rem" }}>Measurable Engineering Dividends</h2>
              <p className="adept-section-sub">
                Average results documented by staff-level teams within the first 60 days of deployment.
              </p>
            </div>

            {/* Metric Cards */}
            <div className="adept-roi-grid">
              <div className="adept-roi-card">
                <div className="adept-roi-num" style={{ color: "#ffffff" }}>4.2x</div>
                <div className="adept-roi-label">Faster Deploy Cadence</div>
                <p className="adept-roi-desc">Validated against baseline sprint schedules</p>
              </div>
              <div className="adept-roi-card">
                <div className="adept-roi-num" style={{ color: "#818cf8" }}>65%</div>
                <div className="adept-roi-label">Shorter PR Review Latency</div>
                <p className="adept-roi-desc">Accelerated with JIT risk auto-scoring</p>
              </div>
              <div className="adept-roi-card">
                <div className="adept-roi-num" style={{ color: "#34d399" }}>85%</div>
                <div className="adept-roi-label">MTTR Reduction</div>
                <p className="adept-roi-desc">Instant root-cause commit attribution</p>
              </div>
              <div className="adept-roi-card">
                <div className="adept-roi-num" style={{ color: "#e5e5e5" }}>0</div>
                <div className="adept-roi-label">Secrets Persisted</div>
                <p className="adept-roi-desc">Stateless, strictly ephemeral memory runtime</p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6: HIGH-IMPACT CALL TO ACTION BANNER */}
        <section className="adept-cta-section">
          <div className="adept-glass-panel adept-cta-box">
            {/* Glow accent */}
            <div className="adept-cta-glow" aria-hidden="true" />

            <h2 className="adept-cta-title">
              Ready to Elevate Your Team’s Engineering Velocity?
            </h2>
            <p className="adept-cta-sub">
              Join elite engineering organizations delivering faster, safer, and with complete operational clarity.
            </p>

            {/* Email Subscription Form */}
            <form onSubmit={handleEmailSubmit} className="adept-cta-form">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@company.com"
                className="adept-cta-input"
                aria-label="Work Email Address"
              />
              <button
                type="submit"
                className="adept-btn-white"
                style={{ height: "2.75rem", padding: "0 1.5rem", whiteSpace: "nowrap" }}
              >
                Get Started Free
              </button>
            </form>

            <div className="adept-guarantees">
              <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#34d399" }}>check</span>
                No credit card required
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#34d399" }}>check</span>
                14-day free trial
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* SECTION 7: DEVELOPER FOOTER */}
      <footer className="adept-footer" role="contentinfo">
        <div className="adept-footer-inner">
          <div className="adept-footer-grid">
            {/* Brand Summary Column */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <img src={logoUrl} alt="Adept Logo" className="adept-logo-img" />
                <span className="adept-brand-text">Adept</span>
              </div>
              <p className="adept-footer-desc">
                The telemetry-driven engineering intelligence and DORA metrics platform built for modern engineering organizations.
              </p>
              <div className="adept-status-pill">
                <span className="adept-dot-green" aria-hidden="true" />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#a1a1aa" }}>
                  Status: Operational — Lightsail ap-south-1
                </span>
              </div>
            </div>

            {/* Product Links */}
            <div>
              <span className="adept-footer-heading">Product</span>
              <ul className="adept-footer-links">
                <li><a href="#dora-metrics" className="adept-footer-link">DORA Metrics</a></li>
                <li><a href="#pr-risk" className="adept-footer-link">PR Risk Engine</a></li>
                <li><a href="#integrations" className="adept-footer-link">Integrations</a></li>
                <li><a href="#faq" className="adept-footer-link">FAQ</a></li>
              </ul>
            </div>

            {/* Platform & Account Links */}
            <div>
              <span className="adept-footer-heading">Platform</span>
              <ul className="adept-footer-links">
                <li><Link to="/login" className="adept-footer-link">Log In</Link></li>
                <li><Link to="/signup" className="adept-footer-link">Sign Up</Link></li>
                <li><a href="#benchmarks" className="adept-footer-link">ROI Benchmarks</a></li>
              </ul>
            </div>
          </div>

          {/* Footer Bottom Row */}
          <div className="adept-footer-bottom">
            <p style={{ margin: 0 }}>
              © 2026 Adept Intelligence Inc. Built for high-velocity engineering teams.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", fontFamily: "'JetBrains Mono', monospace" }}>
              <span style={{ cursor: "pointer" }}>SHA: 8f02ba9</span>
              <span>•</span>
              <span style={{ cursor: "pointer" }}>REST / GraphQL v2</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
