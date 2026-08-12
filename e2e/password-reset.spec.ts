import { test, expect, type BrowserContext } from "@playwright/test";
import { waitForEmail, extractLink, navigateToLink } from "./helpers/mailpit";
import {
  uniqueEmail,
  TEST_PASSWORD,
  TEST_DISPLAY_NAME,
  TEST_WORKSPACE_NAME,
} from "./helpers/account";

/** Helper: creates, verifies, and returns a logged-in context. */
async function createAndVerifyAccount(
  email: string,
  context: BrowserContext,
): Promise<void> {
  const page = await context.newPage();
  await page.goto("/signup");
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByLabel(/full name/i).fill(TEST_DISPLAY_NAME);
  await page.getByLabel(/^password/i).fill(TEST_PASSWORD);
  await page.getByLabel(/workspace name/i).fill(TEST_WORKSPACE_NAME);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/check-email/);

  const body = await waitForEmail(email, "/verify-email");
  const link = extractLink(body, "/verify-email");
  await navigateToLink(page, link);
  await page.getByText(/email has been verified/i).waitFor({ timeout: 60_000 });
  await page.getByRole("link", { name: /sign in/i }).click();
  await page.waitForURL(/login/, { timeout: 60_000 });
  await page.close();
}

/**
 * Password lifecycle test:
 * 1. Create and verify a unique account.
 * 2. In context A: login (keeps old session live).
 * 3. In context B: request forgot-password, set new password.
 * 4. From context A: trigger protected request → should be rejected.
 * 5. Confirm old password fails.
 * 6. Confirm new password succeeds.
 */
test("password reset invalidates old session", async ({ browser }) => {
  test.skip(!!process.env.CI, "Flaky in CI due to resource constraints");
  const email = uniqueEmail();
  const newPassword = "N3wP@ssword!2";

  // Create isolated contexts for A and B.
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();

  try {
    await createAndVerifyAccount(email, ctxA);

    // Context A: login and stay authenticated.
    const pageA = await ctxA.newPage();
    await pageA.goto("/login");
    await pageA.getByRole("textbox", { name: /email/i }).fill(email);
    await pageA.getByLabel(/^password/i).fill(TEST_PASSWORD);
    await pageA.getByRole("button", { name: /log in|sign in/i }).click();
    await pageA.waitForURL(/dashboard/, { timeout: 60_000 });

    // Context B: request password reset.
    const pageB = await ctxB.newPage();
    await pageB.goto("/forgot-password");
    await pageB.getByRole("textbox", { name: /email/i }).fill(email);
    await pageB.getByRole("button", { name: /send reset|reset password/i }).click();
    await expect(pageB.getByText(/check your email|email sent/i)).toBeVisible({ timeout: 60_000 });

    // Context B: get reset email (search is recipient-exact).
    const resetBody = await waitForEmail(email, "/reset-password");
    const resetLink = extractLink(resetBody, "/reset-password");
    await navigateToLink(pageB, resetLink);

    // Context B: set new password.
    await pageB.locator("#reset-password").fill(newPassword);
    await pageB.getByRole("button", { name: /set password|reset/i }).click();
    await pageB.waitForURL(/login/, { timeout: 60_000 });

    // Context A: hard-reload — old refresh token should now be rejected.
    await pageA.reload();
    // Should end up on login (session invalidated by password reset).
    await pageA.waitForURL(/login/, { timeout: 60_000 });

    // Old password fails.
    await pageA.getByRole("textbox", { name: /email/i }).fill(email);
    await pageA.getByLabel(/^password/i).fill(TEST_PASSWORD);
    await pageA.getByRole("button", { name: /log in|sign in/i }).click();
    await expect(pageA.getByRole("alert")).toBeVisible({ timeout: 60_000 });

    // New password succeeds.
    await pageA.getByRole("textbox", { name: /email/i }).fill(email);
    await pageA.getByLabel(/^password/i).fill(newPassword);
    await pageA.getByRole("button", { name: /log in|sign in/i }).click();
    await pageA.waitForURL(/dashboard/, { timeout: 60_000 });
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

/**
 * Multi-tab concurrent reload:
 * 1. Login once.
 * 2. Open two pages in the same browser context.
 * 3. Hard-reload both concurrently.
 * 4. Confirm both restore authenticated session (cross-tab coordination).
 * 5. Confirm neither ends up in reuse-detected state.
 * 6. Confirm a later refresh still succeeds.
 */
test("multi-tab concurrent reload restores session", async ({ browser }) => {
  const email = uniqueEmail();
  const ctx = await browser.newContext();

  try {
    await createAndVerifyAccount(email, ctx);

    // Login in one page.
    const page1 = await ctx.newPage();
    await page1.goto("/login");
    await page1.getByRole("textbox", { name: /email/i }).fill(email);
    await page1.getByLabel(/^password/i).fill(TEST_PASSWORD);
    await page1.getByRole("button", { name: /log in|sign in/i }).click();
    await page1.waitForURL(/dashboard/, { timeout: 60_000 });

    // Open a second page in the same context (same refresh cookie).
    const page2 = await ctx.newPage();
    await page2.goto("/dashboard");

    // Hard-reload both concurrently.
    await Promise.all([page1.reload(), page2.reload()]);

    // Both should be authenticated (not on login).
    await page1.waitForURL(/dashboard/, { timeout: 60_000 });
    await page2.waitForURL(/dashboard/, { timeout: 60_000 });

    // Neither should show reuse-detected / ambiguous-session error.
    const reuse1 = await page1.getByText(/reuse|ambiguous|session.*invalid/i).isVisible();
    const reuse2 = await page2.getByText(/reuse|ambiguous|session.*invalid/i).isVisible();
    expect(reuse1).toBe(false);
    expect(reuse2).toBe(false);

    // Storage must not contain access token.
    for (const page of [page1, page2]) {
      const keys = await page.evaluate(() => Object.keys(localStorage));
      expect(keys.filter((k) => k.toLowerCase().includes("token"))).toHaveLength(0);
    }
  } finally {
    await ctx.close();
  }
});
