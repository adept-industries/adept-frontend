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
