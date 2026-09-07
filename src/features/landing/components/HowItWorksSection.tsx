export function HowItWorksSection() {
  const steps = [
    {
      num: "01",
      title: "Connect Providers",
      desc: "Install the Adept GitHub App and link Atlassian Jira Cloud via OAuth 2.0 (3LO) in under 60 seconds with zero YAML config.",
    },
    {
      num: "02",
      title: "Ingest & Normalize",
      desc: "Stream webhooks, commits, PR diffs, CI/CD deployment signals, and Jira issue transitions into durable, idempotent event queues.",
    },
    {
      num: "03",
      title: "Compute Intelligence",
      desc: "Adept's background engine computes 4 DORA benchmarks, JIT-Fine PR risk scores, and incident recovery evidence in real-time.",
    },
    {
      num: "04",
      title: "Empower Velocity",
      desc: "Engineering leads unblock reviews, eliminate deployment regressions, track SLA compliance, and accelerate release frequency.",
    },
  ];

  return (
    <section className="landing-section" style={{ background: "rgba(10, 10, 16, 0.4)" }} id="how-it-works">
      <div className="landing-content-wrap">
        <div className="landing-section-header">
          <div className="landing-eyebrow">
            <span className="landing-eyebrow-pill" aria-hidden="true" />
            <span>Streamlined Workflow</span>
          </div>
          <h2 className="landing-section-title">
            From Raw Webhooks to <span className="landing-gradient-text">Elite Delivery Velocity.</span>
          </h2>
          <p className="landing-section-desc">
            A continuous, low-latency pipeline designed to extract signal from noise across your entire engineering stack.
          </p>
        </div>

        <div className="steps-grid">
          {steps.map((step) => (
            <div key={step.num} className="step-card">
              <div className="step-number">{step.num}</div>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
