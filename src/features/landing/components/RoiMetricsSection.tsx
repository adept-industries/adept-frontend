export function RoiMetricsSection() {
  const stats = [
    {
      value: "4.2x",
      label: "Deployment Cadence",
      desc: "Increase in release frequency moving from manual gates to continuous DORA telemetry.",
    },
    {
      value: "65%",
      label: "Shorter Review Latency",
      desc: "Reduction in PR idle time by auto-triaging low-risk changes with JIT ML scoring.",
    },
    {
      value: "85%",
      label: "Faster Incident Recovery",
      desc: "Reduction in MTTR with automatic Jira incident-to-deployment trace correlation.",
    },
    {
      value: "0",
      label: "Secrets Persisted",
      desc: "Zero-storage of plain GitHub tokens with in-memory RS256 JWT rotation.",
    },
  ];

  return (
    <section className="landing-section">
      <div className="landing-content-wrap">
        <div className="landing-section-header">
          <div className="landing-eyebrow">
            <span className="landing-eyebrow-pill" aria-hidden="true" />
            <span>Proven Engineering ROI</span>
          </div>
          <h2 className="landing-section-title">
            Quantifiable Gains in <span className="landing-gradient-text">Speed, Quality, & Trust.</span>
          </h2>
        </div>

        <div className="roi-grid">
          {stats.map((stat, idx) => (
            <div key={idx} className="roi-card">
              <div className="roi-number">{stat.value}</div>
              <div className="roi-label">{stat.label}</div>
              <p className="roi-desc">{stat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
