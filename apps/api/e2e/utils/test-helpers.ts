import axios from "axios";
import * as crypto from "crypto";
import { and, asc, eq } from "drizzle-orm";
import { getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { expect } from "vitest";

import { portfolioSnapshots } from "@recallnet/db-schema/trading/defs";

import { db } from "@/database/db.js";

import { ApiClient } from "./api-client.js";
import {
  CreateCompetitionResponse,
  CrossChainTradingType,
  ErrorResponse,
  StartCompetitionResponse,
  TradingConstraints,
  UserProfileResponse,
} from "./api-types.js";
import {
  createMockPrivyToken,
  createTestPrivyUser,
  generateRandomPrivyId,
} from "./privy.js";
import { getBaseUrl } from "./server.js";

// Configured test token address
export const TEST_TOKEN_ADDRESS =
  process.env.TEST_SOL_TOKEN_ADDRESS ||
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R";

/**
 * Create a test agent with automatic unique handle generation
 * This wrapper ensures all test agents have unique handles
 */
export async function createTestAgent(
  client: ApiClient,
  name: string,
  description?: string,
  imageUrl?: string,
  metadata?: Record<string, unknown>,
  handle?: string,
) {
  // Generate a unique handle if not provided
  const agentHandle =
    handle ||
    generateTestHandle(
      name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 8),
    );

  return client.createAgent(name, agentHandle, description, imageUrl, metadata);
}

/**
 * Generate a unique handle for testing
 * Ensures uniqueness by using timestamp and random suffix
 */
export function generateTestHandle(prefix: string = "agent"): string {
  // Clean the prefix: lowercase, remove non-alphanumeric except underscores
  const cleanPrefix = prefix
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 8);

  // If prefix is empty after cleaning, use a default
  const name = cleanPrefix || "agent";

  // Generate random suffix (4 chars)
  const random = Math.random().toString(36).slice(2, 6);

  // Combine with underscore separator
  let handle = `${name}_${random}`;

  // Ensure it's within length limit
  handle = handle.slice(0, 15);

  // Final safety check: if handle is somehow empty or only whitespace
  if (!handle || handle.trim().length === 0) {
    handle = `agent${Date.now().toString(36).slice(-6)}`;
  }

  return handle;
}

// HAY token - should be volatile & infrequently traded https://coinmarketcap.com/currencies/haycoin/
export const VOLATILE_TOKEN = "0xfa3e941d1f6b7b10ed84a0c211bfa8aee907965e";

// Fixed admin credentials - must match setup-admin.ts
export const ADMIN_USERNAME = "admin";
export const ADMIN_PASSWORD = "admin123";
export const ADMIN_EMAIL = "admin@test.com";

export const looseTradingConstraints = {
  minimum24hVolumeUsd: 5000,
  minimumFdvUsd: 50000,
  minimumLiquidityUsd: 5000,
  minimumPairAgeHours: 0,
  minTradesPerDay: null,
};

export const noTradingConstraints = {
  minimum24hVolumeUsd: 0,
  minimumFdvUsd: 0,
  minimumLiquidityUsd: 0,
  minimumPairAgeHours: 0,
  minTradesPerDay: null,
};

export const strictTradingConstraints = {
  minimum24hVolumeUsd: 100000,
  minimumFdvUsd: 1000000,
  minimumLiquidityUsd: 500000,
  minimumPairAgeHours: 24,
  minTradesPerDay: 10,
};

/**
 * Create a new API client for testing with random credentials
 * This is useful for creating a client that doesn't have predefined API credentials
 */
export function createTestClient(baseUrl?: string): ApiClient {
  // Generate a random key
  const segment1 = crypto.randomBytes(8).toString("hex"); // 16 chars
  const segment2 = crypto.randomBytes(8).toString("hex"); // 16 chars
  return new ApiClient(`${segment1}_${segment2}`, baseUrl);
}

/**
 * Register a new user and agent, and return a client configured with the agent's API credentials
 */
export async function registerUserAndAgentAndGetClient({
  adminApiKey,
  walletAddress,
  embeddedWalletAddress,
  privyId,
  userName,
  userEmail,
  userImageUrl,
  agentName,
  agentHandle,
  agentDescription,
  agentImageUrl,
  agentMetadata,
  agentWalletAddress,
}: {
  adminApiKey: string;
  walletAddress?: string;
  embeddedWalletAddress?: string;
  privyId?: string;
  userName?: string;
  userEmail?: string;
  userImageUrl?: string;
  agentName?: string;
  agentHandle?: string;
  agentDescription?: string;
  agentImageUrl?: string;
  agentMetadata?: Record<string, unknown>;
  agentWalletAddress?: string;
}) {
  const sdk = new ApiClient(adminApiKey);

  // Register a new user with optional agent creation
  const result = await sdk.registerUser({
    walletAddress: walletAddress || generateRandomEthAddress(),
    embeddedWalletAddress: embeddedWalletAddress || generateRandomEthAddress(),
    privyId: privyId || generateRandomPrivyId(),
    name: userName || `User ${generateRandomString(8)}`,
    email: userEmail || `user-${generateRandomString(8)}@test.com`,
    userImageUrl,
    agentName: agentName || `Agent ${generateRandomString(8)}`,
    agentHandle: agentHandle || generateTestHandle(agentName),
    agentDescription:
      agentDescription || `Test agent for ${agentName || "testing"}`,
    agentImageUrl,
    agentMetadata,
    agentWalletAddress: agentWalletAddress || generateRandomEthAddress(),
  });

  if (
    !result.success ||
    !result.user ||
    !result.agent ||
    typeof result.agent.id !== "string"
  ) {
    throw new Error("Failed to register user and agent");
  }

  // Create a client with the agent's API key
  const client = new ApiClient(result.agent.apiKey);

  return {
    client,
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
    apiKey: result.agent.apiKey || "",
  };
}

/**
 * Start a competition with given agents
 */
export async function startTestCompetition({
  adminClient,
  name,
  agentIds,
  sandboxMode,
  externalUrl,
  imageUrl,
  tradingConstraints,
}: {
  adminClient: ApiClient;
  name?: string;
  agentIds?: string[];
  sandboxMode?: boolean;
  externalUrl?: string;
  imageUrl?: string;
  tradingConstraints?: TradingConstraints;
}): Promise<StartCompetitionResponse> {
  const competitionName = name || `Test competition ${Date.now()}`;
  const result = await adminClient.startCompetition({
    name: competitionName,
    description: `Test competition description for ${competitionName}`,
    agentIds: agentIds || [],
    sandboxMode,
    externalUrl,
    imageUrl,
    tradingConstraints,
  });

  if (!result.success) {
    throw new Error("Failed to start competition");
  }

  return result as StartCompetitionResponse;
}

/**
 * Create a competition in PENDING state without starting it
 */
export async function createTestCompetition({
  adminClient,
  name,
  description,
  sandboxMode,
  externalUrl,
  imageUrl,
  type,
  tradingType,
  startDate,
  endDate,
  votingStartDate,
  votingEndDate,
  joinStartDate,
  joinEndDate,
  maxParticipants,
  tradingConstraints,
}: {
  adminClient: ApiClient;
  name?: string;
  description?: string;
  sandboxMode?: boolean;
  externalUrl?: string;
  imageUrl?: string;
  type?: string;
  tradingType?: CrossChainTradingType;
  startDate?: string;
  endDate?: string;
  votingStartDate?: string;
  votingEndDate?: string;
  joinStartDate?: string;
  joinEndDate?: string;
  maxParticipants?: number;
  tradingConstraints?: TradingConstraints;
}): Promise<CreateCompetitionResponse> {
  const competitionName = name || `Test competition ${Date.now()}`;
  const result = await adminClient.createCompetition({
    name: competitionName,
    description:
      description || `Test competition description for ${competitionName}`,
    tradingType,
    sandboxMode,
    externalUrl,
    imageUrl,
    type,
    startDate,
    endDate,
    votingStartDate,
    votingEndDate,
    joinStartDate,
    joinEndDate,
    maxParticipants,
    tradingConstraints,
  });

  if (!result.success) {
    throw new Error("Failed to create competition");
  }

  return result as CreateCompetitionResponse;
}

/**
 * Start an existing competition with given agents
 */
export async function startExistingTestCompetition({
  adminClient,
  competitionId,
  agentIds,
  sandboxMode,
  externalUrl,
  imageUrl,
}: {
  adminClient: ApiClient;
  competitionId: string;
  agentIds?: string[];
  sandboxMode?: boolean;
  externalUrl?: string;
  imageUrl?: string;
}): Promise<StartCompetitionResponse> {
  const result = await adminClient.startExistingCompetition({
    competitionId,
    agentIds: agentIds || [],
    sandboxMode,
    externalUrl,
    imageUrl,
  });

  if (!result.success) {
    throw new Error("Failed to start existing competition");
  }

  return result as StartCompetitionResponse;
}

/**
 * Wait for a specified amount of time (useful for testing async processes)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random string of specified length
 */
export function generateRandomString(length: number): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate random hex string of specific length
 */
export function generateRandomEthAddress(): string {
  const hexChars = "0123456789abcdef";
  let result = "0x";
  for (let i = 0; i < 40; i++) {
    const randomIndex = Math.floor(Math.random() * hexChars.length);
    result += hexChars[randomIndex];
  }

  // Convert to proper EIP-55 checksum format using viem
  return getAddress(result).toLowerCase();
}

/**
 * Create a Privy-authenticated client for testing user routes
 * This generates a unique test user and returns a client with an active Privy session
 */
export async function createPrivyAuthenticatedClient({
  userName,
  userEmail,
  walletAddress,
  embeddedWalletAddress,
  privyId,
}: {
  userName?: string;
  userEmail?: string;
  walletAddress?: string;
  embeddedWalletAddress?: string;
  privyId?: string;
}) {
  // Generate a unique wallet for this test
  const testEmbeddedWallet =
    embeddedWalletAddress || generateRandomEthAddress();

  // Use unique names/emails for this test
  const timestamp = Date.now();
  const uniqueUserEmail = userEmail || `privy-user-${timestamp}@test.com`;

  // Generate a unique privyId for the user
  const uniquePrivyId = privyId || generateRandomPrivyId();

  // Create a session client (without API key)
  const privyUser = createTestPrivyUser({
    privyId: uniquePrivyId, // Use the actual privyId from the registered user
    name: userName ?? undefined,
    email: uniqueUserEmail,
    walletAddress: walletAddress || testEmbeddedWallet,
    provider: "email",
  });
  const privyToken = await createMockPrivyToken(privyUser);
  const sessionClient = new ApiClient(undefined, getBaseUrl());
  sessionClient.setJwtToken(privyToken);

  // Login will create (or backfill/update) a user with Privy-related information
  const loginResponse = await sessionClient.login();
  if (!loginResponse.success || !loginResponse.userId) {
    throw new Error(
      `Failed to login with Privy: ${(loginResponse as ErrorResponse).error}`,
    );
  }
  const userResponse = await sessionClient.getUserProfile();
  if (!userResponse.success) {
    throw new Error(
      `Failed to get user profile: ${(userResponse as ErrorResponse).error}`,
    );
  }
  let { user } = userResponse;
  // For convenience, we auto-update the user name. A "first time" login is
  // unaware of the user's name and infers it based on Google, email, etc.,
  // but we simulate a manual update to help with testing
  if (userName) {
    ({ user } = (await sessionClient.updateUserProfile({
      name: userName,
    })) as UserProfileResponse);
  }

  // Add a small delay to ensure session is properly saved
  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    client: sessionClient,
    user: {
      id: user.id,
      walletAddress: user.walletAddress || testEmbeddedWallet,
      embeddedWalletAddress: user.embeddedWalletAddress || testEmbeddedWallet,
      walletLastVerifiedAt: user.walletLastVerifiedAt || null,
      privyId: user.privyId,
      name: user.name || userName,
      email: user.email || uniqueUserEmail,
      imageUrl: user.imageUrl || null,
      status: user.status || "active",
      metadata: user.metadata || null,
      createdAt: user.createdAt || new Date().toISOString(),
      updatedAt: user.updatedAt || new Date().toISOString(),
      lastLoginAt: user.lastLoginAt || new Date().toISOString(),
    },
    // Include wallet info for potential future use
    wallet: user.walletAddress || testEmbeddedWallet,
    loginData: loginResponse,
  };
}

/**
 * Create verification message and signature for testing agent wallet verification
 * @param privateKey The private key to sign with
 * @param nonce The nonce for verification (required)
 * @param timestampOverride Optional timestamp override for testing
 * @param domain Optional domain override for testing (defaults to api.recall.net)
 * @returns Object with message and signature
 */
export async function createAgentVerificationSignature(
  privateKey: string,
  nonce: string,
  timestampOverride?: string,
  domain?: string,
): Promise<{ message: string; signature: string }> {
  const timestamp = timestampOverride || new Date().toISOString();

  const verificationDomain = domain || "http://localhost:3001";

  const message = `VERIFY_WALLET_OWNERSHIP
Timestamp: ${timestamp}
Domain: ${verificationDomain}
Purpose: WALLET_VERIFICATION
Nonce: ${nonce}`;

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const signature = await account.signMessage({ message });

  return { message, signature };
}

/**
 * Create 3 users and agents, and 20 competitions
 * @param adminApiKey an admin api key to generate users, agents, and competitions
 * @returns Object with created users, agents, and competitions
 */
export async function generateTestCompetitions(adminApiKey: string) {
  const adminClient = createTestClient();
  const loginSuccess = await adminClient.loginAsAdmin(adminApiKey);
  expect(loginSuccess).toBe(true);

  // Create an agent and user
  const {
    user: user1,
    agent: agent1,
    client: client1,
  } = await registerUserAndAgentAndGetClient({ adminApiKey });

  // Create a second and third user and agent so we can test that
  //  responses only include the correct agents
  const {
    user: user2,
    agent: agent2,
    client: client2,
  } = await registerUserAndAgentAndGetClient({ adminApiKey });

  const {
    user: user3,
    agent: agent3,
    client: client3,
  } = await registerUserAndAgentAndGetClient({ adminApiKey });

  const comps = [];
  for (let i = 0; i < 20; i++) {
    const result = await createTestCompetition({
      adminClient,
      name: `Competition ${i} ${Date.now()}`,
    });

    comps.push(result);

    // ensure there is a mix of agents and competitions to test against
    if (i < 15) {
      await client1.joinCompetition(result.competition.id, agent1.id);
      if (i % 2) {
        await client2.joinCompetition(result.competition.id, agent2.id);
      }
      if (!(i % 3)) {
        await client3.joinCompetition(result.competition.id, agent3.id);
      }
    } else {
      await client2.joinCompetition(result.competition.id, agent2.id);
      await client3.joinCompetition(result.competition.id, agent3.id);
    }
  }

  return {
    competitions: comps,
    agent1,
    agent2,
    agent3,
    client1,
    client2,
    client3,
    user1,
    user2,
    user3,
  };
}

export async function getStartingValue(agentId: string, competitionId: string) {
  // Direct database lookup for oldest portfolio snapshot
  const oldestSnapshot = await db
    .select()
    .from(portfolioSnapshots)
    .where(
      and(
        eq(portfolioSnapshots.agentId, agentId),
        eq(portfolioSnapshots.competitionId, competitionId),
      ),
    )
    .orderBy(asc(portfolioSnapshots.timestamp))
    .limit(1);

  const val = oldestSnapshot[0]?.totalValue;
  if (typeof val !== "number" || val <= 0) {
    throw new Error("no starting value found");
  }

  return val;
}

export async function getAdminApiKey() {
  // Create admin account
  const response = await axios.post(`${getBaseUrl()}/api/admin/setup`, {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
    email: ADMIN_EMAIL,
  });

  const adminApiKey = response.data.admin.apiKey;
  expect(adminApiKey).toBeDefined();

  return adminApiKey;
}

/**
 * Create a perps competition in PENDING state
 */
export async function createPerpsTestCompetition({
  adminClient,
  name,
  description,
  sandboxMode,
  externalUrl,
  imageUrl,
  startDate,
  endDate,
  votingStartDate,
  votingEndDate,
  joinStartDate,
  joinEndDate,
  maxParticipants,
  tradingConstraints,
  rewards,
  perpsProvider,
}: {
  adminClient: ApiClient;
  name?: string;
  description?: string;
  sandboxMode?: boolean;
  externalUrl?: string;
  imageUrl?: string;
  startDate?: string;
  endDate?: string;
  votingStartDate?: string;
  votingEndDate?: string;
  joinStartDate?: string;
  joinEndDate?: string;
  maxParticipants?: number;
  tradingConstraints?: TradingConstraints;
  rewards?: Record<number, number>;
  perpsProvider?: {
    provider: "symphony" | "hyperliquid";
    initialCapital: number;
    selfFundingThreshold: number;
    apiUrl?: string;
  };
}): Promise<CreateCompetitionResponse> {
  const competitionName = name || `Perps Test Competition ${Date.now()}`;
  const result = await adminClient.createCompetition({
    name: competitionName,
    description: description || `Perpetual futures test competition`,
    type: "perpetual_futures",
    sandboxMode,
    externalUrl,
    imageUrl,
    startDate,
    endDate,
    votingStartDate,
    votingEndDate,
    joinStartDate,
    joinEndDate,
    maxParticipants,
    tradingConstraints,
    rewards,
    perpsProvider: perpsProvider || {
      provider: "symphony",
      initialCapital: 500,
      selfFundingThreshold: 0,
      apiUrl: "http://localhost:4567", // Default to mock server
    },
  });

  if (!result.success) {
    throw new Error("Failed to create perps competition");
  }

  return result as CreateCompetitionResponse;
}

/**
 * Start a perps competition directly (create and start in one go)
 */
export async function startPerpsTestCompetition({
  adminClient,
  name,
  agentIds,
  sandboxMode,
  externalUrl,
  imageUrl,
  tradingConstraints,
  rewards,
  perpsProvider = {
    provider: "symphony" as const,
    initialCapital: 500,
    selfFundingThreshold: 0,
    apiUrl: "http://localhost:4567", // Point to mock server by default
  },
}: {
  adminClient: ApiClient;
  name?: string;
  agentIds?: string[];
  sandboxMode?: boolean;
  externalUrl?: string;
  imageUrl?: string;
  tradingConstraints?: TradingConstraints;
  rewards?: Record<number, number>;
  perpsProvider?: {
    provider: "symphony" | "hyperliquid";
    initialCapital?: number;
    selfFundingThreshold?: number;
    apiUrl?: string;
  };
}): Promise<StartCompetitionResponse> {
  const competitionName = name || `Perps Test Competition ${Date.now()}`;
  const result = await adminClient.startCompetition({
    name: competitionName,
    description: `Perpetual futures test competition for ${competitionName}`,
    type: "perpetual_futures", // Key difference - explicitly set type
    agentIds: agentIds || [],
    sandboxMode,
    externalUrl,
    imageUrl,
    tradingConstraints,
    rewards,
    perpsProvider,
  });

  if (!result.success) {
    throw new Error("Failed to start perps competition");
  }

  return result as StartCompetitionResponse;
}
