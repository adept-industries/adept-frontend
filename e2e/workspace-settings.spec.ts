import { expect, test } from "@playwright/test";
import {
  signupVerifyAndLogin,
  TEST_PASSWORD,
  uniqueEmail,
  waitForAuthProxyBudget,
} from "./helpers/account.js";

test("Manager updates then requests workspace deletion", async ({ page }) => {
  await waitForAuthProxyBudget();
  const email = uniqueEmail();
  await signupVerifyAndLogin(page, email);

  await page.getByRole("link", { name: /workspace settings/i }).click();
  const renamed = `Renamed ${Date.now()}`;
  await page.getByLabel(/workspace name/i).fill(renamed);
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByText(/settings saved/i)).toBeVisible();
  await expect(page.getByText(renamed, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /delete this workspace/i }).click();
  const slug = await page.getByLabel(/workspace slug/i).getAttribute("placeholder");
  await page.getByLabel(/workspace slug/i).fill(slug ?? "");
  await page.getByLabel(/current password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /confirm delete/i }).click();
  await expect(page).toHaveURL(/login\?deleted=1/);
  await expect(page.getByText(/deletion was requested/i)).toBeVisible();
  const storage = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  }));
  expect(storage.local).toHaveLength(0);
  expect(storage.session).toHaveLength(0);
});
