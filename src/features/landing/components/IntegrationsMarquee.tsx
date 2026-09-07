export function IntegrationsMarquee() {
  const integrations = [
    { name: "GitHub App", icon: "🐙", desc: "RS256 JWT & Webhooks" },
    { name: "Atlassian Jira Cloud", icon: "🔷", desc: "OAuth 2.0 3LO & Issues" },
    { name: "AWS Lightsail", icon: "☁️", desc: "Container & Edge Deployment" },
    { name: "PostgreSQL 18", icon: "🐘", desc: "Flyway Managed Persistence" },
    { name: "Docker Compose", icon: "🐳", desc: "Immutable GHCR Containers" },
    { name: "Spring Boot 4.1", icon: "🍃", desc: "High-Throughput Core API" },
    { name: "FastAPI Engine", icon: "⚡", desc: "Async Python Background Worker" },
    { name: "React 19", icon: "⚛️", desc: "Modern Responsive Dashboard" },
  ];

  // Duplicate for seamless infinite loop
  const list = [...integrations, ...integrations];

  return (
    <div className="landing-section" style={{ padding: "3rem 0", borderBottom: "1px solid var(--landing-glass-border)" }} id="integrations">
      <div className="landing-content-wrap" style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "0.8rem", color: "var(--landing-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
          Engineered for Modern DevOps & Cloud-Native Toolchains
        </p>
      </div>

      <div className="marquee-wrapper" aria-hidden="true">
        <div className="marquee-track">
          {list.map((item, idx) => (
            <div key={`${item.name}-${idx}`} className="marquee-item">
              <span style={{ fontSize: "1.2rem" }}>{item.icon}</span>
              <div>
                <span style={{ color: "#ffffff", fontWeight: 700 }}>{item.name}</span>
                <span style={{ color: "var(--landing-text-muted)", fontSize: "0.75rem", marginLeft: "0.4rem" }}>
                  • {item.desc}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
