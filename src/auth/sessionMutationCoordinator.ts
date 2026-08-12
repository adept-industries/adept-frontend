/**
 * Session mutation coordinator — ensures only one login/refresh/logout/switch
 * is in-flight at a time across all tabs, using:
 *   - Web Lock: `adept-session-mutation`  (single active mutation per origin)
 *   - BroadcastChannel: `adept-session`   (share results across tabs)
 *   - localStorage key: `adept.sessionMutationJournal`  (crash recovery)
 *
 * Lock ordering (must never be reversed):
 *   adept-csrf-bootstrap  →  adept-session-mutation
 *
 * The journal is cleared after every terminal (success/failure) result.
 * Only an explicit credential login, logout, or password reset may clear an
 * `ambiguous` journal — automatic refresh must fail closed without sending
 * another request.
 */

export type MutationKind =
  | "refresh"
  | "login"
  | "logout"
  | "switch"
  | "reset";

export type JournalStatus = "started" | "ambiguous";

export interface SessionJournal {
  epoch: string;
  kind: MutationKind;
  status: JournalStatus;
  startedAt: string;
}

export type MutationResult =
  | { outcome: "success"; kind: MutationKind; epoch: string }
  | { outcome: "selection-required"; kind: MutationKind; epoch: string }
  | { outcome: "failure"; kind: MutationKind; epoch: string; code?: string }
  | { outcome: "ambiguous"; kind: MutationKind; epoch: string };

const JOURNAL_KEY = "adept.sessionMutationJournal";
const SESSION_LOCK = "adept-session-mutation";
const CHANNEL_NAME = "adept-session";

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
}

function writeJournal(journal: SessionJournal): void {
  try {
    globalThis.localStorage?.setItem(JOURNAL_KEY, JSON.stringify(journal));
  } catch {
    // Ignore quota errors.
  }
}

function clearJournal(): void {
  try {
    globalThis.localStorage?.removeItem(JOURNAL_KEY);
  } catch {
    // Ignore.
  }
}

export function readJournal(): SessionJournal | null {
  try {
    const raw = globalThis.localStorage?.getItem(JOURNAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).epoch !== "string" ||
      typeof (parsed as Record<string, unknown>).kind !== "string" ||
      typeof (parsed as Record<string, unknown>).status !== "string"
    ) {
      clearJournal();
      return null;
    }
    return parsed as SessionJournal;
  } catch {
    clearJournal();
    return null;
  }
}

function generateEpoch(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Returns true when the journal should block automatic refresh.
 * An explicit credential login, logout, or password reset can override this.
 */
export function isAmbiguousJournal(): boolean {
  const j = readJournal();
  if (!j) return false;
  if (j.status === "ambiguous") return true;
  // Orphaned `started` with no held lock — treat as ambiguous.
  if (j.status === "started") return true;
  return false;
}

/**
 * Broadcast a result to other tabs.
 */
function broadcast(result: MutationResult): void {
  try {
    getChannel()?.postMessage(result);
  } catch {
    // Ignore.
  }
}

/**
 * Run a session mutation under the `adept-session-mutation` Web Lock.
 *
 * Falls back to a simple in-page execution when Web Locks are unavailable
 * (single-tab mode).
 */
export async function runSessionMutation<T>(
  kind: MutationKind,
  executor: (epoch: string) => Promise<T>,
  options?: { isCredentialAction?: boolean },
): Promise<T> {
  const epoch = generateEpoch();

  const run = async (): Promise<T> => {
    writeJournal({ epoch, kind, status: "started", startedAt: new Date().toISOString() });
    broadcast({ outcome: "success", kind, epoch }); // started signal reuses success shape for simplicity

    let result: T;
    try {
      result = await executor(epoch);
    } catch (err) {
      // Determine if the outcome is truly ambiguous (network error, not an API error).
      const isApiError =
        typeof err === "object" &&
        err !== null &&
        "problem" in err;

      if (!isApiError) {
        // Network/timeout — outcome unknown, fail closed.
        writeJournal({ epoch, kind, status: "ambiguous", startedAt: new Date().toISOString() });
        broadcast({ outcome: "ambiguous", kind, epoch });
      } else {
        clearJournal();
        broadcast({ outcome: "failure", kind, epoch });
      }
      throw err;
    }

    clearJournal();
    if (kind === "login" || kind === "logout" || kind === "reset") {
      broadcast({ outcome: "success", kind, epoch });
    } else {
      broadcast({ outcome: "success", kind, epoch });
    }
    return result;
  };

  // If this is a credential action (login/logout/reset), clear any ambiguous journal first.
  if (options?.isCredentialAction) {
    clearJournal();
  }

  if (typeof navigator.locks === "undefined") {
    return run();
  }

  return navigator.locks.request(SESSION_LOCK, run);
}

/**
 * Listen for session results from other tabs.
 * Returns an unsubscribe function.
 */
export function onSessionResult(
  handler: (result: MutationResult) => void,
): () => void {
  const ch = getChannel();
  if (!ch) return () => undefined;

  const listener = (event: MessageEvent<MutationResult>) => {
    handler(event.data);
  };
  ch.addEventListener("message", listener);
  return () => ch.removeEventListener("message", listener);
}
