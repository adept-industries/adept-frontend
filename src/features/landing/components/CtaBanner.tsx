import { useState } from "react";
import { useNavigate } from "react-router";

export function CtaBanner() {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      navigate(`/signup?email=${encodeURIComponent(email.trim())}`);
    } else {
      navigate("/signup");
    }
  };

  return (
    <section className="landing-section" style={{ padding: "4rem 0 6rem" }}>
      <div className="landing-content-wrap">
        <div className="cta-banner-container">
          <div className="landing-eyebrow" style={{ background: "rgba(255, 255, 255, 0.1)", borderColor: "rgba(255, 255, 255, 0.2)" }}>
            <span className="landing-eyebrow-pill" style={{ background: "#ffffff", boxShadow: "0 0 8px #ffffff" }} />
            <span style={{ color: "#ffffff" }}>Instant Setup • No Credit Card Required</span>
          </div>

          <h2 className="cta-banner-title">
            Ready to Supercharge Your <span className="landing-gradient-text">Engineering Workflow?</span>
          </h2>

          <p className="cta-banner-sub">
            Join engineering teams measuring DORA metrics, cutting review latency, and deploying with confidence.
          </p>

          <form onSubmit={handleSubmit} className="cta-banner-form">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your work email..."
              className="cta-banner-input"
              aria-label="Work Email Address"
            />
            <button
              type="submit"
              className="landing-btn-primary"
              style={{ height: "3rem", padding: "0 1.5rem", fontSize: "0.95rem" }}
            >
              Get Started Free →
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
