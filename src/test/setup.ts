import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { server } from "./server.js";

// Node.js 22+ ships an experimental localStorage tied to --localstorage-file.
// When that flag is absent the global may be undefined or non-functional, even
// though vitest uses jsdom. We always install a reliable in-memory mock so that
// every test worker gets a working, isolated localStorage.
const store: Record<string, string> = {};
const mockLocalStorage: Storage = {
  getItem: (key) => Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null,
  setItem: (key, value) => { store[key] = String(value); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => { delete store[k]; }); },
  key: (index) => Object.keys(store)[index] ?? null,
  get length() { return Object.keys(store).length; },
};
Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

// Clear localStorage state before each test for isolation.
beforeEach(() => {
  mockLocalStorage.clear();
});

// Start MSW before all tests, reset handlers after each test,
// and clean up after all tests.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
