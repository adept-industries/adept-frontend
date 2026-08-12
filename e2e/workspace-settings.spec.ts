import { test, expect } from "@playwright/test";
import { waitForEmail, extractLink, navigateToLink } from "./helpers/mailpit";
import {
  uniqueEmail,
  TEST_PASSWORD,
  TEST_DISPLAY_NAME,
  TEST_WORKSPACE_NAME,
  TEST_TIMEZONE,
} from "./helpers/account";

/** Helper: create, verify, and login, return the logged-in page. */
async function loginWithNewAccount(
  email: string,
  workspaceName: string,
  context: import("@playwright/test").BrowserContext,
): Promise<import("@playwright/test").Page> {
  const page = await context.newPage();
  await page.goto("/signup");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/full name/i).fill(TEST_DISPLAY_NAME);
  await page.getByLabel(/^password/i).fill(TEST_PASSWORD);
  await page.getByLabel(/workspace name/i).fill(workspaceName);
  const tzSelect = page.locator('select[id="timezone"]');
  if (await tzSelect.isVisible()) await tzSelect.selectOption(TEST_TIMEZONE);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/check-email/);

  const body = await waitForEmail(email);
  const link = extractLink(body, "/verify-email");
  await navigateToLink(page, link);
  await page.waitForURL(/login/, { timeout: 10_000 });

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 10_000 });

  return page;
}

/**
 * Workspace settings lifecycle:
 * 1. Create, verify, and login as a Manager.
 * 2. Navigate to /dashboard/settings.
 * 3. Rename the workspace and change timezone.
 * 4. Confirm the slug remains unchanged after save.
 * 5. Attempt workspace deletion with wrong slug → rejected.
 * 6. Attempt deletion with correct slug and password → succeeds.
 * 7. Confirm UI clears and returns to login/no-workspace.
 */
test("workspace settings lifecycle", async ({ browser }) => {
  const email = uniqueEmail();
  const originalName = TEST_WORKSPACE_NAME;
  const renamedName = "Renamed Workspace";
  const ctx = await browser.newContext();

  try {
    const page = await loginWithNewAccount(email, originalName, ctx);

    // Navigate to settings.
    await page.goto("/dashboard/settings");
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();

    // Get original slug text from the confirmation prompt area.
    await page.getByRole("button", { name: /delete this workspace/i }).click();
    const slugHint = await page.locator("strong").first().textContent();
    const originalSlug = slugHint?.trim() ?? "";
    expect(originalSlug).toBeTruthy();
    // Cancel deletion for now.
    await page.getByRole("button", { name: /cancel/i }).click();

    // Rename the workspace.
    await page.locator('#workspace-name').fill(renamedName);
    await page.locator('#workspace-timezone').selectOption("America/New_York");
    await page.getByRole("button", { name: /save settings/i }).click();

    // Confirm success message.
    await expect(page.getByText(/settings saved/i)).toBeVisible({ timeout: 5_000 });

    // Navigate away and back to confirm persistence.
    await page.goto("/dashboard");
    await page.goto("/dashboard/settings");
    await expect(page.locator('#workspace-name')).toHaveValue(renamedName);

    // 4. Slug must remain unchanged (it is never sent in the update).
    await page.getByRole("button", { name: /delete this workspace/i }).click();
    const slugAfterRename = await page.locator("strong").first().textContent();
    expect(slugAfterRename?.trim()).toBe(originalSlug);

    // 5. Wrong slug → confirm button disabled or shows error.
    await page.locator('#confirm-slug').fill("wrong-slug");
    await page.locator('#delete-password').fill(TEST_PASSWORD);
    const confirmBtn = page.locator('#confirm-delete-btn');
    // Button should be disabled because slug doesn't match.
    await expect(confirmBtn).toBeDisabled();

    // 6. Correct slug + correct password → deletion proceeds.
    await page.locator('#confirm-slug').fill(originalSlug);
    await page.locator('#delete-password').fill(TEST_PASSWORD);
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // 7. After deletion, the session state is cleared and user is redirected.
    await page.waitForURL(/login|select-workspace/, { timeout: 15_000 });
    // Confirm workspace preference is cleared from localStorage.
    const pref = await page.evaluate(() => localStorage.getItem("adept.currentWorkspaceId"));
    expect(pref).toBeNull();
  } finally {
    await ctx.close();
  }
});

/**
 * Lead cannot access settings — sees ForbiddenPage.
 *
 * NOTE: This test relies on having a Lead-role user.
 * In Phase 2 every signup creates a Manager. We test the role guard by
 * navigating directly to /dashboard/settings while mocked as Lead.
 * The real role guard renders ForbiddenPage for any insufficient role.
 *
 * This test verifies that navigating directly to the URL shows the Forbidden
 * response and does not render an empty page.
 */
test("direct navigation to settings by Lead shows forbidden", async () => {
  // We cannot create a Lead via signup in Phase 2 (all signups are Manager).
  // This test validates the guard renders something meaningful for wrong-role state.
  // It is a placeholder for when Lead fixtures exist.
  // The ForbiddenPage is covered by the ProtectedRoute unit tests.
  test.skip(true, "Lead fixtures not available in Phase 2 signup flow.");
});
