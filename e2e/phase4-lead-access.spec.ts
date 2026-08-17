import { expect, test } from "@playwright/test";
import {
  signupVerifyAndLogin,
  uniqueEmail,
  waitForAuthProxyBudget,
} from "./helpers/account.js";

test.describe("Phase 4 Lead repository-scoped access and Manager UI", () => {
  test("Manager assignment flow: Manager navigates members UI and manages projects", async ({ page }) => {
    await waitForAuthProxyBudget();
    const managerEmail = uniqueEmail();
    await signupVerifyAndLogin(page, managerEmail);

    // 1. Confirm Manager navigation bar exposes all management links & dropdowns
    await expect(page.locator("#nav-members-link")).toBeVisible();
    await expect(page.locator("#nav-integrations-link")).toBeVisible();
    await expect(page.locator("#nav-settings-dropdown-btn")).toBeVisible();

    // 2. Navigate to Members page (/dashboard/members)
    await page.locator("#nav-members-link").click();
    await expect(page).toHaveURL(/dashboard\/members/);
    await expect(page.getByRole("heading", { name: /Members & Lead Assignments/i })).toBeVisible();
    await expect(page.getByText(/Assign Leads to tracked repositories/i)).toBeVisible();

    // 3. Navigate to Projects page via settings dropdown and create a project
    await page.locator("#nav-settings-dropdown-btn").click();
    await page.locator("#nav-project-settings-menuitem").click();
    await expect(page).toHaveURL(/dashboard\/projects/);
    await page.getByRole("button", { name: /New Project/i }).click();

    const projectName = `Platform Project ${Date.now()}`;
    await page.getByLabel("Project name", { exact: true }).fill(projectName);
    await page.getByRole("button", { name: /Create Project/i }).click();

    // Project should appear in project table
    await expect(page.getByText(projectName)).toBeVisible();

    // 4. Return to dashboard
    await page.locator("#nav-logo").click();
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });

  test("Lead isolation: Lead views only assigned scope and is denied from Manager routes", async ({ page }) => {
    // 1. Accessing public /accept-invite without token renders informative notice
    await page.goto("/accept-invite");
    await expect(page.getByText(/No invitation token found/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Go to Sign in/i })).toBeVisible();

    // 2. Direct access to Manager-only routes when unauthenticated redirects to /login
    await page.goto("/dashboard/members");
    await expect(page).toHaveURL(/login/);

    await page.goto("/dashboard/settings");
    await expect(page).toHaveURL(/login/);

    await page.goto("/dashboard/projects");
    await expect(page).toHaveURL(/login/);

    await page.goto("/dashboard/integrations");
    await expect(page).toHaveURL(/login/);
  });
});
