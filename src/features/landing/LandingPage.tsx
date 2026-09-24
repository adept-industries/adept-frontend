import { Link } from "react-router";
import { useAuth } from "../../auth/AuthProvider";
import logoUrl from "../../assets/logo.png";
import { DoraMetricCard } from "../metrics/DoraMetricCard";
import { IconRocket, IconClock, IconShield, IconPercent } from "../metrics/DoraMetricsSection";
import type { MetricSummaryDto, MetricSeriesItemDto, MetricType } from "../metrics/types";
import "./LandingPage.css";

const dfMetric: MetricSummaryDto = {
  value: 14.5,
  unit: "deployments/week",
  sampleSize: 62,
  rating: "ELITE",
  dimensions: {},
};

const cltMetric: MetricSummaryDto = {
  value: 0.2,
  unit: "hours",
  sampleSize: 62,
  rating: "ELITE",
  dimensions: {
    mean: 0.3,
    p50: 0.2,
    p75: 0.4,
    p90: 0.6,
  },
};

const rtMetric: MetricSummaryDto = {
  value: 0.3,
  unit: "hours",
  sampleSize: 2,
  rating: "ELITE",
  dimensions: {},
};

const cfrMetric: MetricSummaryDto = {
  value: 3.1,
  unit: "percent",
  sampleSize: 64,
  rating: "ELITE",
  dimensions: {
    failed_deployments: 2,
    total_deployments: 64,
  },
};

function createSeries(values: number[], metricType: MetricType, unit: string, sampleSize: number): MetricSeriesItemDto[] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  return values.map((value, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + i - values.length + 1);
    const period = date.toISOString();
    return {
      date: period,
      periodStart: period,
      periodEnd: period,
      metricType,
      value,
      unit,
      sampleSize,
      dimensions: {},
    };
  });
}

const dfSeries = createSeries(
  [2.0, 2.0, 2.1, 2.0, 2.0, 2.2, 4.0, 2.5, 2.1, 14.5, 9.2, 6.0, 3.2, 3.5, 4.1, 2.8, 3.5],
  "DEPLOYMENT_FREQUENCY",
  "deployments/week",
  62,
);

const cltSeries = createSeries(
  [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.2, 0.1, 0.1, 1.8, 0.3, 0.2, 0.1, 0.1, 1.6, 0.2],
  "CHANGE_LEAD_TIME_HOURS",
  "hours",
  62,
);

const rtSeries = createSeries(
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2.5, 0, 0, 0, 0, 0, 0],
  "FAILED_DEPLOYMENT_RECOVERY_TIME_HOURS",
  "hours",
  2,
);

const cfrSeries = createSeries(
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6.0, 0, 0, 0, 0, 0, 0],
  "CHANGE_FAILURE_RATE_PERCENT",
  "percent",
  64,
);

const features = [
  {
    title: "Understand delivery",
    description: "Follow the four DORA metrics by project or repository. Compare 7, 30, or 90 days of deployment history.",
  },
  {
    title: "Prioritize reviews",
    description: "See scored open pull requests with estimated review risk. Use it to guide attention, not replace code review.",
  },
  {
    title: "Keep issues in view",
    description: "See open GitHub and Jira Cloud issues alongside your project’s delivery data, with links back to the source.",
  },
  {
    title: "Set useful alerts",
    description: "Email your team when repository DORA metrics or PR risk meet your thresholds. Choose the evaluation window and cooldown.",
  },
];

const setupSteps = [
  {
    title: "Connect your tools",
    description: "Create a workspace and connect the GitHub App. Choose which repositories to track. Add Jira Cloud if your team uses it.",
  },
  {
    title: "Define your project",
    description: "Group repositories into a project. In repository settings, choose the workflow or deployment event that represents production.",
  },
  {
    title: "Review with your team",
    description: "Let the initial sync finish, then explore the dashboard. Invite Leads and assign their repositories. New events update the data as they’re processed.",
  },
];

const commonQuestions = [
  {
    question: "How do I connect GitHub?",
    answer: "Open Integrations in your workspace and install or authorize the Adept GitHub App. Grant it access to the repositories you want, enable tracking, and add them to a project. Adept imports available history and processes new GitHub events in the background.",
  },
  {
    question: "Can I use private GitHub repositories?",
    answer: "Yes. The GitHub App can access public or private repositories you grant it access to. Your organization may require an owner to approve the installation. You then choose which available repositories to track in Adept.",
  },
  {
    question: "Do I need to change my deployment workflow?",
    answer: "It depends on what your workflow already reports to GitHub. Choose GitHub Deployment API Event when it reports deployment results, or GitHub Actions Workflow Run when the selected workflow actually deploys to production. Match the names in repository settings. A workflow that only builds or tests is not a production deployment.",
  },
  {
    question: "Why aren’t there any DORA metrics yet?",
    answer: "The initial history import takes time. Check that repository tracking is enabled, the repository belongs to your project, and its production settings match your GitHub events. Metrics need matching deployment history in the selected period; merging a PR alone does not create a deployment sample.",
  },
  {
    question: "What does a pull request’s risk score mean?",
    answer: "It’s a machine-learning estimate based on the size and spread of a PR’s changes and other change features. A higher score suggests taking a closer look during review. It is not proof of a bug, a security scan, or an automatic decision about whether to merge.",
  },
  {
    question: "How does Jira work with Adept?",
    answer: "Connect Jira Cloud from Integrations and link tracked Jira projects to your Adept project. Their open issues appear in the dashboard alongside GitHub issues. Jira is optional: DORA metrics use GitHub deployment data, not Jira issues.",
  },
  {
    question: "Which repositories can my team see?",
    answer: "Managers can view the tracked repositories attached to a project in their workspace. Leads see repository metrics and PR risk for the repositories assigned to them in that project. Connecting a repository does not give every workspace access to it.",
  },
];

const GITHUB_ORG_URL = "https://github.com/adept-industries";

function GitHubIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export function LandingPage() {
  const { state } = useAuth();
  const isAuthenticated = state.status === "authenticated";
  const accountHref = isAuthenticated ? "/dashboard" : "/signup";
  const accountLabel = isAuthenticated ? "Open dashboard" : "Create account";

  return (
    <div className="adept-landing">
      <a className="adept-landing__skip" href="#main-content">Skip to content</a>

      <header className="adept-landing__header">
        <div className="adept-landing__container adept-landing__nav-row">
          <Link className="adept-landing__brand" to="/" aria-label="Adept home">
            <img src={logoUrl} alt="" width="32" height="32" />
            <span>Adept</span>
          </Link>
          <nav className="adept-landing__nav" aria-label="Main navigation">
            <a href="#overview">Overview</a>
            <a href="#how-it-works">How it works</a>
            <a href="#faq">FAQs</a>
          </nav>
          <div className="adept-landing__header-actions">
            <a
              href={GITHUB_ORG_URL}
              target="_blank"
              rel="noreferrer"
              className="adept-landing__github-link"
              aria-label="Adept on GitHub"
            >
              <GitHubIcon size={20} />
            </a>
            <Link className="adept-landing__account-link" to={isAuthenticated ? "/dashboard" : "/login"}>
              {isAuthenticated ? "Dashboard" : "Log in"}<span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="adept-landing__container" tabIndex={-1}>
        <section className="adept-landing__hero" aria-labelledby="landing-title">
          <div className="adept-landing__intro">
            <div>
              <p className="adept-landing__eyebrow">Software delivery in context</p>
              <h1 id="landing-title">Know what’s shipping.<br />See what needs attention.</h1>
            </div>
            <div className="adept-landing__intro-copy">
              <p>Understand delivery performance, prioritize pull request reviews, and keep GitHub and Jira issues in view. One place for your team’s project data.</p>
              <Link to={accountHref} className="adept-landing__primary-link">
                {accountLabel}<span aria-hidden="true">→</span>
              </Link>
              <p className="adept-landing__integrations">Works with GitHub &amp; Jira Cloud</p>
            </div>
          </div>

          <figure className="adept-landing__preview" aria-labelledby="preview-caption">
            <figcaption id="preview-caption" className="adept-landing__preview-caption">
              <span>Example dashboard</span>
            </figcaption>
            <div className="adept-landing__preview-body">
              <div className="dora-section-header adept-landing__preview-header">
                <h2 className="dash-section-title" style={{ margin: 0 }}>DORA Metrics</h2>
                <div className="dora-filter-controls">
                  <div className="dora-repository-filter">
                    <span>Repository</span>
                    <div className="adept-landing__mock-select" aria-label="Repository">
                      <span>All repositories</span>
                      <svg
                        className="adept-landing__mock-select-arrow"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                  <div className="dora-filter-bar" role="group" aria-label="Time range">
                    <span className="dora-filter-btn">
                      Last 7 Days
                    </span>
                    <span className="dora-filter-btn dora-filter-btn--active">
                      Last 30 Days
                    </span>
                    <span className="dora-filter-btn">
                      Last 90 Days
                    </span>
                  </div>
                </div>
              </div>

              <div className="dash-stats-grid dora-cards-grid adept-landing__dora-grid" role="list">
                <div className="dora-cards-col">
                  <div role="listitem">
                    <DoraMetricCard
                      cardId="preview-df"
                      title="Deployment Frequency"
                      subtitle="How often code is deployed to production"
                      metric={dfMetric}
                      series={dfSeries}
                      icon={<IconRocket />}
                    />
                  </div>
                  <div role="listitem">
                    <DoraMetricCard
                      cardId="preview-rt"
                      title="Recovery Time"
                      subtitle="Median time to restore service"
                      metric={rtMetric}
                      series={rtSeries}
                      icon={<IconShield />}
                    />
                  </div>
                </div>
                <div className="dora-cards-col">
                  <div role="listitem">
                    <DoraMetricCard
                      cardId="preview-clt"
                      title="Change Lead Time"
                      subtitle="Time from commit to production"
                      metric={cltMetric}
                      series={cltSeries}
                      icon={<IconClock />}
                      showPercentiles
                    />
                  </div>
                  <div role="listitem">
                    <DoraMetricCard
                      cardId="preview-cfr"
                      title="Change Failure Rate"
                      subtitle="Percentage of deployments causing failures"
                      metric={cfrMetric}
                      series={cfrSeries}
                      icon={<IconPercent />}
                      showFailureBreakdown
                    />
                  </div>
                </div>
              </div>
            </div>
          </figure>
        </section>

        <section id="overview" className="adept-landing__section" aria-labelledby="overview-title">
          <div className="adept-landing__section-heading">
            <h2 id="overview-title">The project, beyond the next PR.</h2>
            <p>A shared view of delivery, reviews, and work still open.</p>
          </div>
          <div className="adept-landing__features">
            {features.map((feature) => (
              <article key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="adept-landing__section adept-landing__split" aria-labelledby="setup-title">
          <div className="adept-landing__section-heading">
            <p className="adept-landing__eyebrow">Getting started</p>
            <h2 id="setup-title">Start with one project.</h2>
            <p>You choose the repositories.<br />Adept brings the data together.</p>
          </div>
          <ol className="adept-landing__steps">
            {setupSteps.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="faq" className="adept-landing__section adept-landing__split" aria-labelledby="faq-title">
          <div className="adept-landing__section-heading">
            <p className="adept-landing__eyebrow">Before you connect</p>
            <h2 id="faq-title">Common questions</h2>
            <p>A few things worth knowing about your tools and your data.</p>
          </div>
          <div className="adept-landing__faqs">
            {commonQuestions.map((faq) => (
              <details className="adept-landing__faq" key={faq.question}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="adept-landing__footer">
        <div className="adept-landing__container adept-landing__footer-row">
          <div>
            <span className="adept-landing__footer-brand">Adept</span>
            <p>Software Delivery in Context</p>
          </div>
          <nav className="adept-landing__footer-links" aria-label="Footer navigation">
            <a href="#faq">FAQs</a>
            <a
              href={GITHUB_ORG_URL}
              target="_blank"
              rel="noreferrer"
              className="adept-landing__footer-github"
              aria-label="Adept on GitHub"
            >
              <GitHubIcon size={16} />
              <span>GitHub</span>
            </a>
            <Link to={accountHref}>{accountLabel}<span aria-hidden="true">→</span></Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
