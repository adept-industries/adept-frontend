import { setupServer } from "msw/node";
import { handlers } from "./handlers.js";

/**
 * MSW Node server for Vitest.
 * Started/stopped/reset in src/test/setup.ts.
 */
export const server = setupServer(...handlers);
