// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  isAmbiguousJournal,
  readJournal,
  runSessionMutation,
} from "./sessionMutationCoordinator";

// jsdom does not implement Web Locks, so the coordinator falls back to
// single-tab in-page execution — which is exactly what we want to test.

// Provide a simple in-memory localStorage mock for environments that don't
// have it (Node 26 without --localstorage-file).
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};

if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    writable: true,
  });
}

describe("sessionMutationCoordinator", () => {
  beforeEach(() => {
    // Clear localStorage regardless of environment availability.
    if (typeof globalThis.localStorage !== "undefined") {
      globalThis.localStorage.clear();
    }
  });

  it("writes and clears journal around a successful mutation", async () => {
    let capturedEpoch = "";
    await runSessionMutation("login", async (epoch) => {
      capturedEpoch = epoch;
      // At this point the journal should be "started".
      const j = readJournal();
      expect(j?.status).toBe("started");
      expect(j?.kind).toBe("login");
      return "ok";
    }, { isCredentialAction: true });

    expect(capturedEpoch).toBeTruthy();
    // Journal cleared after success.
    expect(readJournal()).toBeNull();
  });

  it("marks journal ambiguous on network failure", async () => {
    // Simulate a non-API network error (no .problem shape).
    const networkError = new Error("Network down");

    await expect(
      runSessionMutation("refresh", async () => {
        throw networkError;
      }),
    ).rejects.toThrow("Network down");

    expect(readJournal()?.status).toBe("ambiguous");
    expect(isAmbiguousJournal()).toBe(true);
  });

  it("clears journal on known API error (not ambiguous)", async () => {
    // A structured ApiError has a .problem property — not a network ambiguity.
    const apiErr = { message: "bad token", problem: { code: "SESSION_INVALID", status: 401 } };

    await expect(
      runSessionMutation("refresh", async () => {
        throw apiErr;
      }),
    ).rejects.toMatchObject({ message: "bad token" });

    // Journal cleared — not ambiguous.
    expect(readJournal()).toBeNull();
    expect(isAmbiguousJournal()).toBe(false);
  });

  it("credential action clears any pre-existing ambiguous journal", async () => {
    globalThis.localStorage?.setItem(
      "adept.sessionMutationJournal",
      JSON.stringify({ epoch: "x", kind: "refresh", status: "ambiguous", startedAt: "" }),
    );
    expect(isAmbiguousJournal()).toBe(true);

    await runSessionMutation(
      "login",
      async () => "ok",
      { isCredentialAction: true },
    );

    expect(isAmbiguousJournal()).toBe(false);
  });
});


