import { test, expect } from "@playwright/test";
import { waitForEmail, extractLink, navigateToLink } from "./helpers/mailpit";
import {
  uniqueEmail,
  TEST_PASSWORD,
  TEST_DISPLAY_NAME,
  TEST_WORKSPACE_NAME,
} from "./helpers/account";

/**
 * Browser lifecycle test (spec requirement):
 * 1. Signup.
 * 2. Poll Mailpit.
 * 3. Open verification link.
 * 4. Verify.
 * 5. Login.
 * 6. Confirm dashboard / current workspace.
 * 7. Confirm localStorage contains no access token.
 * 8. Hard reload.
 * 9. Confirm refresh bootstrap restores the session.
 * 10. Logout.
 * 11. Hard reload.
 * 12. Confirm the session remains ended.
 */
test("browser auth lifecycle", async ({ page }) => {
  const email = uniqueEmail();

  // 1. Signup
  await page.goto("/signup");
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByLabel(/full name/i).fill(TEST_DISPLAY_NAME);
  await page.getByLabel(/^password/i).fill(TEST_PASSWORD);
  await page.getByLabel(/workspace name/i).fill(TEST_WORKSPACE_NAME);
  // Timezone — select UTC if available.
  const tzSelect = page.locator('select[id="timezone"]');
  if (await tzSelect.isVisible()) await tzSelect.selectOption("UTC");
  await page.getByRole("button", { name: /create account/i }).click();

  // Should land on check-email page.
  await expect(page).toHaveURL(/check-email/);

  // 2. Poll Mailpit for the verification email.
  const body = await waitForEmail(email, "/verify-email");

  // 3. Extract and navigate to the verification link (sanitized on failure).
  const verifyLink = extractLink(body, "/verify-email");
  await navigateToLink(page, verifyLink);

  // 4. Verify — wait for success banner then click Sign in.
  await expect(page.getByText(/email has been verified/i)).toBeVisible({ timeout: 60_000 });
  await page.getByRole("link", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/login/, { timeout: 60_000 });

  // 5. Login.
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByLabel(/^password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /log in|sign in/i }).click();

  // 6. Confirm dashboard and current workspace visible.
  await expect(page).toHaveURL(/dashboard/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

  // 7. Only the non-secret workspace preference may be persisted.
  const storageKeys = await page.evaluate(() => {
    return {
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    };
  });
  const dangerousKeys = [...storageKeys.local, ...storageKeys.session].filter((key) =>
    ["token", "password", "credential", "access"].some((part) => key.toLowerCase().includes(part)),
  );
  expect(dangerousKeys).toHaveLength(0);
  expect(storageKeys.local.every((key) => key === "adept.currentWorkspaceId")).toBe(true);

  // 8. Hard reload.
  await page.reload();

  // 9. Confirm refresh bootstrap restores session.
  await expect(page).toHaveURL(/dashboard/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

  // Two tabs must share refresh rotation safely and remain refreshable.
  const secondPage = await page.context().newPage();
  await secondPage.goto("/dashboard");
  await expect(secondPage.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  await Promise.all([page.reload(), secondPage.reload()]);
  await Promise.all([
    expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible(),
    expect(secondPage.getByRole("heading", { name: /dashboard/i })).toBeVisible(),
  ]);
  await page.reload();
  await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

  // 10. Logout.
  await page.getByRole("button", { name: /log out/i }).click();
  await expect(page).toHaveURL(/login/, { timeout: 60_000 });
  await secondPage.close();

  // 11. Hard reload.
  await page.reload();

  // 12. Session remains ended — still on login.
  await expect(page).toHaveURL(/login/, { timeout: 60_000 });
});
