import { expect, test } from "@playwright/test";
import {
  signupVerifyAndLogin,
  uniqueEmail,
  waitForAuthProxyBudget,
} from "./helpers/account.js";

test("Manager deletes the final workspace and creates a replacement", async ({ page }) => {
  await waitForAuthProxyBudget();
  const email = uniqueEmail();
  await signupVerifyAndLogin(page, email);

  await page.locator("#sidebar-nav-settings").click();
  const renamed = `Renamed ${Date.now()}`;
  const settingsForm = page.locator("#workspace-settings-form");
  await settingsForm.getByLabel("Workspace name", { exact: true }).fill(renamed);
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByText(/settings saved/i)).toBeVisible();
  await expect(settingsForm.getByLabel("Workspace name", { exact: true })).toHaveValue(renamed);

  await page.getByRole("button", { name: /delete this workspace/i }).click();
  const slug = await page.getByLabel(/workspace slug/i).getAttribute("placeholder");
  await page.getByLabel(/workspace slug/i).fill(slug ?? "");
  await page.getByRole("button", { name: /confirm delete/i }).click();
  await expect(page).toHaveURL(/select-workspace/);
  await expect(page.getByText(/account is active, but it does not currently have a workspace/i)).toBeVisible();
  const storage = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  }));
  expect(storage.local).toHaveLength(0);
  expect(storage.session).toHaveLength(0);

  await page.getByRole("textbox", { name: "Workspace name" }).fill("Replacement Workspace");
  await page.getByRole("combobox", { name: "Timezone" }).selectOption("UTC");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.locator(".dash-inline-controls").getByText("Replacement Workspace", { exact: true })).toBeVisible();
});
