export type ActionTokenRoute = "verify-email" | "reset-password" | "accept-invite";

interface ActionTokenGuard {
  route: ActionTokenRoute | null;
  token: string | null;
  flight: Promise<unknown> | null;
}

const guard: ActionTokenGuard = { route: null, token: null, flight: null };

/** Called by the route loader before its page element renders. */
export function captureActionToken(route: ActionTokenRoute): void {
  if (guard.route === route && (guard.token || guard.flight)) return;
  if (guard.route !== route) clearActionToken();

  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  let token = hashParams.get("token");
  if (!token) {
    const searchParams = new URLSearchParams(window.location.search);
    token = searchParams.get("token");
  }
  if (!token) return;

  history.replaceState(null, "", window.location.pathname);
  guard.route = route;
  guard.token = token;
}

export function hasActionToken(route?: ActionTokenRoute): boolean {
  return guard.token !== null && (route === undefined || guard.route === route);
}

export function getActionToken(route?: ActionTokenRoute): string | null {
  if (route !== undefined && guard.route !== route) return null;
  return guard.token;
}

/**
 * Runs exactly one submission for the active route. The raw token is supplied
 * only to the callback and never enters React state. A correctable validation
 * error may retain the token for another password submission.
 */
export function submitActionToken<T>(
  route: ActionTokenRoute,
  submit: (token: string) => Promise<T>,
  retainOnError: (error: unknown) => boolean = () => false,
): Promise<T> | null {
  if (guard.route !== route || !guard.token) return null;
  if (guard.flight) return guard.flight as Promise<T>;

  const token = guard.token;
  const flight = submit(token).then(
    (value) => {
      clearActionToken();
      return value;
    },
    (error: unknown) => {
      guard.flight = null;
      if (!retainOnError(error)) clearActionToken();
      throw error;
    },
  );
  guard.flight = flight;
  return flight;
}

export function clearActionToken(): void {
  guard.route = null;
  guard.token = null;
  guard.flight = null;
}

/** Compatibility helper used only by the existing single-consume test. */
export function consumeActionToken(): string | null {
  const token = guard.token;
  clearActionToken();
  return token;
}
