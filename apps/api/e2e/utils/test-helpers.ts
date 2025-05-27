import * as crypto from "crypto";

import { ApiSDK } from "@recallnet/api-sdk";

import { resetRateLimiters } from "@/middleware/rate-limiter.middleware.js";

import { ApiClient } from "./api-client.js";
import {
  CreateCompetitionResponse,
  StartCompetitionResponse,
} from "./api-types.js";
import { dbManager } from "./db-manager.js";

// Configured test token address
export const TEST_TOKEN_ADDRESS =
  process.env.TEST_SOL_TOKEN_ADDRESS ||
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R";

// Fixed admin credentials - must match setup-admin.ts
export const ADMIN_USERNAME = "admin";
export const ADMIN_PASSWORD = "admin123";
export const ADMIN_EMAIL = "admin@test.com";

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
  externalLink?: string,
  imageUrl?: string,
): Promise<StartCompetitionResponse> {
  // Ensure database is initialized
  await ensureDatabaseInitialized();

  const result = await adminClient.startCompetition(
    name,
    `Test competition description for ${name}`,
    agentIds,
    undefined, // tradingType
    externalLink,
    imageUrl,
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
  externalLink?: string,
  imageUrl?: string,
): Promise<CreateCompetitionResponse> {
  // Ensure database is initialized
  await ensureDatabaseInitialized();

  const result = await adminClient.createCompetition(
    name,
    description || `Test competition description for ${name}`,
    undefined, // tradingType
    externalLink,
    imageUrl,
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
  externalLink?: string,
  imageUrl?: string,
): Promise<StartCompetitionResponse> {
  // Ensure database is initialized
  await ensureDatabaseInitialized();

  const result = await adminClient.startExistingCompetition(
    competitionId,
    agentIds,
    undefined, // crossChainTradingType
    externalLink,
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
  return result;
}

/**
 * Helper for getting an instance of the sdk for a given api key
 */
export function getApiSdk(apiKey: string): InstanceType<typeof ApiSDK> {
  return new ApiSDK({
    bearerAuth: apiKey,
    serverIdx: 2,
  });
}
