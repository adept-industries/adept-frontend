import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  ChangeFailureRateDetailDto,
  ChangeLeadTimeDetailDto,
  DeploymentFrequencyDetailDto,
  RecoveryTimeDetailDto,
} from "./types.js";

export type MetricExportData =
  | { type: "DEPLOYMENT_FREQUENCY"; items: DeploymentFrequencyDetailDto[] }
  | { type: "CHANGE_LEAD_TIME_HOURS"; items: ChangeLeadTimeDetailDto[] }
  | { type: "FAILED_DEPLOYMENT_RECOVERY_TIME_HOURS"; items: RecoveryTimeDetailDto[] }
  | { type: "CHANGE_FAILURE_RATE_PERCENT"; items: ChangeFailureRateDetailDto[] };

export interface ExportMetricPdfOptions {
  title: string;
  metricLabel: string;
  presetLabel: string;
  dateRange: { from: string; to: string };
  scopeName: string;
  repositoryName: string;
  timezone: string;
  periodSummary?: {
    formattedValue: string;
    unit: string;
    sampleSize: number;
    ratingLabel: string;
  } | null;
  cfrBreakdown?: string | null;
  data: MetricExportData;
  chartImage?: string | null;
}

function formatDate(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatTimestamp(iso: string | null | undefined, timezone: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const remSecs = seconds % 60;
  if (mins < 60) return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

function formatSource(source: string): string {
  switch (source) {
    case "GITHUB_DEPLOYMENT":
      return "GitHub Deployment";
    case "GITHUB_WORKFLOW":
      return "GitHub Workflow";
    case "MANUAL":
      return "Manual";
    case "GITHUB":
      return "GitHub";
    case "JIRA":
      return "Jira";
    default:
      return source;
  }
}

export function generateMetricPdf(options: ExportMetricPdfOptions): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Header Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(options.title, margin, 18);

  // Subtitle / Eyebrow
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text("Adept DORA Metrics Report", margin, 24);

  // Divider line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, 27, pageWidth - margin, 27);

  // Metadata 2-column block
  doc.setFontSize(8.5);

  const col2X = margin + contentWidth * 0.52;

  // Row 1: Date Range & Timezone
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Date Range:", margin, 33);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  const dateStr = `${options.presetLabel} (${formatDate(options.dateRange.from, options.timezone)} – ${formatDate(options.dateRange.to, options.timezone)})`;
  doc.text(dateStr, margin + 20, 33);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Timezone:", col2X, 33);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(options.timezone, col2X + 18, 33);

  // Row 2: Scope & Period Value
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Scope:", margin, 39);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(options.scopeName, margin + 20, 39);

  if (options.periodSummary) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Period Value:", col2X, 39);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const summaryText = `${options.periodSummary.formattedValue} (${options.periodSummary.unit}) · ${options.periodSummary.sampleSize} sample${options.periodSummary.sampleSize !== 1 ? "s" : ""} · Rating: ${options.periodSummary.ratingLabel}`;
    doc.text(summaryText, col2X + 22, 39);
  }

  // Row 3: Repository & Generated
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Repository:", margin, 45);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(options.repositoryName, margin + 20, 45);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Generated:", col2X, 45);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  try {
    const genStr = new Intl.DateTimeFormat("en-US", {
      timeZone: options.timezone,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date());
    doc.text(genStr, col2X + 18, 45);
  } catch {
    doc.text(new Date().toISOString(), col2X + 18, 45);
  }

  let tableStartY = 50;

  // Optional CFR Breakdown Chip
  if (options.cfrBreakdown) {
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, tableStartY, contentWidth, 7, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(options.cfrBreakdown, margin + 3, tableStartY + 4.8);
    tableStartY += 11;
  }

  // Chart Image
  if (options.chartImage) {
    // The chart from SVG has a 720x130 aspect ratio for the details variant
    const chartWidth = contentWidth;
    const chartHeight = (130 / 720) * chartWidth;
    doc.addImage(options.chartImage, "PNG", margin, tableStartY, chartWidth, chartHeight);
    tableStartY += chartHeight + 10;
  }

  // Prepare table headers and rows
  let head: string[][] = [];
  let body: string[][] = [];

  switch (options.data.type) {
    case "DEPLOYMENT_FREQUENCY": {
      head = [["Deployed Time", "Repository", "Environment", "Source", "Commit SHA", "Duration"]];
      if (options.data.items.length === 0) {
        body = [["No successful production deployments found.", "", "", "", "", ""]];
      } else {
        body = options.data.items.map((item) => [
          formatTimestamp(item.deployedAt, options.timezone),
          item.repositoryFullName,
          item.environment,
          formatSource(item.source),
          item.commitSha ? (item.commitSha.length > 7 ? item.commitSha.slice(0, 7) : item.commitSha) : "—",
          formatDuration(item.durationSeconds),
        ]);
      }
      break;
    }
    case "CHANGE_LEAD_TIME_HOURS": {
      head = [["Pull Request", "Repository", "Author", "First Commit", "Merged", "Deployed", "Lead Time"]];
      if (options.data.items.length === 0) {
        body = [["No change lead time events found.", "", "", "", "", "", ""]];
      } else {
        body = options.data.items.map((item) => [
          `#${item.prNumber} – ${item.prTitle}`,
          item.repositoryFullName,
          item.authorLogin || "—",
          formatTimestamp(item.firstCommitAt, options.timezone),
          formatTimestamp(item.mergedAt, options.timezone),
          formatTimestamp(item.deployedAt, options.timezone),
          formatDuration(item.leadTimeSeconds),
        ]);
      }
      break;
    }
    case "FAILED_DEPLOYMENT_RECOVERY_TIME_HOURS": {
      head = [["Incident", "Repository", "Severity", "Detected", "Resolved", "Recovery Time", "Failed Dep", "Recovery Dep"]];
      if (options.data.items.length === 0) {
        body = [["No resolved incidents found.", "", "", "", "", "", "", ""]];
      } else {
        body = options.data.items.map((item) => {
          const failedSha = item.failedDeployment?.commitSha;
          const recoverySha = item.recoveryDeployment?.commitSha;
          return [
            `${item.title} (${formatSource(item.source)})`,
            item.repositoryFullName ?? item.repositoryName ?? "—",
            item.severity === "UNKNOWN" ? "Unknown" : item.severity,
            formatTimestamp(item.detectedAt, options.timezone),
            formatTimestamp(item.resolvedAt, options.timezone),
            formatDuration(item.recoveryDurationSeconds),
            failedSha ? (failedSha.length > 7 ? failedSha.slice(0, 7) : failedSha) : "—",
            recoverySha ? (recoverySha.length > 7 ? recoverySha.slice(0, 7) : recoverySha) : "—",
          ];
        });
      }
      break;
    }
    case "CHANGE_FAILURE_RATE_PERCENT": {
      head = [["Finished Time", "Repository", "Environment", "Status", "Commit SHA", "Failed?", "Linked Incident"]];
      if (options.data.items.length === 0) {
        body = [["No finished production deployments found.", "", "", "", "", "", ""]];
      } else {
        body = options.data.items.map((item) => [
          formatTimestamp(item.finishedAt, options.timezone),
          item.repositoryFullName ?? item.repositoryName ?? "—",
          item.environment,
          item.status === "IN_PROGRESS" ? "IN PROGRESS" : item.status,
          item.commitSha ? (item.commitSha.length > 7 ? item.commitSha.slice(0, 7) : item.commitSha) : "—",
          item.isFailure ? "Yes" : "No",
          item.incident ? `${item.incident.title} (${item.incident.severity})` : "—",
        ]);
      }
      break;
    }
  }

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: margin, right: margin, bottom: 15 },
    head,
    body,
    headStyles: {
      fillColor: [79, 70, 229], // #4f46e5 indigo-600
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.1,
  });

  // Footer: Page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" });
  }

  return doc;
}

export function exportMetricPdf(
  options: ExportMetricPdfOptions,
  doc: jsPDF = generateMetricPdf(options),
): void {
  const filePrefix = options.metricLabel.toLowerCase().replace(/\s+/g, "-");
  const presetPrefix = options.presetLabel.toLowerCase().replace(/\s+/g, "-");
  doc.save(`${filePrefix}-report-${presetPrefix}.pdf`);
}
