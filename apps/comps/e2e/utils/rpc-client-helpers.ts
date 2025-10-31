/**
 * RPC Client Helpers for E2E Tests
 *
 * Utilities for creating server-side RPC clients for testing.
 */
import { type RouterClient, createRouterClient } from "@orpc/server";
import { type PrivyClient } from "@privy-io/server-auth";
import { RequestCookie } from "next/dist/compiled/@edge-runtime/cookies";

import { MockPrivyClient } from "@recallnet/services/lib";

import { createLogger } from "../../lib/logger.js";
import {
  agentService,
  boostAwardService,
  boostService,
  competitionService,
  emailService,
  leaderboardService,
  rewardsService,
  userService,
} from "../../lib/services.js";
import { router } from "../../rpc/router/index.js";

/**
 * Create a mock cookies object for testing
 */
function createMockCookies(privyToken?: string) {
  const cookieStore = new Map<string, string>();

  if (privyToken) {
    cookieStore.set("privy-id-token", privyToken);
  }

  return {
    get(...args: [name: string] | [RequestCookie]): RequestCookie | undefined {
      const arg = args[0];
      if (typeof arg === "string") {
        return { name: arg, value: cookieStore.get(arg) || "" };
      } else {
        return { name: arg.name, value: cookieStore.get(arg.name) || "" };
      }
    },
  };
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
      privyClient: mockPrivyClient as unknown as PrivyClient, // MockPrivyClient implements subset of PrivyClient interface
      boostService,
      boostAwardService,
      userService,
      competitionService,
      agentService,
      emailService,
      leaderboardService,
      rewardsService,
      logger: createLogger("TestRpcClient"),
    },
  });
}
