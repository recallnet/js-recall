import * as crypto from "crypto";
import { and, asc, eq } from "drizzle-orm";
import { getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { expect } from "vitest";

import { ApiSDK } from "@recallnet/api-sdk";

import { db } from "@/database/db.js";
import { clearSnapshotCache } from "@/database/repositories/competition-repository.js";
import { portfolioSnapshots } from "@/database/schema/trading/defs.js";
import { resetRateLimiters } from "@/middleware/rate-limiter.middleware.js";

import { ApiClient } from "./api-client.js";
import {
  CreateCompetitionResponse,
  StartCompetitionResponse,
} from "./api-types.js";
import { dbManager } from "./db-manager.js";
import { getBaseUrl } from "./server.js";
import {
  createSiweMessage,
  createTestWallet,
  signMessage,
} from "./siwe-utils.js";

// Configured test token address
export const TEST_TOKEN_ADDRESS =
  process.env.TEST_SOL_TOKEN_ADDRESS ||
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R";

// Vision token - should be volitile https://coinmarketcap.com/currencies/openvision/
export const VISION_TOKEN = "0xe6f98920852A360497dBcc8ec895F1bB1F7c8Df4";

// Fixed admin credentials - must match setup-admin.ts
export const ADMIN_USERNAME = "admin";
export const ADMIN_PASSWORD = "admin123";
export const ADMIN_EMAIL = "admin@test.com";

export const looseConstraints = {
  minimum24hVolumeUsd: 5000,
  minimumFdvUsd: 50000,
  minimumLiquidityUsd: 5000,
  minimumPairAgeHours: 0,
};
// Flag to track if database is initialized
let isDatabaseInitialized = false;

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
  userName,
  userEmail,
  userImageUrl,
  agentName,
  agentDescription,
  agentImageUrl,
  agentMetadata,
  agentWalletAddress,
}: {
  adminApiKey: string;
  walletAddress?: string;
  userName?: string;
  userEmail?: string;
  userImageUrl?: string;
  agentName?: string;
  agentDescription?: string;
  agentImageUrl?: string;
  agentMetadata?: Record<string, unknown>;
  agentWalletAddress?: string;
}) {
  // Ensure database is initialized
  await ensureDatabaseInitialized();

  const sdk = getApiSdk(adminApiKey);

  // Register a new user with optional agent creation
  const result = await sdk.admin.postApiAdminUsers({
    walletAddress: walletAddress || generateRandomEthAddress(),
    name: userName || `User ${generateRandomString(8)}`,
    email: userEmail || `user-${generateRandomString(8)}@test.com`,
    userImageUrl,
    agentName: agentName || `Agent ${generateRandomString(8)}`,
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
      name: result.user.name || "",
      email: result.user.email || "",
      imageUrl: result.user.imageUrl || null,
      status: result.user.status || "active",
      metadata: result.user.metadata || null,
      createdAt: result.user.createdAt || new Date().toISOString(),
      updatedAt: result.user.updatedAt || new Date().toISOString(),
    },
    agent: {
      id: result.agent.id || "",
      ownerId: result.agent.ownerId || "",
      walletAddress: result.agent.walletAddress || "",
      name: result.agent.name || "",
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
export async function startTestCompetition(
  adminClient: ApiClient,
  name: string,
  agentIds: string[],
  sandboxMode?: boolean,
  externalUrl?: string,
  imageUrl?: string,
  tradingConstraints?: {
    minimumPairAgeHours?: number;
    minimum24hVolumeUsd?: number;
    minimumLiquidityUsd?: number;
    minimumFdvUsd?: number;
  },
): Promise<StartCompetitionResponse> {
  // Ensure database is initialized
  await ensureDatabaseInitialized();

  const result = await adminClient.startCompetition(
    name,
    `Test competition description for ${name}`,
    agentIds,
    undefined, // tradingType
    sandboxMode,
    externalUrl,
    imageUrl,
    undefined, // votingStartDate
    undefined, // votingEndDate
    tradingConstraints,
  );

  if (!result.success) {
    throw new Error("Failed to start competition");
  }

  return result as StartCompetitionResponse;
}

/**
 * Create a competition in PENDING state without starting it
 */
export async function createTestCompetition(
  adminClient: ApiClient,
  name: string,
  description?: string,
  sandboxMode?: boolean,
  externalUrl?: string,
  imageUrl?: string,
  type?: string,
  votingStartDate?: string,
  votingEndDate?: string,
  joinStartDate?: string,
  joinEndDate?: string,
): Promise<CreateCompetitionResponse> {
  // Ensure database is initialized
  await ensureDatabaseInitialized();

  const result = await adminClient.createCompetition(
    name,
    description || `Test competition description for ${name}`,
    undefined, // tradingType
    sandboxMode,
    externalUrl,
    imageUrl,
    type,
    undefined, // endDate
    votingStartDate,
    votingEndDate,
    joinStartDate,
    joinEndDate,
  );

  if (!result.success) {
    throw new Error("Failed to create competition");
  }

  return result as CreateCompetitionResponse;
}

/**
 * Start an existing competition with given agents
 */
export async function startExistingTestCompetition(
  adminClient: ApiClient,
  competitionId: string,
  agentIds: string[],
  sandboxMode?: boolean,
  externalUrl?: string,
  imageUrl?: string,
): Promise<StartCompetitionResponse> {
  // Ensure database is initialized
  await ensureDatabaseInitialized();

  const result = await adminClient.startExistingCompetition(
    competitionId,
    agentIds,
    undefined, // crossChainTradingType
    sandboxMode,
    externalUrl,
    imageUrl,
  );

  if (!result.success) {
    throw new Error("Failed to start existing competition");
  }

  return result as StartCompetitionResponse;
}

/**
 * Ensure the database is initialized before using it
 */
async function ensureDatabaseInitialized(): Promise<void> {
  if (!isDatabaseInitialized) {
    console.log("Initializing database for tests...");
    await dbManager.initialize();
    isDatabaseInitialized = true;
  }
}

/**
 * Clean up database state for a given test case
 * This can be used in beforeEach to ensure a clean state
 * Now delegated to the DbManager for consistency
 */
export async function cleanupTestState(): Promise<void> {
  await ensureDatabaseInitialized();

  // Also reset rate limiters to ensure clean state between tests
  resetRateLimiters();

  // Clear snapshot cache
  clearSnapshotCache();

  return dbManager.cleanupTestState();
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
  return getAddress(result);
}

/**
 * Helper for getting an instance of the sdk for a given api key
 */
export function getApiSdk(apiKey: string): InstanceType<typeof ApiSDK> {
  return new ApiSDK({
    bearerAuth: apiKey,
    serverURL: getBaseUrl(),
  });
}

/**
 * Create a SIWE-authenticated client for testing user routes
 * This generates a unique wallet for each test and returns a client with an active SIWE session
 */
export async function createSiweAuthenticatedClient({
  adminApiKey,
  userName,
  userEmail,
  userImageUrl,
}: {
  adminApiKey: string;
  userName?: string;
  userEmail?: string;
  userImageUrl?: string;
}) {
  // Ensure database is initialized
  await ensureDatabaseInitialized();

  const sdk = getApiSdk(adminApiKey);

  // Generate a unique wallet for this test
  const testWallet = createTestWallet();

  // Use unique names/emails for this test
  const timestamp = Date.now();
  const uniqueUserName = userName || `SIWE User ${timestamp}`;
  const uniqueUserEmail = userEmail || `siwe-user-${timestamp}@test.com`;

  // Register a new user with the unique wallet address
  const result = await sdk.admin.postApiAdminUsers({
    walletAddress: testWallet.address,
    name: uniqueUserName,
    email: uniqueUserEmail,
    userImageUrl,
    // Don't create an agent automatically - user can create one via SIWE session if needed
  });

  if (!result.success || !result.user) {
    throw new Error("Failed to register user for SIWE authentication");
  }

  // Create a session client (without API key)
  const sessionClient = new ApiClient(undefined, getBaseUrl());

  // Perform SIWE authentication
  const domain = new URL(getBaseUrl()).hostname || "localhost";

  // Get nonce
  const nonceResponse = await sessionClient.getNonce();
  if (!nonceResponse || "error" in nonceResponse) {
    throw new Error("Failed to get nonce for SIWE authentication");
  }

  // Create and sign SIWE message using the unique wallet
  const message = await createSiweMessage(
    domain,
    nonceResponse.nonce,
    testWallet.address,
  );
  const signature = await signMessage(message, testWallet.account);

  // Login with SIWE
  const loginResponse = await sessionClient.login(message, signature);
  if (!loginResponse || "error" in loginResponse) {
    throw new Error("Failed to login with SIWE");
  }

  // Add a small delay to ensure session is properly saved
  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    client: sessionClient,
    user: {
      id: result.user.id || "",
      walletAddress: result.user.walletAddress || testWallet.address,
      name: result.user.name || uniqueUserName,
      email: result.user.email || uniqueUserEmail,
      imageUrl: result.user.imageUrl || null,
      status: result.user.status || "active",
      metadata: result.user.metadata || null,
      createdAt: result.user.createdAt || new Date().toISOString(),
      updatedAt: result.user.updatedAt || new Date().toISOString(),
    },
    wallet: testWallet, // Include wallet info for potential future use
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
    const result = await createTestCompetition(
      adminClient,
      `Competition ${i} ${Date.now()}`,
    );

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
