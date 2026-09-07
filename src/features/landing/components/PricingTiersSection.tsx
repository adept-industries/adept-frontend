import { Link } from "react-router";

export function PricingTiersSection() {
  const plans = [
    {
      name: "Community",
      desc: "Ideal for small teams, open-source projects, and local evaluation.",
      price: "$0",
      period: "forever",
      features: [
        "Up to 5 Tracked Repositories",
        "4 Core DORA Metrics",
        "GitHub App Integration",
        "Community Discord Support",
        "Local Docker Compose Deployment",
      ],
      cta: "Get Started Free",
      link: "/signup",
      featured: false,
    },
    {
      name: "Pro Team",
      desc: "For growing engineering organizations requiring deep Jira sync & PR risk analytics.",
      price: "$29",
      period: "per seat / mo",
      features: [
        "Unlimited Repositories & Projects",
        "JIT-Fine ML Pull Request Risk Engine",
        "Atlassian Jira Cloud 3LO Integration",
        "Real-Time SLA & Alert Rules",
        "Lead / Manager Role Governance",
        "99.9% Production SLA",
      ],
      cta: "Start 14-Day Free Trial",
      link: "/signup",
      featured: true,
    },
    {
      name: "Enterprise",
      desc: "For security-conscious enterprises requiring air-gapped or dedicated Lightsail cloud.",
      price: "Custom",
      period: "annual billing",
      features: [
        "Dedicated AWS Lightsail / VPC Deployment",
        "Custom Machine Learning Risk Calibration",
        "SSO / SAML & SCIM User Provisioning",
        "Audit Trail Retention & Compliance Export",
        "Dedicated Engineering Success Lead",
      ],
      cta: "Contact Enterprise",
      link: "/signup",
      featured: false,
    },
  ];

  return (
    <section className="landing-section" id="pricing">
      <div className="landing-content-wrap">
        <div className="landing-section-header">
          <div className="landing-eyebrow">
            <span className="landing-eyebrow-pill" aria-hidden="true" />
            <span>Transparent Pricing</span>
          </div>
          <h2 className="landing-section-title">
            Predictable Plans for <span className="landing-gradient-text">Every Engineering Scale.</span>
          </h2>
          <p className="landing-section-desc">
            No hidden fees. Start free on community tier, scale seamlessly as your team accelerates.
          </p>
        </div>

        <div className="pricing-grid">
          {plans.map((plan) => (
            <div key={plan.name} className={`pricing-card ${plan.featured ? "featured" : ""}`}>
              {plan.featured && <div className="pricing-featured-tag">Most Popular</div>}

              <div>
                <h3 className="pricing-plan-name">{plan.name}</h3>
                <p className="pricing-plan-desc">{plan.desc}</p>

                <div className="pricing-price-wrap">
                  <span className="pricing-amount">{plan.price}</span>
                  <span className="pricing-period">/ {plan.period}</span>
                </div>

                <ul className="pricing-features-list">
                  {plan.features.map((feat) => (
                    <li key={feat} className="pricing-feature-item">
                      <span className="pricing-check-icon">✓</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                to={plan.link}
                className={plan.featured ? "landing-btn-primary" : "landing-btn-secondary"}
                style={{ width: "100%", justifyContent: "center", textAlign: "center" }}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
