import { describe, expect, it, vi } from "vitest";
import { generateMetricPdf, exportMetricPdf } from "./exportMetricPdf.js";
import type { ExportMetricPdfOptions } from "./exportMetricPdf.js";

const BASE_OPTIONS: Omit<ExportMetricPdfOptions, "data" | "title" | "metricLabel"> = {
  presetLabel: "Last 30 Days",
  dateRange: { from: "2026-08-01T00:00:00Z", to: "2026-08-31T00:00:00Z" },
  scopeName: "Project: adept",
  repositoryName: "acme/core-service",
  timezone: "UTC",
  periodSummary: {
    formattedValue: "4.5",
    unit: "deployments/week",
    sampleSize: 18,
    ratingLabel: "High",
  },
};

describe("exportMetricPdf", () => {
  it("generates a valid PDF for Deployment Frequency", () => {
    const doc = generateMetricPdf({
      ...BASE_OPTIONS,
      title: "Deployment Frequency Details",
      metricLabel: "Deployment Frequency",
      data: {
        type: "DEPLOYMENT_FREQUENCY",
        items: [
          {
            id: "dep-1",
            repositoryId: "repo-1",
            repositoryName: "core-service",
            repositoryFullName: "acme/core-service",
            deployedAt: "2026-08-20T14:30:00Z",
            environment: "production",
            source: "GITHUB_DEPLOYMENT",
            commitSha: "a1b2c3d4e5f67890",
            durationSeconds: 145,
          },
        ],
      },
    });

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    const buffer = doc.output("arraybuffer");
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  it("generates a valid PDF for Change Lead Time", () => {
    const doc = generateMetricPdf({
      ...BASE_OPTIONS,
      title: "Change Lead Time Details",
      metricLabel: "Change Lead Time",
      data: {
        type: "CHANGE_LEAD_TIME_HOURS",
        items: [
          {
            prId: "pr-1",
            prNumber: 42,
            prTitle: "Optimize query performance",
            prUrl: "https://github.com/acme/core-service/pull/42",
            repositoryId: "repo-1",
            repositoryName: "core-service",
            repositoryOwnerLogin: "acme",
            repositoryFullName: "acme/core-service",
            authorLogin: "alice",
            firstCommitAt: "2026-08-10T10:00:00Z",
            openedAt: "2026-08-10T11:00:00Z",
            mergedAt: "2026-08-11T12:00:00Z",
            deployedAt: "2026-08-11T14:00:00Z",
            leadTimeSeconds: 100800,
            codingTimeSeconds: 3600,
            reviewTimeSeconds: 90000,
            deployTimeSeconds: 7200,
            deploymentEnvironment: "production",
            deploymentCommitSha: "a1b2c3d4e5f67890",
          },
        ],
      },
    });

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("generates a valid PDF for Recovery Time", () => {
    const doc = generateMetricPdf({
      ...BASE_OPTIONS,
      title: "Recovery Time Details",
      metricLabel: "Recovery Time",
      data: {
        type: "FAILED_DEPLOYMENT_RECOVERY_TIME_HOURS",
        items: [
          {
            incidentId: "inc-1",
            title: "500 errors on checkout",
            source: "GITHUB",
            severity: "SEV1",
            repositoryId: "repo-1",
            repositoryName: "core-service",
            repositoryFullName: "acme/core-service",
            detectedAt: "2026-08-15T10:00:00Z",
            resolvedAt: "2026-08-15T12:30:00Z",
            recoveryDurationSeconds: 9000,
            failedDeployment: {
              id: "dep-bad",
              commitSha: "bad000000000000",
              environment: "production",
              finishedAt: "2026-08-15T09:50:00Z",
            },
            recoveryDeployment: {
              id: "dep-good",
              commitSha: "good00000000000",
              environment: "production",
              finishedAt: "2026-08-15T12:30:00Z",
            },
          },
        ],
      },
    });

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("generates a valid PDF for Change Failure Rate with breakdown banner", () => {
    const doc = generateMetricPdf({
      ...BASE_OPTIONS,
      title: "Change Failure Rate Details",
      metricLabel: "Change Failure Rate",
      cfrBreakdown: "Showing 10 total production deployments (2 failed = 20.0% failure rate)",
      data: {
        type: "CHANGE_FAILURE_RATE_PERCENT",
        items: [
          {
            deploymentId: "dep-1",
            repositoryId: "repo-1",
            repositoryName: "core-service",
            repositoryFullName: "acme/core-service",
            finishedAt: "2026-08-15T10:00:00Z",
            environment: "production",
            status: "FAILURE",
            commitSha: "bad000000000000",
            isFailure: true,
            incident: {
              id: "inc-1",
              title: "500 errors",
              severity: "SEV1",
            },
          },
        ],
      },
    });

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("calls doc.save when exportMetricPdf is invoked", () => {
    const doc = generateMetricPdf({
      ...BASE_OPTIONS,
      title: "Deployment Frequency Details",
      metricLabel: "Deployment Frequency",
      data: {
        type: "DEPLOYMENT_FREQUENCY",
        items: [],
      },
    });
    const saveSpy = vi.spyOn(doc, "save").mockImplementation(() => doc);

    exportMetricPdf(
      {
        ...BASE_OPTIONS,
        title: "Deployment Frequency Details",
        metricLabel: "Deployment Frequency",
        data: {
          type: "DEPLOYMENT_FREQUENCY",
          items: [],
        },
      },
      doc,
    );

    expect(saveSpy).toHaveBeenCalledWith("deployment-frequency-report-last-30-days.pdf");
  });
});
