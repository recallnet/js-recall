/**
 * RPC Client Helpers for E2E Tests
 *
 * Utilities for creating server-side RPC clients for testing.
 */
import { type RouterClient, createRouterClient } from "@orpc/server";
import { type ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

import { MockPrivyClient } from "@recallnet/services/lib";

import { createLogger } from "../../lib/logger.js";
import {
  agentService,
  boostAwardService,
  boostService,
  competitionService,
  emailService,
  leaderboardService,
  userService,
} from "../../lib/services.js";
import { router } from "../../rpc/router/index.js";

/**
 * Create a mock cookies object for testing
 */
function createMockCookies(privyToken?: string): ReadonlyRequestCookies {
  const cookieStore = new Map<string, string>();

  if (privyToken) {
    cookieStore.set("privy-id-token", privyToken);
  }

  return {
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value
        ? {
            name,
            value,
          }
        : undefined;
    },
    getAll: (name?: string) => {
      if (name) {
        const value = cookieStore.get(name);
        return value ? [{ name, value }] : [];
      }
      return Array.from(cookieStore.entries()).map(([name, value]) => ({
        name,
        value,
      }));
    },
    has: (name: string) => cookieStore.has(name),
    [Symbol.iterator]: function* () {
      for (const [name, value] of cookieStore.entries()) {
        yield { name, value };
      }
    },
    size: cookieStore.size,
  } as ReadonlyRequestCookies;
}

/**
 * Create a server-side RPC client with test context
 */
export async function createTestRpcClient(
  privyToken?: string,
): Promise<RouterClient<typeof router>> {
  // Use MockPrivyClient for tests instead of real PrivyClient
  const mockPrivyClient = new MockPrivyClient(
    process.env.PRIVY_APP_ID || "test-app-id",
    process.env.PRIVY_APP_SECRET || "test-app-secret",
  );

  return createRouterClient(router, {
    context: {
      cookies: createMockCookies(privyToken),
      privyClient: mockPrivyClient as any, // MockPrivyClient implements subset of PrivyClient interface
      boostService,
      boostAwardService,
      userService,
      competitionService,
      agentService,
      emailService,
      leaderboardService,
      logger: createLogger("TestRpcClient"),
    },
  });
}
