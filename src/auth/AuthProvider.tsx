import {
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { accessTokenStore } from "./accessTokenStore.js";
import { AuthContext, type AuthContextValue } from "./AuthContext.js";
import {
  isAmbiguousJournal,
  onSessionResult,
  runSessionMutation,
} from "./sessionMutationCoordinator.js";
import type { AuthState } from "./types.js";
import {
  forgotPassword as apiForgotPassword,
  getMe,
  login as apiLogin,
  logout as apiLogout,
  refreshSession,
  resetPassword as apiResetPassword,
  signup as apiSignup,
  switchWorkspace,
  verifyEmail as apiVerifyEmail,
  resendVerification,
} from "../features/auth/api.js";
import { ensureCsrf } from "../api/csrf.js";
import { workspacePreference } from "../lib/workspacePreference.js";
import { queryClient } from "../api/queryClient.js";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({ status: "bootstrapping" });
  // Track whether bootstrap has run once to be StrictMode-safe.
  const bootstrapped = useRef(false);
  // Session generation — incremented on login/logout/switch/reset.
  const generation = useRef(0);

  // ─── Bootstrap ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    void (async () => {
      // 1. Check for ambiguous journal — fail closed without sending refresh.
      if (await isAmbiguousJournal()) {
        setState({ status: "anonymous", ambiguousSession: true });
        return;
      }

      // 2. Ensure CSRF.
      try {
        await ensureCsrf();
      } catch {
        setState({ status: "anonymous" });
        return;
      }

      // 3. Attempt refresh through the coordinator.
      try {
        const result = await runSessionMutation("refresh", async () => {
          const pref = workspacePreference.get();
          return refreshSession(pref ?? undefined);
        });

        if (result.kind === "workspace-required") {
          setState({
            status: "workspaceRequired",
            user: result.user,
            workspaces: result.workspaces,
          });
          return;
        }

        // Authenticated — fetch /me for fresh data.
        const me = await getMe();
        generation.current += 1;
        setState({
          status: "authenticated",
          ...me,
          generation: generation.current,
        });

        // Persist workspace preference.
        workspacePreference.set(me.currentMembership.workspaceId);
      } catch {
        accessTokenStore.clear();
        setState({ status: "anonymous" });
      }
    })();
  }, []);

  // ─── Cross-tab result listener ───────────────────────────────────────────
  useEffect(() => {
    const unsub = onSessionResult((result) => {
      if (result.outcome === "ambiguous") {
        accessTokenStore.clear();
        queryClient.clear();
        setState({ status: "anonymous", ambiguousSession: true });
      }
    });
    return unsub;
  }, []);

  // ─── Actions ─────────────────────────────────────────────────────────────

  const signup = useCallback(
    async (params: {
      email: string;
      password: string;
      displayName: string;
      workspaceName: string;
      timezone: string;
    }) => {
      return apiSignup(params);
    },
    [],
  );

  const login = useCallback(async (params: { email: string; password: string }) => {
    const result = await runSessionMutation(
      "login",
      async () => apiLogin(params),
      { isCredentialAction: true },
    );
    // Refresh CSRF after login (API expired the old cookie).
    await ensureCsrf();

    if (result.kind === "workspace-required") {
      generation.current += 1;
      setState({
        status: "workspaceRequired",
        user: result.user,
        workspaces: result.workspaces,
      });
    } else {
      generation.current += 1;
      setState({
        status: "authenticated",
        ...result,
        generation: generation.current,
      });
      workspacePreference.set(result.currentMembership.workspaceId);
    }
  }, []);

  const selectWorkspace = useCallback(async (workspaceId: string) => {
    const result = await runSessionMutation("switch", async () =>
      switchWorkspace(workspaceId),
    );
    await ensureCsrf();
    if (result.kind === "authenticated") {
      generation.current += 1;
      setState({
        status: "authenticated",
        ...result,
        generation: generation.current,
      });
      workspacePreference.set(workspaceId);
    }
  }, []);

  const logout = useCallback(async () => {
    await runSessionMutation("logout", async () => apiLogout(), {
      isCredentialAction: true,
    });
    accessTokenStore.clear();
    workspacePreference.clear();
    queryClient.clear();
    generation.current += 1;
    await ensureCsrf();
    setState({ status: "anonymous" });
  }, []);

  const refresh = useCallback(async () => {
    const pref = workspacePreference.get();
    const result = await runSessionMutation("refresh", async () =>
      refreshSession(pref ?? undefined),
    );
    if (result.kind === "workspace-required") {
      setState({
        status: "workspaceRequired",
        user: result.user,
        workspaces: result.workspaces,
      });
    } else {
      generation.current += 1;
      setState((prev) => ({
        status: "authenticated",
        ...result,
        generation:
          prev.status === "authenticated" ? prev.generation : generation.current,
      }));
    }
  }, []);

  const value: AuthContextValue = {
    state,
    actions: { signup, login, selectWorkspace, logout, refresh } as AuthContextValue["actions"] & {
      forgotPassword: typeof apiForgotPassword;
      verifyEmail: typeof apiVerifyEmail;
      resetPassword: typeof apiResetPassword;
      resendVerification: typeof resendVerification;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook to access auth state and actions. Must be inside AuthProvider. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
