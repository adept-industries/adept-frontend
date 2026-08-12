import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Phase 2 E2E tests.
 *
 * Rules:
 * - Chromium only for Phase 2 CI.
 * - 1 worker for mail/session determinism.
 * - retries: 0 (tests consume stateful tokens and create/delete data).
 * - No trace or video recording to avoid storing credentials/tokens.
 * - forbidOnly in CI.
 * - Unique email per test.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",

  /* Give tests more time in slow CI environments */
  timeout: 90000,
  expect: { timeout: 60000 },

  /* Never allow test.only in CI. */
  forbidOnly: !!process.env["CI"],

  /* No retries — tests consume stateful tokens. */
  retries: 0,

  /* Single worker — Mailpit/session ordering must be deterministic. */
  workers: 1,

  /* Reporter — list in dev, GitHub Actions in CI. */
  reporter: process.env["CI"] ? "github" : "list",

  /* No trace or video — must not capture cookies, tokens, or email bodies. */
  use: {
    actionTimeout: 60000,
    navigationTimeout: 60000,
    baseURL: process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:5173",
    trace: "off",
    video: "off",
    /* Screenshot only on failure to aid debugging without leaking URLs. */
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
