import { Link } from "react-router";
import { useContext } from "react";
import { AuthContext } from "../../../auth/AuthContext";
import logoUrl from "../../../assets/logo.png";

export function LandingNav() {
  const authCtx = useContext(AuthContext);
  const isAuthenticated = authCtx?.state.status === "authenticated";

  return (
    <header className="landing-nav" role="banner">
      <div className="landing-nav-inner">
        {/* Brand Logo & Name */}
        <Link to="/" className="landing-brand" aria-label="Adept Home">
          <img src={logoUrl} alt="Adept Logo" className="landing-brand-logo" />
          <span className="landing-brand-name">ADEPT</span>
          <span className="landing-brand-badge">v2.5 Live</span>
        </Link>

        {/* Center Links */}
        <nav className="landing-nav-links" aria-label="Main Navigation">
          <a href="#features" className="landing-nav-link">Features</a>
          <a href="#dora-metrics" className="landing-nav-link">DORA Metrics</a>
          <a href="#pr-risk" className="landing-nav-link">PR Risk Engine</a>
          <a href="#how-it-works" className="landing-nav-link">How It Works</a>
          <a href="#integrations" className="landing-nav-link">Integrations</a>
          <a href="#pricing" className="landing-nav-link">Pricing</a>
        </nav>

        {/* Right Action Buttons */}
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
            <>
              <Link to="/login" className="landing-btn-ghost">
                Sign In
              </Link>
              <Link to="/signup" className="landing-btn-primary">
                Get Started →
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
