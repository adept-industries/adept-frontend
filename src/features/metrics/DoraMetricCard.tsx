import { useState } from "react";
import type { MetricRating, MetricSummaryDto, MetricSeriesItemDto } from "./types.js";
import { DoraMetricChart } from "./DoraMetricChart.js";

// ── Rating colours ────────────────────────────────────────────────────────

const RATING_CLASS: Record<MetricRating, string> = {
  ELITE:   "dora-badge--elite",
  HIGH:    "dora-badge--high",
  MEDIUM:  "dora-badge--medium",
  LOW:     "dora-badge--low",
  UNKNOWN: "dora-badge--unknown",
};

const RATING_LABEL: Record<MetricRating, string> = {
  ELITE:   "Elite",
  HIGH:    "High",
  MEDIUM:  "Medium",
  LOW:     "Low",
  UNKNOWN: "Unknown",
};

/** Chart accent colour matched to the rating. */
const RATING_COLOR: Record<MetricRating, string> = {
  ELITE:   "#10b981",
  HIGH:    "#818cf8",
  MEDIUM:  "#f59e0b",
  LOW:     "#f87171",
  UNKNOWN: "#737373",
};

// ── Value formatter ────────────────────────────────────────────────────────

function formatValue(value: number, unit: string): string {
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit.startsWith("deployments")) return `${value % 1 === 0 ? value : value.toFixed(1)}`;
  // hours
  return `${value % 1 === 0 ? value : value.toFixed(1)}h`;
}

// ── Props ─────────────────────────────────────────────────────────────────

interface DoraMetricCardProps {
  /** Display title */
  title: string;
  /** Sub-title / description */
  subtitle: string;
  metric: MetricSummaryDto;
  /** Series data for the sparkline (same metric type) */
  series: MetricSeriesItemDto[];
  /** Icon slot */
  icon: React.ReactNode;
  /** Unique card id used for aria */
  cardId: string;
  /** Show percentile breakdown (Change Lead Time only) */
  showPercentiles?: boolean;
  /** Show failed/total breakdown (Change Failure Rate only) */
  showFailureBreakdown?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────

export function DoraMetricCard({
  title,
  subtitle,
  metric,
  series,
  icon,
  cardId,
  showPercentiles = false,
  showFailureBreakdown = false,
}: DoraMetricCardProps) {
  const [expanded, setExpanded] = useState(false);
  const ratingClass = RATING_CLASS[metric.rating];
  const ratingLabel = RATING_LABEL[metric.rating];
  const chartColor = RATING_COLOR[metric.rating];
  const formattedValue = formatValue(metric.value, metric.unit);

  const hasPercentiles = showPercentiles && (
    metric.dimensions["p50"] !== undefined ||
    metric.dimensions["mean"] !== undefined
  );

  return (
    <div className="dora-card stat-card" id={cardId} aria-labelledby={`${cardId}-title`}>
      {/* Header row */}
      <div className="dora-card-header">
        <div className="dora-card-icon-wrap">{icon}</div>
        <span className={`dora-badge ${ratingClass}`}>{ratingLabel}</span>
      </div>

      {/* Value */}
      <div className="dora-card-value-row">
        <span className="stat-card-value dora-card-value">{formattedValue}</span>
        <span className="dora-card-unit">{metric.unit}</span>
      </div>

      {/* Title */}
      <div id={`${cardId}-title`} className="dora-card-title">{title}</div>
      <div className="dora-card-subtitle">{subtitle}</div>

      {/* Sample size */}
      <div className="dora-card-meta">
        <span className="dora-card-sample">
          {metric.sampleSize} sample{metric.sampleSize !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Failure breakdown (Change Failure Rate) */}
      {showFailureBreakdown && metric.dimensions["failed_deployments"] !== undefined && (
        <div className="dora-card-breakdown">
          <span className="dora-breakdown-failed">
            {metric.dimensions["failed_deployments"]} failed
          </span>
          <span className="dora-breakdown-sep">/</span>
          <span className="dora-breakdown-total">
            {metric.dimensions["total_deployments"]} total
          </span>
        </div>
      )}

      {/* Percentile toggle (Change Lead Time) */}
      {hasPercentiles && (
        <div className="dora-card-percentiles-wrapper">
          <button
            className="dora-percentile-toggle"
            aria-expanded={expanded}
            aria-controls={`${cardId}-percentiles`}
            onClick={() => setExpanded((v) => !v)}
          >
            <span>{expanded ? "Hide" : "Show"} percentiles</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {expanded && (
            <dl id={`${cardId}-percentiles`} className="dora-percentiles-grid">
              {metric.dimensions["mean"] !== undefined && (
                <>
                  <dt>Mean</dt>
                  <dd>{metric.dimensions["mean"].toFixed(1)}h</dd>
                </>
              )}
              {metric.dimensions["p50"] !== undefined && (
                <>
                  <dt>P50</dt>
                  <dd>{metric.dimensions["p50"].toFixed(1)}h</dd>
                </>
              )}
              {metric.dimensions["p75"] !== undefined && (
                <>
                  <dt>P75</dt>
                  <dd>{metric.dimensions["p75"].toFixed(1)}h</dd>
                </>
              )}
              {metric.dimensions["p90"] !== undefined && (
                <>
                  <dt>P90</dt>
                  <dd>{metric.dimensions["p90"].toFixed(1)}h</dd>
                </>
              )}
            </dl>
          )}
        </div>
      )}

      {/* Sparkline */}
      <div className="dora-card-chart">
        <DoraMetricChart series={series} color={chartColor} label={`${title} trend`} />
      </div>
    </div>
  );
}
