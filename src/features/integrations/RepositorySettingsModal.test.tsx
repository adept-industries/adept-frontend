import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders.js";
import { server } from "../../test/server.js";
import type { RepositoryResponse } from "./api.js";
import { RepositorySettingsModal } from "./RepositorySettingsModal.js";

const repository: RepositoryResponse = {
  id: "repo-1", workspaceId: "ws-1", githubIntegrationId: "gh-1", githubRepoId: 1,
  ownerLogin: "acme", name: "app", fullName: "acme/app", defaultBranch: "main",
  visibility: "PRIVATE", archived: false, trackingEnabled: true, lastSyncedAt: "2026-09-01T00:00:00Z",
  settings: {
    deploymentSignal: "WORKFLOW_RUN", productionBranchPatterns: ["main", "release/*"],
    productionEnvironmentPatterns: ["production"], deploymentWorkflowNamePatterns: ["Deploy, API", "CI [[]prod]"],
    incidentSource: "GITHUB", doraExclusions: ["*preview*"], defaultMetricGranularity: "WEEK", backfillDays: 90,
  },
};

describe("RepositorySettingsModal discovery", () => {
  it("does not auto-select, auto-save or change saved names with commas/metacharacters", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<RepositorySettingsModal repository={repository} onClose={vi.fn()} onSave={save} />);
    await user.click(screen.getByRole("button", { name: "Deployment Workflow Name Patterns" }));
    expect(await screen.findByRole("checkbox", { name: "CI" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Remove Deploy, API" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Metric Granularity" })).not.toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save Settings" }));
    expect(save).toHaveBeenCalledExactlyOnceWith({
      deploymentSignal: "WORKFLOW_RUN",
      productionBranchPatterns: ["main", "release/*"],
      productionEnvironmentPatterns: ["production"],
      deploymentWorkflowNamePatterns: ["Deploy, API", "CI [[]prod]"],
      incidentSource: "GITHUB",
      doraExclusions: ["*preview*"],
      backfillDays: 90,
    });
  });

  it("can save custom patterns during a discovery error and retry without losing edits", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    let requests = 0;
    server.use(http.get("/api/v1/repositories/repo-1/settings-options", () => {
      requests++;
      return requests === 1 ? new HttpResponse(null, { status: 503 }) : HttpResponse.json({
        branches: { values: ["main", "release/next"], complete: true },
        workflows: { values: [], complete: true }, environments: { values: [], complete: true },
      });
    }));
    renderWithProviders(<RepositorySettingsModal repository={repository} onClose={vi.fn()} onSave={save} />);
    await screen.findByRole("button", { name: "Retry options" });
    await user.click(screen.getByRole("button", { name: "Production Branch Patterns" }));
    await user.type(screen.getByRole("textbox", { name: "Search Production Branch Patterns" }), "hotfix/*{Enter}");
    expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Retry options" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Retry options" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Remove hotfix/*" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save Settings" }));
    expect(save).toHaveBeenCalledExactlyOnceWith({
      deploymentSignal: "WORKFLOW_RUN",
      productionBranchPatterns: ["main", "release/*", "hotfix/*"],
      productionEnvironmentPatterns: ["production"],
      deploymentWorkflowNamePatterns: ["Deploy, API", "CI [[]prod]"],
      incidentSource: "GITHUB",
      doraExclusions: ["*preview*"],
      backfillDays: 90,
    });
    expect(requests).toBe(2);
  });

  it("keeps manual settings usable on an empty repo and discards edits on cancel", async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    const close = vi.fn();
    server.use(http.get("/api/v1/repositories/repo-1/settings-options", () => HttpResponse.json({
      branches: { values: [], complete: true }, workflows: { values: [], complete: true }, environments: { values: [], complete: true },
    })));
    renderWithProviders(<RepositorySettingsModal repository={repository} onClose={close} onSave={save} />);
    await user.click(screen.getByRole("button", { name: "Production Branch Patterns" }));
    await screen.findByText(/No GitHub names found/);
    await user.type(screen.getByRole("textbox", { name: "Search Production Branch Patterns" }), "hotfix/*{Enter}");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(close).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
  });
});
