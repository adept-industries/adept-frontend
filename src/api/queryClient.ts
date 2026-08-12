import { QueryClient } from "@tanstack/react-query";
import { isApiProblem } from "./problem.js";

/**
 * Shared QueryClient with conservative retry policy:
 * - mutations never retry;
 * - queries never retry any 4xx ApiProblem;
 * - network failures / 5xx retry at most once.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      retry: false,
    },
    queries: {
      retry: (failureCount, error) => {
        if (isApiProblem(error) && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 1;
      },
      // No persistent cache between sessions — access tokens are memory-only.
      gcTime: 5 * 60 * 1000, // 5 min garbage-collect time
      staleTime: 30 * 1000,  // 30 s stale time
    },
  },
});
