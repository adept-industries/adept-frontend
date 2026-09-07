import { Link } from "react-router";
import logoUrl from "../../../assets/logo.png";

export function LandingFooter() {
  return (
    <footer className="landing-footer" role="contentinfo">
      <div className="landing-content-wrap">
        <div className="landing-footer-grid">
          {/* Brand Col */}
          <div>
            <Link to="/" className="landing-brand" style={{ marginBottom: "1rem" }}>
              <img src={logoUrl} alt="Adept Logo" className="landing-brand-logo" />
              <span className="landing-brand-name">ADEPT</span>
            </Link>
            <p className="footer-brand-desc">
              Engineering Intelligence & DORA Velocity Platform. Built for developers, trusted by engineering leaders.
            </p>
            <div className="landing-status-indicator" style={{ display: "inline-flex" }}>
              <span className="landing-status-dot" aria-hidden="true" />
              <span>All Systems Operational • AWS Lightsail ap-south-1</span>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="footer-heading">Product</h4>
            <ul className="footer-links-list">
              <li><a href="#dora-metrics" className="footer-link">DORA Metrics</a></li>
              <li><a href="#pr-risk" className="footer-link">PR Risk Engine</a></li>
              <li><a href="#integrations" className="footer-link">GitHub App Sync</a></li>
              <li><a href="#integrations" className="footer-link">Jira Cloud 3LO</a></li>
              <li><a href="#pricing" className="footer-link">Pricing Plans</a></li>
            </ul>
          </div>

          {/* Platform & Security */}
          <div>
            <h4 className="footer-heading">Platform</h4>
            <ul className="footer-links-list">
              <li><a href="#how-it-works" className="footer-link">Architecture</a></li>
              <li><Link to="/login" className="footer-link">Manager Console</Link></li>
              <li><Link to="/signup" className="footer-link">Lead Invitation</Link></li>
              <li><span className="footer-link" style={{ color: "var(--landing-text-muted)" }}>AES-256-GCM Tokens</span></li>
              <li><span className="footer-link" style={{ color: "var(--landing-text-muted)" }}>RS256 JWT Rotation</span></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="footer-heading">Resources</h4>
            <ul className="footer-links-list">
              <li><a href="https://adeptindustries.dev" target="_blank" rel="noreferrer" className="footer-link">Live Deployment</a></li>
              <li><Link to="/login" className="footer-link">API Documentation</Link></li>
              <li><Link to="/login" className="footer-link">Changelog & Roadmap</Link></li>
              <li><a href="#pricing" className="footer-link">Community Discord</a></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="footer-heading">Account</h4>
            <ul className="footer-links-list">
              <li><Link to="/login" className="footer-link">Sign In</Link></li>
              <li><Link to="/signup" className="footer-link">Create Account</Link></li>
              <li><Link to="/forgot-password" className="footer-link">Reset Password</Link></li>
              <li><Link to="/dashboard" className="footer-link">Workspace Switcher</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="footer-bottom-bar">
          <div>
            © {new Date().getFullYear()} Adept Industries Inc. All rights reserved.
          </div>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            <span>Java 25 / Spring Boot</span>
            <span>Python 3.14 / FastAPI</span>
            <span>PostgreSQL 18 / Flyway</span>
            <span>React 19 / Vite</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
