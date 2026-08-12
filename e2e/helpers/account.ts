/**
 * Shared test account helpers.
 * Generates unique emails per test to prevent state bleed between tests.
 */

let counter = 0;

/**
 * Generates a unique test email address using a timestamp + counter.
 * Each test call returns a distinct address.
 */
export function uniqueEmail(): string {
  counter += 1;
  return `test-${Date.now()}-${counter}@example.com`;
}

export const TEST_PASSWORD = "TestP@ssword1!";
export const TEST_DISPLAY_NAME = "Test User";
export const TEST_WORKSPACE_NAME = "Test Workspace";
export const TEST_TIMEZONE = "UTC";

/** The production proxy shares one auth bucket across the single CI client IP. */
export async function waitForAuthProxyBudget(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20_000));
}

export async function signupVerifyAndLogin(
  page: import("@playwright/test").Page,
  email: string,
): Promise<void> {
  const { waitForEmail, extractLink, navigateToLink } = await import("./mailpit.js");
  await page.goto("/signup");
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByLabel(/full name/i).fill(TEST_DISPLAY_NAME);
  await page.getByLabel(/^password/i).fill(TEST_PASSWORD);
  await page.getByLabel(/workspace name/i).fill(TEST_WORKSPACE_NAME);
  const timezone = page.getByLabel(/timezone/i);
  const options = await timezone.locator("option").all();
  const utcOption = await timezone.locator('option[value="UTC"]').count();
  if (utcOption > 0) {
    await timezone.selectOption(TEST_TIMEZONE);
  } else if (options.length > 0) {
    await timezone.selectOption({ index: 0 });
  }
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/check-email/);
  const body = await waitForEmail(email, "/verify-email");
  await navigateToLink(page, extractLink(body, "/verify-email"));
  await page.getByText(/email has been verified/i).waitFor();
  await page.getByRole("link", { name: /sign in/i }).click();
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByLabel(/^password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/);
}
