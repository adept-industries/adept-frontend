# Repository settings dropdowns

Companion API endpoint: `GET /api/v1/repositories/{repositoryId}/settings-options`.

- Workflow-run mode shows branches and workflow names; Deployment API mode shows environments.
- Click a field to search GitHub names and select multiple options. Selected values appear as removable chips.
- Add custom patterns one at a time, such as `release/*` or `*deploy*`. Commas are allowed inside a name and do not split it. DORA Exclusions remains the existing comma-separated input.
- Existing values and defaults are retained until explicitly changed. Switching deployment signal preserves hidden field selections. Nothing saves automatically.
- Choose only workflows/environments that really represent production; discovery does not determine this automatically.
- Empty, unavailable or partial lists still allow manual entry. Retry options appears after a discovery failure. The API caches successful results for five minutes; reopening the modal revalidates against that API cache.
- Exact GitHub choices escape glob metacharacters (`[`, `?`, `*`). Custom patterns intentionally use glob syntax. Existing saved patterns are not rewritten.
- Keyboard: Enter/Space opens the dropdown; Tab moves through the search, checkboxes and buttons; Enter adds typed custom input without submitting the form; Escape closes and returns focus.

## Local verification

1. Run the API `feature/repository-settings-options` branch and frontend `feature/repository-settings-dropdowns` branch with your existing local configuration. No new env values are required.
2. Log in as Manager → Integrations → repository Settings. Test branches/workflows, then switch to Deployment API for environments.
3. Select multiple names; add/remove a custom pattern; switch modes and verify selections persist. Save and reopen to verify persistence. Cancel must not save.
4. Check a repository without workflows/environments, and an unavailable options endpoint: custom entry and Save must still work.
5. Check a narrow/mobile viewport and long names. Dropdowns and chips should wrap without horizontal overflow.

Run `npm run test:run`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run api:check`.

With the local frontend running, use `PLAYWRIGHT_BASE_URL=http://localhost:5173 npx playwright test e2e/repository-settings.spec.ts` for mocked desktop/mobile browser checks (adjust the port to your local server).

Release API first, frontend second. A missing API endpoint gracefully falls back to manual entry. Saving effective settings changes retains the existing API behavior: it queues DORA backfill for tracked, non-archived repositories.
