# Adept Frontend

React 19, TypeScript, and Vite browser application for Adept. Phase 2 includes account lifecycle, refresh-backed authentication, workspace selection/switching and creation, project selection, Manager settings, and browser acceptance tests.

## Routes

- `/signup`, `/login`, `/check-email`, `/forgot-password`
- `/verify-email` and `/reset-password` for fragment-based email action links
- `/select-workspace` for sessions with multiple memberships
- `/dashboard` for an authenticated workspace
- `/dashboard/settings` for Managers
- `/dashboard/projects` for Manager project administration

Protected routes wait for refresh bootstrap. Leads receive a forbidden page for Manager settings, and authenticated users visiting login or signup return to the dashboard.

## Local prerequisites

Start the sibling API, PostgreSQL, and Mailpit before exercising account flows. With the repository Compose stack, the production-like frontend is available at <http://localhost:3000>, the API at <http://localhost:8080>, and Mailpit at <http://localhost:8025>.

For Vite development:

```bash
npm ci
npm run dev -- --host 127.0.0.1
```

Open <http://localhost:5173>. Vite proxies relative `/api` requests to `http://localhost:8080`.

## Authentication and CSRF

The access JWT exists only in a module-level memory store. It is never written to browser storage, cookies, URLs, logs, or TanStack Query. Local storage contains only the non-secret current-workspace UUID; session storage may contain a non-secret selected-project UUID per workspace.

The API owns the HttpOnly refresh cookie. The frontend coordinates refresh, login, logout, workspace switch, and password reset with same-origin CSRF/session locks. Unsafe requests read the current `XSRF-TOKEN` cookie immediately before dispatch. An authenticated request may perform one coordinated refresh and one replay after a `401`; it never refreshes a `403`.

## OpenAPI contract

The committed API contract is `openapi/adept-api-v1.json`; feature request and response types derive from its generated `paths`, `operations`, and `components` definitions.

```bash
npm run api:generate   # regenerate src/api/generated/schema.ts
npm run api:check      # fail when committed generated types drift
```

Never edit `src/api/generated/schema.ts` manually.

## Verification

```bash
npm ci
npm run api:check
npm run lint
npm run typecheck
npm run test:run
npm run build
docker build --tag adept-frontend:phase2 .
npm run nginx:verify -- adept-frontend:phase2
```

Run the browser journeys against the full Compose stack:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run e2e
```

Playwright uses Chromium, one worker, no retries, and no trace/video/screenshot artifacts because account links and cookies are sensitive. The stateful backend journeys include short spacing so one CI client IP stays inside the production proxy's auth rate limit.

`e2e/google-auth.spec.ts` covers the Adept-side Google return, first-time onboarding, and recovery paths with deterministic route mocks. It intentionally does not automate `accounts.google.com`; use a manual local smoke test with a Google test account to verify the provider consent screen and configured redirect URI.
