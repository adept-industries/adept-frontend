import { expect, test, type Page } from "@playwright/test";

// Public-page checks use mock sessions only: no account creation or provider calls.
async function mockSession(page: Page, authenticated = false) {
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/auth/csrf") {
      return route.fulfill({ status: 204, headers: { "set-cookie": "XSRF-TOKEN=mock-csrf; Path=/; SameSite=Lax" } });
    }
    if (path === "/api/v1/auth/refresh" || path === "/api/v1/auth/me") {
      if (!authenticated) return route.fulfill({ status: 401, json: { code: "UNAUTHORIZED", status: 401 } });
      return route.fulfill({ json: {
        accessToken: "mock-access-token", expiresInSeconds: 900, workspaceSelectionRequired: false,
        user: { id: "user-1", email: "test@example.com", displayName: "Manager", emailVerified: true, hasPassword: true },
        currentMembership: { id: "mem-1", workspaceId: "ws-1", workspaceName: "Example", workspaceSlug: "example", timezone: "UTC", role: "MANAGER" },
        workspaces: [{ id: "ws-1", name: "Example", slug: "example", timezone: "UTC", role: "MANAGER" }],
      } });
    }
    return route.fulfill({ status: 404, json: {} });
  });
}

async function expectNoOverflow(page: Page) {
  const width = page.viewportSize()!.width;
  expect(await page.locator(".adept-landing").locator("main, header, footer, section, figure, dl, dt, dd, nav, h1, h2, h3, p, a, summary").evaluateAll((elements, viewportWidth) => {
    return elements.every((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= viewportWidth + 1 && element.scrollWidth <= element.clientWidth + 1;
    });
  }, width)).toBe(true);
}

for (const width of [320, 375, 768, 1440]) {
  test(`landing navigation and FAQs work without overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockSession(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Know what’s shipping.");
    await expect(page.getByRole("figure")).toContainText("Example dashboard");
    await expect(page.getByRole("figure")).not.toContainText("Illustrative data, not live metrics");
    await expect(page.locator(".dora-filter-bar")).toContainText("Last 30 Days");
    await expect(page.locator(".adept-landing__mock-select")).toContainText("All repositories");
    await expectNoOverflow(page);

    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "FAQs" }).click();
    await expect(page).toHaveURL(/\/#faq$/);
    const githubQuestion = page.locator("summary", { hasText: "How do I connect GitHub?" });
    await githubQuestion.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/Open Integrations in your workspace/)).toBeVisible();
    await page.keyboard.press("Space");
    await expect(page.getByText(/Open Integrations in your workspace/)).not.toBeVisible();

    for (const summary of await page.locator("summary").all()) await summary.click();
    await expect(page.locator("details[open]")).toHaveCount(7);
    await expectNoOverflow(page);
  });
}

test("account links use the signup and login routes", async ({ page }) => {
  await mockSession(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Create account" }).first().click();
  await expect(page).toHaveURL(/\/signup$/);
  await page.goto("/");
  await page.getByRole("banner").getByRole("link", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("authenticated visitors can use the landing alias and return to the dashboard", async ({ page }) => {
  await mockSession(page, true);
  await page.goto("/landing");
  await expect(page.getByRole("banner").getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
  await expect(page.getByRole("link", { name: "Create account" })).toHaveCount(0);
  for (const link of await page.getByRole("link", { name: "Open dashboard" }).all()) {
    await expect(link).toHaveAttribute("href", "/dashboard");
  }
});

test("authenticated visitors visiting the root domain are redirected to the dashboard", async ({ page }) => {
  await mockSession(page, true);
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("keyboard users can skip navigation", async ({ page }) => {
  await mockSession(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});
