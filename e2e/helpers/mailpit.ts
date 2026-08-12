import type { Page } from "@playwright/test";

const MAILPIT_API = "http://localhost:8025/api/v1";

/**
 * Polls Mailpit for the latest email to a specific address.
 * Optionally filters for emails containing a specific substring.
 */
export async function waitForEmail(
  email: string,
  mustContain?: string,
  timeoutMs = 90_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  const seenBodies: string[] = [];

  while (Date.now() < deadline) {
    const q = new URLSearchParams({ query: `to:"${email}"` });
    const res = await fetch(`${MAILPIT_API}/search?${q.toString()}`);
    if (!res.ok) {
      await sleep(1000);
      continue;
    }

    const data = await res.json() as {
      messages?: Array<{ ID: string; To: Array<{ Address: string }> }>;
    };

    const messages = data.messages ?? [];
    for (const msg of messages) {
      // Exact recipient match required.
      const toMatch = msg.To.some(
        (r) => r.Address.toLowerCase() === email.toLowerCase(),
      );
      if (!toMatch) continue;

      const txtRes = await fetch(`${MAILPIT_API}/message/${msg.ID}`);
      if (!txtRes.ok) continue;
      const body = await txtRes.json() as { Text?: string };

      if (body.Text) {
        if (!seenBodies.includes(body.Text)) {
          seenBodies.push(body.Text);
        }
        if (mustContain && !body.Text.includes(mustContain)) {
          continue;
        }
        return body.Text;
      }
    }

    await sleep(1000);
  }

  throw new Error(`Timed out waiting for email (sanitized). Seen bodies: ${JSON.stringify(seenBodies)}`);
}

/**
 * Extracts a same-origin tokenized link from the email body and validates its path.
 * Never embeds the raw link in error messages.
 */
export function extractLink(
  body: string,
  expectedPath: "/verify-email" | "/reset-password",
): string {
  const escaped = expectedPath.replace("/", "\\/");
  const re = new RegExp(`http://[^\\s"'<>]*${escaped}[^\\s"'<>]*`, "i");
  const match = re.exec(body);
  if (!match) {
    throw new Error(`Could not find ${expectedPath} link in email (sanitized)`);
  }
  const link = match[0];
  try {
    const url = new URL(link);
    if (!url.pathname.startsWith(expectedPath)) {
      throw new Error("Path mismatch");
    }
    return link;
  } catch {
    throw new Error(`Link failed path validation for ${expectedPath} (sanitized)`);
  }
}

/**
 * Navigates to the tokenized link. Wraps any error in a sanitized message.
 */
export async function navigateToLink(page: Page, link: string): Promise<void> {
  try {
    await page.goto(link);
  } catch {
    throw new Error("Navigation to tokenized link failed (sanitized)");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
