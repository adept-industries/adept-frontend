import { Link } from "react-router";
import { useContext, useState } from "react";
import { AuthContext } from "../../../auth/AuthContext";
import logoUrl from "../../../assets/logo.png";

export function LandingNav() {
  const authCtx = useContext(AuthContext);
  const isAuthenticated = authCtx?.state.status === "authenticated";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="landing-nav" role="banner">
      <div className="landing-nav-inner">
        {/* Brand Logo & Name */}
        <Link to="/" className="landing-brand" aria-label="Adept Home">
          <img src={logoUrl} alt="Adept Logo" className="landing-brand-logo" />
          <span className="landing-brand-name">ADEPT</span>
          <span className="landing-brand-badge">v2.5 Live</span>
        </Link>

        {/* Center Links (Desktop) */}
        <nav className="landing-nav-links" aria-label="Main Navigation">
          <a href="#features" className="landing-nav-link">Features</a>
          <a href="#dora-metrics" className="landing-nav-link">DORA Metrics</a>
          <a href="#pr-risk" className="landing-nav-link">PR Risk Engine</a>
          <a href="#how-it-works" className="landing-nav-link">How It Works</a>
          <a href="#integrations" className="landing-nav-link">Integrations</a>
          <a href="#pricing" className="landing-nav-link">Pricing</a>
        </nav>

        {/* Right Action Buttons (Desktop & Mobile) */}
        <div className="landing-nav-actions">
          <div className="landing-status-indicator" title="Production status: Operational">
            <span className="landing-status-dot" aria-hidden="true" />
            <span>Operational</span>
          </div>

          {isAuthenticated ? (
            <Link to="/dashboard" className="landing-btn-primary">
              Console →
            </Link>
          ) : (
            <div className="landing-desktop-auth-buttons" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Link to="/login" className="landing-btn-ghost">
                Sign In
              </Link>
              <Link to="/signup" className="landing-btn-primary">
                Get Started →
              </Link>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="landing-mobile-toggle"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="landing-mobile-drawer" role="dialog" aria-modal="true">
          <a href="#features" className="landing-nav-link" onClick={() => setMobileMenuOpen(false)}>Features</a>
          <a href="#dora-metrics" className="landing-nav-link" onClick={() => setMobileMenuOpen(false)}>DORA Metrics</a>
          <a href="#pr-risk" className="landing-nav-link" onClick={() => setMobileMenuOpen(false)}>PR Risk Engine</a>
          <a href="#how-it-works" className="landing-nav-link" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
          <a href="#integrations" className="landing-nav-link" onClick={() => setMobileMenuOpen(false)}>Integrations</a>
          <a href="#pricing" className="landing-nav-link" onClick={() => setMobileMenuOpen(false)}>Pricing</a>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--landing-glass-border)" }}>
            {isAuthenticated ? (
              <Link to="/dashboard" className="landing-btn-primary" style={{ textAlign: "center", justifyContent: "center" }}>
                Console →
              </Link>
            ) : (
              <>
                <Link to="/login" className="landing-btn-ghost" style={{ textAlign: "center", border: "1px solid var(--landing-glass-border)" }}>
                  Sign In
                </Link>
                <Link to="/signup" className="landing-btn-primary" style={{ textAlign: "center", justifyContent: "center" }}>
                  Get Started →
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
