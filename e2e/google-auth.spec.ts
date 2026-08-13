import { expect, test, type Page } from "@playwright/test";

const CSRF_TOKEN = "google-e2e-csrf";
const session = {
  accessToken: "google-e2e-access-token",
  expiresInSeconds: 900,
  workspaceSelectionRequired: false,
  user: {
    id: "10000000-0000-4000-8000-000000000001",
    email: "google-user@example.com",
    displayName: "Google User",
    emailVerified: true,
  },
  currentMembership: {
    id: "20000000-0000-4000-8000-000000000001",
    workspaceId: "30000000-0000-4000-8000-000000000001",
    workspaceName: "Google Workspace",
    workspaceSlug: "google-workspace",
    timezone: "UTC",
    role: "MANAGER",
  },
  workspaces: [{
    id: "30000000-0000-4000-8000-000000000001",
    name: "Google Workspace",
    slug: "google-workspace",
    timezone: "UTC",
    role: "MANAGER",
  }],
};

const problem = (code: string, detail: string) => ({
  type: `https://adept.local/problems/${code.toLowerCase().replaceAll("_", "-")}`,
  title: "Request failed",
  status: 401,
  detail,
  instance: "/api/v1/auth/google/onboarding",
  code,
  traceId: "google-e2e",
});

async function mockCsrf(page: Page) {
  await page.route("**/api/v1/auth/csrf", (route) => route.fulfill({
    status: 204,
    headers: { "set-cookie": `XSRF-TOKEN=${CSRF_TOKEN}; Path=/; SameSite=Lax` },
  }));
}

async function mockProjects(page: Page) {
  await page.route("**/api/v1/projects", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "[]",
  }));
}

test("returning Google user restores the Adept session after the OAuth redirect", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("adept.sessionMutationJournal", JSON.stringify({
      epoch: "interrupted-login",
      kind: "login",
      status: "started",
      startedAt: new Date().toISOString(),
    }));
  });
  await mockCsrf(page);
  await mockProjects(page);
  await page.route("**/api/v1/auth/refresh", async (route) => {
    expect(route.request().headers()["x-xsrf-token"]).toBe(CSRF_TOKEN);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
  });
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      user: session.user,
      currentMembership: session.currentMembership,
      workspaces: session.workspaces,
    }),
  }));

  await page.goto("/login?google=success");

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("adept.sessionMutationJournal"))).toBeNull();
});

test("new Google user completes workspace onboarding", async ({ page }) => {
  await mockCsrf(page);
  await mockProjects(page);
  await page.route("**/api/v1/auth/refresh", (route) => route.fulfill({
    status: 401,
    contentType: "application/problem+json",
    body: JSON.stringify(problem("SESSION_INVALID", "Please sign in.")),
  }));
  let onboardingBody: unknown;
  await page.route("**/api/v1/auth/google/onboarding", async (route) => {
    onboardingBody = route.request().postDataJSON();
    expect(route.request().headers()["x-xsrf-token"]).toBe(CSRF_TOKEN);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
  });

  await page.goto("/google/onboarding");
  await page.getByRole("textbox", { name: "Workspace name" }).fill("Google Workspace");
  await page.getByRole("combobox", { name: "Timezone" }).selectOption("UTC");
  await page.getByRole("button", { name: "Create workspace" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  expect(onboardingBody).toEqual({ workspaceName: "Google Workspace", timezone: "UTC" });
  const storageKeys = await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)]);
  expect(storageKeys.filter((key) => /token|password|credential|access/i.test(key))).toEqual([]);
});

test("Google failures and expired onboarding remain recoverable", async ({ page }) => {
  await mockCsrf(page);
  await page.route("**/api/v1/auth/refresh", (route) => route.fulfill({
    status: 401,
    contentType: "application/problem+json",
    body: JSON.stringify(problem("SESSION_INVALID", "Please sign in.")),
  }));

  await page.goto("/login?google_error=authentication_failed");
  await expect(page.getByText("Google sign-in could not be completed. Please try again.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveAttribute(
    "href",
    "/api/v1/auth/google/start",
  );

  await page.route("**/api/v1/auth/google/onboarding", (route) => route.fulfill({
    status: 401,
    contentType: "application/problem+json",
    body: JSON.stringify(problem("GOOGLE_SIGNUP_SESSION_INVALID", "Please start again.")),
  }));
  await page.goto("/google/onboarding");
  await page.getByRole("textbox", { name: "Workspace name" }).fill("Expired Workspace");
  await page.getByRole("button", { name: "Create workspace" }).click();

  await expect(page.getByText("Your Google signup session expired. Start again with Google.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Start again with Google" })).toHaveAttribute(
    "href",
    "/api/v1/auth/google/start",
  );
});
