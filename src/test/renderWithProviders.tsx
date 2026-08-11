import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

interface RenderOptions {
  initialPath?: string;
}

/**
 * Render a component wrapped in the minimal providers needed for testing:
 * - A fresh per-test QueryClient (no retry, no stale time)
 * - MemoryRouter at the given initial path
 *
 * Auth state is typically mocked per-test via server.use() and AuthContext mocks.
 */
export function renderWithProviders(
  ui: ReactNode,
  { initialPath = "/" }: RenderOptions = {},
) {
  const testClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={testClient}>
      <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}
