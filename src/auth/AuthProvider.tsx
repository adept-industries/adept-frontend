import {
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { configureAuthRecovery, type SessionSnapshot } from "../api/client.js";
import { ensureCsrf } from "../api/csrf.js";
import { ApiError } from "../api/problem.js";
import { queryClient } from "../api/queryClient.js";
import {
  completeGoogleOnboarding as requestGoogleOnboarding,
  getMe,
  login as requestLogin,
  logout as requestLogout,
  refreshSession,
  resetPassword as requestPasswordReset,
  signup as requestSignup,
  switchWorkspace,
  type GoogleOnboardingBody,
  type LoginBody,
  type ResetPasswordBody,
  type SessionResult,
} from "../features/auth/api.js";
import { workspacePreference } from "../lib/workspacePreference.js";
import { accessTokenStore } from "./accessTokenStore.js";
import { AuthContext, type AuthContextValue } from "./AuthContext.js";
import {
  onSessionResult,
  runSessionMutation,
} from "./sessionMutationCoordinator.js";
import type { AuthState } from "./types.js";

interface AuthProviderProps {
  children: ReactNode;
}

let bootstrapFlight: Promise<SessionResult> | null = null;

function isGoogleLoginReturn(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.pathname === "/login"
    && new URLSearchParams(window.location.search).get("google") === "success";
}

function clearVolatileSession(clearPreference = true): void {
  accessTokenStore.clear();
  queryClient.clear();
  if (clearPreference) workspacePreference.clear();
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({ status: "bootstrapping" });
  const stateRef = useRef<AuthState>(state);
  const generationRef = useRef(0);
  const mounted = useRef(true);
  const bootstrapAttached = useRef(false);

  const publishState = useCallback((next: AuthState): AuthState => {
    stateRef.current = next;
    if (mounted.current) setState(next);
    return next;
  }, []);

  const invalidateSession = useCallback((options?: {
    ambiguous?: boolean;
    deletionRequested?: boolean;
    notice?: string;
  }) => {
    generationRef.current += 1;
    clearVolatileSession();
    publishState({
      status: "anonymous",
      ...(options?.ambiguous ? { ambiguousSession: true as const } : {}),
      ...(options?.deletionRequested ? { deletionRequested: true as const } : {}),
      ...(options?.notice ? { notice: options.notice } : {}),
    });
  }, [publishState]);

  const installSession = useCallback((result: SessionResult, forceGenerationChange: boolean): AuthState => {
    if (result.kind === "workspace-required") {
      if (forceGenerationChange || stateRef.current.status === "authenticated") {
        generationRef.current += 1;
      }
      accessTokenStore.clear();
      const next: AuthState = {
        status: "workspaceRequired",
        user: result.user,
        workspaces: result.workspaces,
      };
      return publishState(next);
    }

    const previousWorkspace =
      stateRef.current.status === "authenticated"
        ? stateRef.current.currentMembership.workspaceId
        : null;
    if (forceGenerationChange || previousWorkspace !== result.currentMembership.workspaceId) {
      generationRef.current += 1;
    }
    workspacePreference.set(result.currentMembership.workspaceId);
    const next: AuthState = {
      status: "authenticated",
      ...result,
      generation: generationRef.current,
    };
    return publishState(next);
  }, [publishState]);

  const refresh = useCallback(async (options?: { withoutWorkspace?: boolean }): Promise<AuthState> => {
    const current = stateRef.current;
    const requestedWorkspace = options?.withoutWorkspace
      ? undefined
      : current.status === "authenticated"
        ? current.currentMembership.workspaceId
        : workspacePreference.get() ?? undefined;
    const startedGeneration = generationRef.current;
    let result: SessionResult;
    try {
      result = await runSessionMutation(
        "refresh",
        () => refreshSession(requestedWorkspace, true),
        {
          automatic: true,
          generation: startedGeneration,
          workspaceId: requestedWorkspace,
          userId: current.status === "authenticated" || current.status === "workspaceRequired"
            ? current.user.id
            : undefined,
        },
      );
    } catch (error) {
      if (error instanceof ApiError && error.problem.code === "NO_ACTIVE_MEMBERSHIP") {
        invalidateSession({
          deletionRequested: current.status === "anonymous" && current.deletionRequested === true,
          notice: error.problem.detail,
        });
      } else if (error instanceof ApiError && error.problem.code === "SESSION_AMBIGUOUS") {
        invalidateSession({ ambiguous: true });
      } else if (error instanceof ApiError && error.problem.code !== "SESSION_AMBIGUOUS") {
        invalidateSession();
      } else if (!(error instanceof ApiError)) {
        invalidateSession({ ambiguous: true });
      }
      throw error;
    }
    if (generationRef.current !== startedGeneration) return stateRef.current;
    return installSession(result, false);
  }, [installSession, invalidateSession]);

  useEffect(() => {
    mounted.current = true;
    if (bootstrapAttached.current) {
      return () => { mounted.current = false; };
    }
    bootstrapAttached.current = true;

    if (!bootstrapFlight) {
      const preference = workspacePreference.get() ?? undefined;
      const googleLoginReturn = isGoogleLoginReturn();
      bootstrapFlight = ensureCsrf()
        .then(() => runSessionMutation(
          googleLoginReturn ? "login" : "refresh",
          () => refreshSession(preference, true),
          {
            automatic: !googleLoginReturn,
            credentialRecovery: googleLoginReturn,
            generation: generationRef.current,
            workspaceId: preference,
          },
        ))
        .finally(() => {
          bootstrapFlight = null;
        });
    }

    void bootstrapFlight
      .then(async (result) => {
        installSession(result, false);
        if (result.kind === "authenticated") {
          // Bootstrap has just rotated the cookie and issued a fresh JWT. A
          // 401 here is terminal for this bootstrap; recursively refreshing
          // would rotate the shared cookie a second time.
          const me = await getMe(undefined, false);
          if (stateRef.current.status === "authenticated") {
            publishState({
              status: "authenticated",
              ...me,
              generation: stateRef.current.generation,
            });
          }
        }
      })
      .catch((error: unknown) => {
        clearVolatileSession();
        if (!(error instanceof ApiError) || error.problem.code === "SESSION_AMBIGUOUS") {
          publishState({ status: "anonymous", ambiguousSession: true });
        } else if (error.problem.code === "NO_ACTIVE_MEMBERSHIP") {
          publishState({ status: "anonymous", notice: error.problem.detail });
        } else {
          publishState({ status: "anonymous" });
        }
      });

    return () => { mounted.current = false; };
  }, [installSession, publishState]);

  useEffect(() => onSessionResult((result) => {
    if (result.outcome === "started") return;
    if (result.outcome === "ambiguous") {
      invalidateSession({ ambiguous: true });
      return;
    }
    if (
      result.outcome === "success" &&
      (result.kind === "logout" || result.kind === "reset" || result.kind === "login")
    ) {
      generationRef.current += 1;
      clearVolatileSession();
      publishState({ status: "anonymous" });
    }
  }), [invalidateSession, publishState]);

  useEffect(() => {
    configureAuthRecovery({
      snapshot(): SessionSnapshot | null {
        const current = stateRef.current;
        if (current.status !== "authenticated") return null;
        return {
          generation: current.generation,
          workspaceId: current.currentMembership.workspaceId,
        };
      },
      async recover(origin) {
        const current = stateRef.current;
        if (
          current.status !== "authenticated" ||
          current.generation !== origin.generation ||
          current.currentMembership.workspaceId !== origin.workspaceId
        ) return;
        await refresh();
      },
    });
    return () => configureAuthRecovery(null);
  }, [refresh]);

  const login = useCallback(async (params: LoginBody): Promise<AuthState> => {
    clearVolatileSession();
    let result: SessionResult;
    try {
      result = await runSessionMutation(
        "login",
        () => requestLogin(params, true),
        { credentialRecovery: true, generation: generationRef.current },
      );
    } catch (error) {
      if (!(error instanceof ApiError)) invalidateSession({ ambiguous: true });
      throw error;
    }
    const next = installSession(result, true);
    await ensureCsrf();
    return next;
  }, [installSession, invalidateSession]);

  const completeGoogleOnboarding = useCallback(async (
    params: GoogleOnboardingBody,
  ): Promise<AuthState> => {
    clearVolatileSession();
    let result: SessionResult;
    try {
      result = await runSessionMutation(
        "login",
        () => requestGoogleOnboarding(params, true),
        { credentialRecovery: true, generation: generationRef.current },
      );
    } catch (error) {
      if (!(error instanceof ApiError)) invalidateSession({ ambiguous: true });
      throw error;
    }
    const next = installSession(result, true);
    await ensureCsrf();
    return next;
  }, [installSession, invalidateSession]);

  const selectWorkspace = useCallback(async (workspaceId: string): Promise<AuthState> => {
    const current = stateRef.current;
    const startedGeneration = ++generationRef.current;
    await queryClient.cancelQueries();
    accessTokenStore.clear();
    queryClient.clear();
    if (current.status === "authenticated") publishState({ status: "bootstrapping" });
    try {
      const result = await runSessionMutation(
        "switch",
        () => switchWorkspace(workspaceId, true),
        {
          generation: startedGeneration,
          workspaceId,
          userId: current.status === "authenticated" || current.status === "workspaceRequired"
            ? current.user.id
            : undefined,
        },
      );
      return installSession(result, false);
    } catch (error) {
      if (error instanceof ApiError && !["SESSION_INVALID", "REFRESH_REUSE_DETECTED"].includes(error.problem.code)) {
        if (current.status === "authenticated" || current.status === "workspaceRequired") {
          publishState({
            status: "workspaceRequired",
            user: current.user,
            workspaces: current.workspaces,
            notice: error.problem.detail,
          });
        } else {
          invalidateSession();
        }
      } else if (error instanceof ApiError) {
        invalidateSession();
      } else {
        invalidateSession({ ambiguous: true });
      }
      throw error;
    }
  }, [installSession, invalidateSession, publishState]);

  const logout = useCallback(async (): Promise<void> => {
    let ambiguous = false;
    try {
      await runSessionMutation(
        "logout",
        () => requestLogout(true),
        { credentialRecovery: true, generation: generationRef.current },
      );
    } catch (error) {
      ambiguous = !(error instanceof ApiError);
      throw error;
    } finally {
      invalidateSession({ ambiguous });
      await ensureCsrf().catch(() => undefined);
    }
  }, [invalidateSession]);

  const resetPassword = useCallback(async (params: ResetPasswordBody) => {
    try {
      await runSessionMutation(
        "reset",
        () => requestPasswordReset(params, true),
        { credentialRecovery: true, generation: generationRef.current },
      );
    } catch (error) {
      if (!(error instanceof ApiError)) invalidateSession({ ambiguous: true });
      throw error;
    }
    invalidateSession();
    await ensureCsrf();
  }, [invalidateSession]);

  const updateCurrentWorkspace = useCallback((params: { name: string; timezone: string }) => {
    const current = stateRef.current;
    if (current.status !== "authenticated") return;
    publishState({
      ...current,
      currentMembership: {
        ...current.currentMembership,
        workspaceName: params.name,
        timezone: params.timezone,
      },
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.currentMembership.workspaceId
          ? { ...workspace, name: params.name, timezone: params.timezone }
          : workspace,
      ),
    });
  }, [publishState]);

  const value = useMemo<AuthContextValue>(() => ({
    state,
    actions: {
      signup: requestSignup,
      login,
      completeGoogleOnboarding,
      selectWorkspace,
      refresh,
      logout,
      resetPassword,
      updateCurrentWorkspace,
      invalidateSession,
    },
  }), [
    state,
    login,
    completeGoogleOnboarding,
    selectWorkspace,
    refresh,
    logout,
    resetPassword,
    updateCurrentWorkspace,
    invalidateSession,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
