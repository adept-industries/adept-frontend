import { expect, test } from "@playwright/test";

// Entirely mocked browser tests: never call GitHub or change repository settings on a server.
for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
  test(`repository settings dropdowns support selection and narrow layouts (${viewport.width}px)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const settings = {
      deploymentSignal: "WORKFLOW_RUN", productionBranchPatterns: ["main"],
      productionEnvironmentPatterns: ["production"], deploymentWorkflowNamePatterns: ["*deploy*"],
      incidentSource: "GITHUB", doraExclusions: [], defaultMetricGranularity: "WEEK", backfillDays: 90,
    };
    const repository = {
      id: "repo-1", workspaceId: "ws-1", githubIntegrationId: "gh-1", githubRepoId: 1,
      ownerLogin: "acme", name: "app", fullName: "acme/app", defaultBranch: "main", visibility: "PRIVATE",
      archived: false, trackingEnabled: true, settings, lastSyncedAt: "2026-09-01T00:00:00Z",
    };
    const session = {
      accessToken: "mock-access-token", expiresInSeconds: 900, workspaceSelectionRequired: false,
      user: { id: "user-1", email: "test@example.com", displayName: "Manager", emailVerified: true, hasPassword: true },
      currentMembership: { id: "mem-1", workspaceId: "ws-1", workspaceName: "Acme", workspaceSlug: "acme", timezone: "UTC", role: "MANAGER" },
      workspaces: [{ id: "ws-1", name: "Acme", slug: "acme", timezone: "UTC", role: "MANAGER" }],
    };
    let saved: unknown;
    await page.route("**/api/v1/**", async (route) => {
      const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
      if (path === "/auth/csrf") return route.fulfill({ status: 204, headers: { "set-cookie": "XSRF-TOKEN=mock-csrf; Path=/; SameSite=Lax" } });
      let data: unknown;
      if (path === "/auth/refresh" || path === "/auth/me") data = session;
      else if (path === "/integrations/github" || path === "/integrations/jira") data = null;
      else if (path === "/projects" || path === "/jira/projects") data = [];
      else if (path === "/repositories") data = [repository];
      else if (path === "/repositories/repo-1/settings-options") data = {
        branches: { values: ["main", "release/next"], complete: true },
        workflows: { values: ["Deploy [production], API", `Deploy-${"very-long-workflow-name-".repeat(4)}`], complete: true },
        environments: { values: ["production", "live"], complete: true },
      };
      else if (path === "/repositories/repo-1" && route.request().method() === "PATCH") {
        saved = route.request().postDataJSON().settings;
        data = { ...repository, settings: saved };
      } else return route.fulfill({ status: 404 });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    });

    await page.goto("/dashboard/integrations");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const modal = page.locator(".modal-card");
    await expect(modal).toBeVisible();
    await page.getByRole("button", { name: "Deployment Workflow Name Patterns", exact: true }).click();
    await page.getByRole("checkbox", { name: "Deploy [production], API", exact: true }).check();
    await expect.poll(() => modal.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect.poll(() => modal.evaluate((element, width) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= width;
    }, viewport.width)).toBe(true);

    await page.getByRole("textbox", { name: "Search Deployment Workflow Name Patterns" }).fill("*release*");
    await page.keyboard.press("Enter");
    expect(saved).toBeUndefined();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Deployment Workflow Name Patterns", exact: true })).toBeFocused();
    await page.getByRole("combobox", { name: "Deployment Signal Type" }).selectOption("DEPLOYMENT");
    await page.getByRole("button", { name: "Production Environment Patterns", exact: true }).click();
    await page.getByRole("checkbox", { name: "live", exact: true }).check();
    await page.getByRole("button", { name: "Save Settings" }).click();
    await expect(modal).not.toBeVisible();
    expect(saved).toEqual({ ...settings, deploymentSignal: "DEPLOYMENT",
      deploymentWorkflowNamePatterns: ["*deploy*", "Deploy [[]production], API", "*release*"],
      productionEnvironmentPatterns: ["production", "live"],
    });
  });
}
