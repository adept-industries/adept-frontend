import { Link } from "react-router";
import { InteractiveHeroDashboard } from "./InteractiveHeroDashboard";

export function HeroSection() {
  return (
    <section className="landing-hero" id="hero">
      <div className="landing-content-wrap">
        {/* Eyebrow badge */}
        <div className="landing-eyebrow">
          <span className="landing-eyebrow-pill" aria-hidden="true" />
          <span>Next-Gen Engineering Intelligence & DORA Velocity</span>
        </div>

        {/* Main Headline */}
        <h1 className="landing-hero-headline">
          Turn DevOps Signals into Unstoppable <span className="landing-gradient-text">Engineering Velocity.</span>
        </h1>

        {/* Subtitle */}
        <p className="landing-hero-sub">
          Adept unifies GitHub, Jira Cloud, and CI/CD pipelines into automated real-time DORA metrics,
          machine-learning pull-request risk detection, and proactive SLA governance — without developer friction.
        </p>

        {/* CTA Buttons */}
        <div className="landing-hero-ctas">
          <Link to="/signup" className="landing-btn-primary" style={{ padding: "0.8rem 1.75rem", fontSize: "1rem" }}>
            Start Free Trial →
          </Link>
          <a href="#dora-metrics" className="landing-btn-secondary" style={{ padding: "0.8rem 1.75rem", fontSize: "1rem" }}>
            Explore Interactive Demo
          </a>
        </div>

        {/* Interactive 3D/Glassmorphic Hero Dashboard Preview */}
        <InteractiveHeroDashboard />
      </div>
    </section>
  );
}
