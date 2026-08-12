import {
  ensureCsrfWhileLocked,
  withCsrfLock,
} from "../api/csrf.js";
import { ApiError, localProblem } from "../api/problem.js";
import { accessTokenStore } from "./accessTokenStore.js";

export type MutationKind = "refresh" | "login" | "logout" | "switch" | "reset";
export type JournalStatus = "started" | "ambiguous";

export interface SessionJournal {
  epoch: string;
  kind: MutationKind;
  status: JournalStatus;
  startedAt: string;
}

interface MutationIntent {
  kind: MutationKind;
  generation: number;
  userId?: string;
  workspaceId?: string;
}

export type MutationResult =
  | ({ outcome: "started" | "success" | "selection-required" | "ambiguous" } & MutationIntent & { epoch: string })
  | ({ outcome: "failure" } & MutationIntent & { epoch: string; code?: string });

type SharedRefreshResult = MutationResult & {
  sharedAt?: number;
  accessToken?: string;
  value?: unknown;
};

export interface SessionMutationOptions extends Partial<Omit<MutationIntent, "kind">> {
  credentialRecovery?: boolean;
  automatic?: boolean;
}

const JOURNAL_KEY = "adept.sessionMutationJournal";
const SESSION_LOCK = "adept-session-mutation";
const CHANNEL_NAME = "adept-session";
const SHARED_RESULT_TTL_MS = 10_000;

let channel: BroadcastChannel | null = null;
const localFlights = new Map<string, Promise<unknown>>();
const recentRefreshes: SharedRefreshResult[] = [];
const observedStarts = new Map<string, MutationIntent & { seenAt: number }>();
const observedResults = new Map<string, SharedRefreshResult>();
const resultWaiters = new Map<string, Set<(value: SharedRefreshResult) => void>>();
let internalListenerInstalled = false;

function clearSharedRefreshState(): void {
  recentRefreshes.length = 0;
  observedStarts.clear();
  observedResults.clear();
  resultWaiters.clear();
}

function forgetSharedRefresh(epochValue: string): void {
  observedResults.delete(epochValue);
  const index = recentRefreshes.findIndex((value) => value.epoch === epochValue);
  if (index >= 0) recentRefreshes.splice(index, 1);
}

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  if (!internalListenerInstalled) {
    channel.addEventListener("message", (event: MessageEvent<SharedRefreshResult>) => {
      const value = event.data;
      if (value.kind !== "refresh") {
        if (
          value.outcome !== "started" &&
          ["login", "logout", "reset"].includes(value.kind)
        ) {
          clearSharedRefreshState();
        }
        return;
      }
      if (value.outcome === "started") {
        observedStarts.set(value.epoch, { ...value, seenAt: Date.now() });
        setTimeout(() => observedStarts.delete(value.epoch), SHARED_RESULT_TTL_MS);
        return;
      }
      const enriched = { ...value, sharedAt: value.sharedAt ?? Date.now() };
      observedResults.set(value.epoch, enriched);
      for (const resolve of resultWaiters.get(value.epoch) ?? []) resolve(enriched);
      resultWaiters.delete(value.epoch);
      recentRefreshes.push(enriched);
      const cutoff = Date.now() - SHARED_RESULT_TTL_MS;
      while (recentRefreshes.length > 0 && (recentRefreshes[0]?.sharedAt ?? 0) < cutoff) {
        recentRefreshes.shift();
      }
      observedStarts.delete(value.epoch);
      setTimeout(() => forgetSharedRefresh(value.epoch), SHARED_RESULT_TTL_MS);
    });
    internalListenerInstalled = true;
  }
  return channel;
}

function clearJournal(): void {
  try {
    localStorage.removeItem(JOURNAL_KEY);
  } catch {
    // Storage can be unavailable in restrictive browser modes.
  }
}

function writeJournal(value: SessionJournal): void {
  try {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(value));
  } catch {
    // The API remains the security boundary when storage is unavailable.
  }
}

export function readJournal(): SessionJournal | null {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      typeof value !== "object" ||
      value === null ||
      typeof (value as SessionJournal).epoch !== "string" ||
      !["refresh", "login", "logout", "switch", "reset"].includes((value as SessionJournal).kind) ||
      !["started", "ambiguous"].includes((value as SessionJournal).status) ||
      typeof (value as SessionJournal).startedAt !== "string"
    ) {
      return { epoch: "invalid", kind: "refresh", status: "ambiguous", startedAt: "" };
    }
    return value as SessionJournal;
  } catch {
    return { epoch: "invalid", kind: "refresh", status: "ambiguous", startedAt: "" };
  }
}

/** A leftover started mutation has an unknown cookie outcome after reload. */
export function isAmbiguousJournal(): boolean {
  return readJournal() !== null;
}

function hasExplicitAmbiguity(): boolean {
  return readJournal()?.status === "ambiguous";
}

function sessionAmbiguousError(): ApiError {
  return new ApiError(
    localProblem(401, "SESSION_AMBIGUOUS", "Session recovery required", "Please sign in again or log out."),
  );
}

function epoch(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function publish(value: SharedRefreshResult): void {
  try {
    getChannel()?.postMessage(value);
  } catch {
    // Cross-tab support is checked before automatic restoration.
  }
}

function supportsCrossTab(): boolean {
  return typeof navigator.locks !== "undefined" && typeof BroadcastChannel !== "undefined";
}

function flightKey(kind: MutationKind, options: SessionMutationOptions): string {
  if (kind === "refresh") return `${kind}:${options.workspaceId ?? "selection"}:${options.generation ?? 0}`;
  return `${kind}:${epoch()}`;
}

function waitForEpochResult(epochValue: string, timeoutMs = 10_000): Promise<SharedRefreshResult | null> {
  const existing = observedResults.get(epochValue);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const waiters = resultWaiters.get(epochValue) ?? new Set<(value: SharedRefreshResult) => void>();
    const finish = (value: SharedRefreshResult) => {
      clearTimeout(timer);
      resolve(value);
    };
    waiters.add(finish);
    resultWaiters.set(epochValue, waiters);
    const timer = setTimeout(() => {
      waiters.delete(finish);
      if (waiters.size === 0) resultWaiters.delete(epochValue);
      resolve(null);
    }, timeoutMs);
  });
}

async function yieldForCompetingRefresh(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 75));
}

async function waitForMatchingRefresh<T>(
  calledAt: number,
  options: SessionMutationOptions,
): Promise<T | null> {
  const matchingStart = [...observedStarts.values()].some((value) =>
    value.generation === (options.generation ?? 0) &&
    value.workspaceId === options.workspaceId &&
    value.seenAt >= calledAt - 1_000,
  );
  if (!matchingStart) return null;

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const shared = recentRefreshes.findLast((value) =>
      value.outcome !== "failure" &&
      value.outcome !== "ambiguous" &&
      value.generation === (options.generation ?? 0) &&
      value.workspaceId === options.workspaceId &&
          (value.sharedAt ?? 0) >= calledAt - 5_000 &&
      value.value !== undefined,
    );
    if (shared) {
      if (shared.accessToken) accessTokenStore.set(shared.accessToken);
      else accessTokenStore.clear();
      return shared.value as T;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return null;
}

export async function runSessionMutation<T>(
  kind: MutationKind,
  executor: (attemptEpoch: string) => Promise<T>,
  options: SessionMutationOptions = {},
): Promise<T> {
  const calledAt = Date.now();
  getChannel();
  if (options.automatic && !supportsCrossTab()) {
    throw new ApiError(
      localProblem(
        401,
        "MULTI_TAB_COORDINATION_UNAVAILABLE",
        "Sign-in required",
        "This browser cannot safely restore the session automatically. Please sign in.",
      ),
    );
  }
  if (hasExplicitAmbiguity() && !options.credentialRecovery) {
    throw sessionAmbiguousError();
  }

  const recoveringAmbiguity = isAmbiguousJournal() && options.credentialRecovery === true;

  const key = flightKey(kind, options);
  const existing = localFlights.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const task = withCsrfLock(async () => {
    await ensureCsrfWhileLocked();

    if (kind === "refresh") {
      await yieldForCompetingRefresh();
      const shared = await waitForMatchingRefresh<T>(calledAt, options);
      if (shared !== null) return shared;
    }

    const executeUnderSessionLock = async (): Promise<T> => {
      if (kind === "refresh") {
        const shared = recentRefreshes.findLast((value) =>
          value.outcome !== "failure" &&
          value.outcome !== "ambiguous" &&
          value.generation === (options.generation ?? 0) &&
          value.workspaceId === options.workspaceId &&
          (value.sharedAt ?? 0) >= calledAt - 5_000 &&
          value.value !== undefined,
        );
        if (shared) {
          if (shared.accessToken) accessTokenStore.set(shared.accessToken);
          else accessTokenStore.clear();
          return shared.value as T;
        }

        const journal = readJournal();
        if (journal?.status === "started" && journal.kind === "refresh") {
          const observed = observedStarts.get(journal.epoch);
          if (
            observed &&
            observed.generation === (options.generation ?? 0) &&
            observed.workspaceId === options.workspaceId
          ) {
            const leaderResult = await waitForEpochResult(journal.epoch);
            if (
              leaderResult &&
              leaderResult.outcome !== "failure" &&
              leaderResult.outcome !== "ambiguous" &&
              leaderResult.value !== undefined
            ) {
              if (leaderResult.accessToken) accessTokenStore.set(leaderResult.accessToken);
              else accessTokenStore.clear();
              return leaderResult.value as T;
            }
          }
        }
      }

      const unfinished = readJournal();
      if (unfinished?.status === "started" && !options.credentialRecovery) {
        writeJournal({ ...unfinished, status: "ambiguous" });
        publish({
          outcome: "ambiguous",
          epoch: unfinished.epoch,
          kind: unfinished.kind,
          generation: options.generation ?? 0,
          ...(options.userId ? { userId: options.userId } : {}),
          ...(options.workspaceId ? { workspaceId: options.workspaceId } : {}),
        });
        throw sessionAmbiguousError();
      }

      if (hasExplicitAmbiguity() && !options.credentialRecovery) {
        throw sessionAmbiguousError();
      }

      // Replace a blocked journal only after both locks are held. A failed
      // credential recovery writes it back as ambiguous below.
      if (options.credentialRecovery) clearJournal();

      const attemptEpoch = epoch();
      const intent: MutationIntent = {
        kind,
        generation: options.generation ?? 0,
        ...(options.userId ? { userId: options.userId } : {}),
        ...(options.workspaceId ? { workspaceId: options.workspaceId } : {}),
      };
      const startedAt = new Date().toISOString();
      writeJournal({ epoch: attemptEpoch, kind, status: "started", startedAt });
      publish({ outcome: "started", epoch: attemptEpoch, ...intent });

      try {
        const value = await executor(attemptEpoch);
        clearJournal();
        const selection =
          typeof value === "object" && value !== null && "kind" in value && value.kind === "workspace-required";
        publish({
          outcome: selection ? "selection-required" : "success",
          epoch: attemptEpoch,
          ...(kind === "refresh"
            ? {
                sharedAt: Date.now(),
                accessToken: accessTokenStore.get() ?? undefined,
                value,
              }
            : {}),
          ...intent,
        });
        return value;
      } catch (error) {
        if (error instanceof ApiError || (typeof error === "object" && error !== null && "problem" in error)) {
          const code = error instanceof ApiError
            ? error.problem.code
            : typeof (error as { problem?: { code?: unknown } }).problem?.code === "string"
              ? (error as { problem: { code: string } }).problem.code
              : undefined;
          if (recoveringAmbiguity) {
            writeJournal({ epoch: attemptEpoch, kind, status: "ambiguous", startedAt });
          } else {
            clearJournal();
          }
          publish({
            outcome: "failure",
            epoch: attemptEpoch,
            code,
            ...intent,
          });
        } else {
          writeJournal({ epoch: attemptEpoch, kind, status: "ambiguous", startedAt });
          publish({ outcome: "ambiguous", epoch: attemptEpoch, ...intent });
        }
        throw error;
      }
    };

    if (typeof navigator.locks === "undefined") return executeUnderSessionLock();
    return navigator.locks.request(SESSION_LOCK, executeUnderSessionLock);
  });

  localFlights.set(key, task);
  try {
    return await task;
  } finally {
    if (localFlights.get(key) === task) localFlights.delete(key);
  }
}

export function onSessionResult(handler: (result: MutationResult) => void): () => void {
  const activeChannel = getChannel();
  if (!activeChannel) return () => undefined;
  const listener = (event: MessageEvent<MutationResult>) => handler(event.data);
  activeChannel.addEventListener("message", listener);
  return () => activeChannel.removeEventListener("message", listener);
}

export function clearSessionMutationJournal(): void {
  clearJournal();
}
