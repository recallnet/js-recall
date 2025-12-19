/**
 * RPC Client Helpers for E2E Tests
 *
 * Utilities for creating server-side RPC clients for testing.
 */
import { type RouterClient, createRouterClient } from "@orpc/server";
import { type PrivyClient } from "@privy-io/server-auth";
import { RequestCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { expect } from "vitest";
import { z } from "zod/v4";

import { MockPrivyClient } from "@recallnet/services/lib";
import {
  AdminCreateCompetitionSchema,
  AdminRegisterUserSchema,
  AdminStartCompetitionSchema,
  PaperTradingInitialBalanceSchema,
} from "@recallnet/services/types";
import {
  DEFAULT_PAPER_TRADING_INITIAL_BALANCES,
  generateRandomEthAddress,
  generateRandomPrivyId,
  generateRandomString,
  generateTestHandle,
} from "@recallnet/test-utils";

import { competitionRepository } from "@/lib/repositories";

import { createLogger } from "../../lib/logger.js";
import {
  adminService,
  agentService,
  airdropService,
  arenaService,
  balanceService,
  boostAwardService,
  boostBonusService,
  boostService,
  competitionService,
  eigenaiService,
  emailService,
  leaderboardService,
  partnerService,
  portfolioSnapshotterService,
  rewardsService,
  sportsService,
  userService,
} from "../../lib/services.js";
import { router as adminRouter } from "../../rpc/router/admin/index.js";
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
      airdropService,
      boostService,
      boostAwardService,
      userService,
      competitionService,
      agentService,
      arenaService,
      eigenaiService,
      emailService,
      leaderboardService,
      rewardsService,
      sportsService,
      logger: createLogger("TestRpcClient"),
    },
  });
}

/**
 * Create a test admin RPC client with optional custom headers
 *
 * @param options - Optional configuration
 * @param options.apiKey - API key to include in Authorization header
 * @param options.headers - Custom headers to include
 */
export async function createTestAdminRpcClient(options?: {
  apiKey?: string;
}): Promise<RouterClient<typeof adminRouter>> {
  const headers = new Headers();

  // Add Authorization header if apiKey is provided
  if (options?.apiKey) {
    headers.set("authorization", `Bearer ${options.apiKey}`);
  }

  return createRouterClient(adminRouter, {
    context: {
      cookies: createMockCookies("dummy-token"),
      headers: headers,
      params: {},
      adminService,
      boostBonusService,
      userService,
      competitionService,
      competitionRepository,
      agentService,
      arenaService,
      partnerService,
      balanceService,
      portfolioSnapshotterService,
      rewardsService,
      logger: createLogger("TestAdminRpcClient"),
    },
  });
}

/**
 * Assert that a promise throws an error with a specific error code
 * Useful for testing RPC error responses
 */
export async function assertRpcError<TOutput>(
  promise: Promise<TOutput>,
  errorCode: string,
  options?: {
    messageContains?: string | string[];
  },
): Promise<void> {
  const result = expect(promise).rejects;
  await result.toThrow();
  await result.toMatchObject({
    code: errorCode,
  });
  if (options?.messageContains) {
    const messageContainsArray = Array.isArray(options.messageContains)
      ? options.messageContains
      : [options.messageContains];

    for (const messageContains of messageContainsArray) {
      await result.toMatchObject({
        message: expect.stringContaining(messageContains),
      });
    }
  }
}

/**
 * Register a user and agent using admin RPC client and return user/agent info
 */
export async function registerUserAndAgentAndGetClient(
  adminRpcClient: RouterClient<typeof adminRouter>,
  params: Partial<z.infer<typeof AdminRegisterUserSchema>>,
) {
  // Register a new user with optional agent creation
  const result = await adminRpcClient.users.register({
    ...params,
    walletAddress: params.walletAddress || generateRandomEthAddress(),
    embeddedWalletAddress:
      params.embeddedWalletAddress || generateRandomEthAddress(),
    privyId: params.privyId || generateRandomPrivyId(),
    name: params.name || `User ${generateRandomString(8)}`,
    email: params.email || `user-${generateRandomString(8)}@test.com`,
    agentName: params.agentName || `Agent ${generateRandomString(8)}`,
    agentHandle: params.agentHandle || generateTestHandle(params.agentName),
    agentDescription:
      params.agentDescription ||
      `Test agent for ${params.agentName || "testing"}`,
    agentWalletAddress: params.agentWalletAddress || generateRandomEthAddress(),
  });

  if (
    !result.success ||
    !result.user ||
    !result.agent ||
    typeof result.agent.id !== "string"
  ) {
    throw new Error("Failed to register user and agent");
  }

  return {
    user: {
      id: result.user.id || "",
      walletAddress: result.user.walletAddress || "",
      walletLastVerifiedAt: result.user.walletLastVerifiedAt || "",
      embeddedWalletAddress: result.user.embeddedWalletAddress || "",
      privyId: result.user.privyId || "",
      name: result.user.name || "",
      email: result.user.email || "",
      imageUrl: result.user.imageUrl || null,
      status: result.user.status || "active",
      metadata: result.user.metadata || null,
      createdAt: result.user.createdAt || new Date().toISOString(),
      updatedAt: result.user.updatedAt || new Date().toISOString(),
      lastLoginAt: result.user.lastLoginAt || new Date().toISOString(),
    },
    agent: {
      id: result.agent.id || "",
      ownerId: result.agent.ownerId || "",
      walletAddress: result.agent.walletAddress || "",
      name: result.agent.name || "",
      handle: result.agent.handle || "",
      description: result.agent.description || "",
      imageUrl: result.agent.imageUrl || null,
      status: result.agent.status || "active",
      metadata: result.agent.metadata || null,
      createdAt: result.agent.createdAt || new Date().toISOString(),
      updatedAt: result.agent.updatedAt || new Date().toISOString(),
    },
    adminRpcClient: await createTestAdminRpcClient({
      apiKey: result.agent.apiKey,
    }),
  };
}

/**
 * Start a test competition (creates and immediately starts it)
 */
export async function startTestCompetition({
  adminRpcClient,
  name,
  agentIds,
  sandboxMode,
  externalUrl,
  imageUrl,
  tradingConstraints,
  rewardsIneligible,
  paperTradingInitialBalances,
}: {
  adminRpcClient: RouterClient<typeof adminRouter>;
  agentIds?: string[];
} & Partial<z.infer<typeof AdminStartCompetitionSchema>>) {
  const competitionName = name || `Test competition ${Date.now()}`;
  const result = await adminRpcClient.competitions.start({
    name: competitionName,
    description: `Test competition description for ${competitionName}`,
    agentIds: agentIds || [],
    sandboxMode,
    externalUrl,
    imageUrl,
    tradingConstraints,
    arenaId: "default-paper-arena",
    paperTradingInitialBalances:
      paperTradingInitialBalances || defaultPaperTradingInitialBalances(),
    rewardsIneligible,
  });

  if (!result.success) {
    throw new Error("Failed to start competition");
  }

  return result;
}

/**
 * Create a competition in PENDING state without starting it
 */
export async function createTestCompetition({
  adminRpcClient,
  name,
  description,
  sandboxMode,
  externalUrl,
  imageUrl,
  type,
  tradingType,
  startDate,
  endDate,
  boostStartDate,
  boostEndDate,
  joinStartDate,
  joinEndDate,
  maxParticipants,
  tradingConstraints,
  rewardsIneligible,
  paperTradingInitialBalances,
}: {
  adminRpcClient: RouterClient<typeof adminRouter>;
} & Partial<z.infer<typeof AdminCreateCompetitionSchema>>) {
  const competitionName = name || `Test competition ${Date.now()}`;
  const result = await adminRpcClient.competitions.create({
    name: competitionName,
    description:
      description || `Test competition description for ${competitionName}`,
    tradingType,
    sandboxMode,
    externalUrl,
    imageUrl,
    type,
    startDate: startDate instanceof Date ? startDate.toISOString() : startDate,
    endDate: endDate instanceof Date ? endDate.toISOString() : endDate,
    boostStartDate:
      boostStartDate instanceof Date
        ? boostStartDate.toISOString()
        : boostStartDate,
    boostEndDate:
      boostEndDate instanceof Date ? boostEndDate.toISOString() : boostEndDate,
    joinStartDate:
      joinStartDate instanceof Date
        ? joinStartDate.toISOString()
        : joinStartDate,
    joinEndDate:
      joinEndDate instanceof Date ? joinEndDate.toISOString() : joinEndDate,
    maxParticipants,
    tradingConstraints,
    rewardsIneligible,
    arenaId: "default-paper-arena",
    paperTradingInitialBalances:
      paperTradingInitialBalances || defaultPaperTradingInitialBalances(),
  });

  if (!result.success) {
    throw new Error("Failed to create competition");
  }

  return result;
}

/**
 * Start a perpetual futures test competition (creates and immediately starts it)
 */
export async function startPerpsTestCompetition({
  adminRpcClient,
  name,
  agentIds,
  sandboxMode,
  externalUrl,
  imageUrl,
  tradingConstraints,
  rewards,
  evaluationMetric,
  perpsProvider = {
    provider: "symphony" as const,
    initialCapital: 500,
    selfFundingThreshold: 0,
    apiUrl: "http://localhost:4567", // Point to mock server by default
  },
}: {
  adminRpcClient: RouterClient<typeof adminRouter>;
  name?: string;
  agentIds?: string[];
  sandboxMode?: boolean;
  externalUrl?: string;
  imageUrl?: string;
  tradingConstraints?: z.infer<
    typeof AdminStartCompetitionSchema
  >["tradingConstraints"];
  rewards?: Record<number, number>;
  evaluationMetric?: "calmar_ratio" | "sortino_ratio" | "simple_return";
  perpsProvider?: {
    provider: "symphony" | "hyperliquid";
    initialCapital?: number;
    selfFundingThreshold?: number;
    minFundingThreshold?: number;
    apiUrl?: string;
  };
}) {
  const competitionName = name || `Perps Test Competition ${Date.now()}`;
  const result = await adminRpcClient.competitions.start({
    name: competitionName,
    description: `Perpetual futures test competition for ${competitionName}`,
    type: "perpetual_futures", // Key difference - explicitly set type
    agentIds: agentIds || [],
    sandboxMode,
    externalUrl,
    imageUrl,
    tradingConstraints,
    rewards,
    evaluationMetric,
    perpsProvider,
    arenaId: "default-perps-arena",
  });

  if (!result.success) {
    throw new Error("Failed to start perps competition");
  }

  return result;
}

/**
 * Create a perpetual futures competition in PENDING state without starting it
 */
export async function createPerpsTestCompetition({
  adminRpcClient,
  name,
  description,
  sandboxMode,
  externalUrl,
  imageUrl,
  startDate,
  endDate,
  boostStartDate,
  boostEndDate,
  joinStartDate,
  joinEndDate,
  maxParticipants,
  tradingConstraints,
  rewards,
  evaluationMetric,
  perpsProvider,
  rewardsIneligible,
}: {
  adminRpcClient: RouterClient<typeof adminRouter>;
  name?: string;
  description?: string;
  sandboxMode?: boolean;
  externalUrl?: string;
  imageUrl?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  boostStartDate?: string | Date;
  boostEndDate?: string | Date;
  joinStartDate?: string | Date;
  joinEndDate?: string | Date;
  maxParticipants?: number;
  tradingConstraints?: z.infer<
    typeof AdminCreateCompetitionSchema
  >["tradingConstraints"];
  rewards?: Record<number, number>;
  evaluationMetric?: "calmar_ratio" | "sortino_ratio" | "simple_return";
  perpsProvider?: {
    provider: "symphony" | "hyperliquid";
    initialCapital: number;
    selfFundingThreshold: number;
    minFundingThreshold?: number;
    apiUrl?: string;
  };
  rewardsIneligible?: string[];
}) {
  const competitionName = name || `Perps Test Competition ${Date.now()}`;
  const result = await adminRpcClient.competitions.create({
    name: competitionName,
    description: description || `Perpetual futures test competition`,
    type: "perpetual_futures",
    sandboxMode,
    externalUrl,
    imageUrl,
    startDate: startDate instanceof Date ? startDate.toISOString() : startDate,
    endDate: endDate instanceof Date ? endDate.toISOString() : endDate,
    boostStartDate:
      boostStartDate instanceof Date
        ? boostStartDate.toISOString()
        : boostStartDate,
    boostEndDate:
      boostEndDate instanceof Date ? boostEndDate.toISOString() : boostEndDate,
    joinStartDate:
      joinStartDate instanceof Date
        ? joinStartDate.toISOString()
        : joinStartDate,
    joinEndDate:
      joinEndDate instanceof Date ? joinEndDate.toISOString() : joinEndDate,
    maxParticipants,
    tradingConstraints,
    rewards,
    evaluationMetric,
    perpsProvider: perpsProvider || {
      provider: "symphony",
      initialCapital: 500,
      selfFundingThreshold: 0,
      apiUrl: "http://localhost:4567", // Default to mock server
    },
    rewardsIneligible,
    arenaId: "default-perps-arena",
  });

  if (!result.success) {
    throw new Error("Failed to create perps competition");
  }

  return result;
}

export const defaultPaperTradingInitialBalances = (): z.infer<
  typeof PaperTradingInitialBalanceSchema
>[] =>
  [...DEFAULT_PAPER_TRADING_INITIAL_BALANCES] as z.infer<
    typeof PaperTradingInitialBalanceSchema
  >[];
