import type { Page } from "@playwright/test";

const MAILPIT_ORIGIN = "http://localhost:8025";
const MAILPIT_API = `${MAILPIT_ORIGIN}/api/v1`;

export async function waitForEmail(
  email: string,
  expectedPath: "/verify-email" | "/reset-password",
  timeoutMs = 90_000,
): Promise<string> {
  const normalizedEmail = email.toLowerCase();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const search = new URLSearchParams({ query: `to:"${normalizedEmail}"` });
    const response = await fetch(`${MAILPIT_API}/search?${search.toString()}`);
    if (response.ok) {
      const result = await response.json() as {
        messages?: Array<{ ID: string; To: Array<{ Address: string }> }>;
      };
      for (const message of result.messages ?? []) {
        if (!message.To.some((recipient) => recipient.Address.toLowerCase() === normalizedEmail)) continue;
        const textResponse = await fetch(`${MAILPIT_ORIGIN}/view/${encodeURIComponent(message.ID)}.txt`);
        if (!textResponse.ok) continue;
        const body = await textResponse.text();
        if (body.includes(expectedPath)) return body;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Timed out waiting for the expected ${expectedPath} email.`);
}

export function extractLink(
  body: string,
  expectedPath: "/verify-email" | "/reset-password",
  expectedOrigin = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:3000",
): string {
  const candidates = body.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate.replace(/[).,]+$/, ""));
      if (url.origin === expectedOrigin && url.pathname === expectedPath && url.hash.startsWith("#token=")) {
        return url.toString();
      }
    } catch {
      // Continue without exposing the candidate.
    }
  }
  throw new Error(`The email did not contain a valid ${expectedPath} link.`);
}

export async function navigateToLink(page: Page, link: string): Promise<void> {
  try {
    await page.goto(link, { waitUntil: "domcontentloaded" });
  } catch {
    throw new Error("Navigation to the action link failed.");
  }
}
