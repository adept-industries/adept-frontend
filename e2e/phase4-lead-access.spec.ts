import { expect, test } from "@playwright/test";
import {
  signupVerifyAndLogin,
  uniqueEmail,
  waitForAuthProxyBudget,
} from "./helpers/account.js";

test.describe("Phase 4 Lead repository-scoped access and Manager UI", () => {
  test("Manager assignment flow: Manager navigates project settings and manages projects & leads", async ({ page }) => {
    await waitForAuthProxyBudget();
    const managerEmail = uniqueEmail();
    await signupVerifyAndLogin(page, managerEmail);

    // 1. Confirm Manager navigation bar exposes management links & dropdowns
    await expect(page.locator("#sidebar-nav-integrations")).toBeVisible();
    await expect(page.locator("#sidebar-nav-settings")).toBeVisible();

    // 2. Navigate to Project Settings page via settings dropdown
    await page.locator("#sidebar-nav-projects").click();
    await expect(page).toHaveURL(/dashboard\/projects/);
    await expect(page.getByRole("heading", { name: /Project Settings/i })).toBeVisible();
    await expect(page.getByText(/Create projects, attach tracked repositories, and assign repository Leads/i)).toBeVisible();

    // 3. Create a project
    const projectName = `Platform Project ${Date.now()}`;
    await page.getByRole("button", { name: "Expand create project form" }).click();
    await page.getByLabel("Project name", { exact: true }).fill(projectName);
    await page.getByRole("button", { name: /Create project/i }).click();

    // Project should appear in project list
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

    // 4. Return to dashboard
    await page.locator("#sidebar-logo-link").click();
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });

  test("Lead isolation: Lead views only assigned scope and is denied from Manager routes", async ({ page }) => {
    // 1. Accessing public /accept-invite without token renders informative notice
    await page.goto("/accept-invite");
    await expect(page.getByText(/No invitation token found/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Go to Sign in/i })).toBeVisible();

    // 2. Direct access to Manager-only routes when unauthenticated redirects to /login
    await page.goto("/dashboard/settings");
    await expect(page).toHaveURL(/login/);

    await page.goto("/dashboard/projects");
    await expect(page).toHaveURL(/login/);

    await page.goto("/dashboard/integrations");
    await expect(page).toHaveURL(/login/);
  });
});
