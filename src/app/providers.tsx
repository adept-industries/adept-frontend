import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { AuthProvider } from "../auth/AuthProvider.js";
import { queryClient } from "../api/queryClient.js";

/**
 * Top-level provider tree.
 * Order: QueryClientProvider > AuthProvider > (RouterProvider is mounted in App).
 *
 * AuthProvider needs QueryClient during bootstrap but must be inside it.
 * RouterProvider must be inside AuthProvider so route guards can read auth state.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
