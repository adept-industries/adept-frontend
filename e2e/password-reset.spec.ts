import { expect, test } from "@playwright/test";
import {
  signupVerifyAndLogin,
  TEST_PASSWORD,
  uniqueEmail,
  waitForAuthProxyBudget,
} from "./helpers/account.js";
import { extractLink, navigateToLink, waitForEmail } from "./helpers/mailpit.js";

test("password reset invalidates the previous session", async ({ browser, page }) => {
  await waitForAuthProxyBudget();
  const email = uniqueEmail();
  const newPassword = "NewTestP@ssword2!";
  await signupVerifyAndLogin(page, email);

  const recoveryContext = await browser.newContext({
    baseURL: process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:3000",
  });
  const recoveryPage = await recoveryContext.newPage();
  await recoveryPage.goto("/forgot-password");
  await recoveryPage.getByRole("textbox", { name: /email/i }).fill(email);
  await recoveryPage.getByRole("button", { name: /send reset link/i }).click();
  const body = await waitForEmail(email, "/reset-password");
  await navigateToLink(recoveryPage, extractLink(body, "/reset-password"));
  await recoveryPage.locator("#reset-password").fill(newPassword);
  await recoveryPage.getByRole("button", { name: /reset password/i }).click();
  await expect(recoveryPage).toHaveURL(/login\?reset=1/);

  const rejectedRequest = page.waitForResponse((response) =>
    response.request().method() === "GET" &&
    new URL(response.url()).pathname === "/api/v1/workspaces/current",
  );
  await page.locator("#nav-settings-dropdown-btn").click();
  await page.locator("#nav-workspace-settings-menuitem").click();
  expect((await rejectedRequest).status()).toBe(401);
  await expect(page).toHaveURL(/login/);

  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByLabel(/^password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText(/email or password is incorrect/i)).toBeVisible();
  await page.getByLabel(/^password/i).fill(newPassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/);
  await recoveryContext.close();
});
