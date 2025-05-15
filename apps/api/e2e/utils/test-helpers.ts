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
 * Register a new team and return a client configured with its API credentials
 */
export async function registerTeamAndGetClient(
  adminApiKey: string,
  teamName?: string,
  email?: string,
  contactPerson?: string,
  walletAddress?: string,
  imageUrl?: string
) {
  // Ensure database is initialized
  await ensureDatabaseInitialized();

  const sdk = getApiSdk(adminApiKey);
  // Register a new team
  const result = await sdk.admin.postApiAdminTeamsRegister({
    teamName: teamName || `Team ${generateRandomString(8)}`,
    email: email || `team-${generateRandomString(8)}@test.com`,
    contactPerson: contactPerson || `Contact ${generateRandomString(8)}`,
    walletAddress: walletAddress || generateRandomEthAddress(),
    imageUrl,
    metadata: {},
  });

  if (!result.success || !result.team || typeof result.team.id !== "string") {
    throw new Error("Failed to register team");
  }

  // Create a client with the team's API key
  const client = new ApiClient(result.team.apiKey);
  // TODO: work on replacing `ApiClient` instances with SDK instances everywhere
  // TODO: the return for this function can be cleaned up when we use the sdk everywhere
  return {
    client,
    team: {
      id: result.team.id || "",
      name: result.team.name || "",
      email: result.team.email || "",
      contactPerson: result.team.contactPerson || "",
      metadata: null, // TODO: this is a workaround for the inconsistency between the open api spec and actual data returned from routes
      imageUrl: result.team.imageUrl || null,
    },
    apiKey: result.team.apiKey || "",
  };
}

/**
 * Start a competition with given teams
 */
export async function startTestCompetition(
  adminClient: ApiClient,
  name: string,
  teamIds: string[],
  externalLink?: string,
  imageUrl?: string,
): Promise<StartCompetitionResponse> {
  // Ensure database is initialized
  await ensureDatabaseInitialized();

  const result = await adminClient.startCompetition(
    name,
    `Test competition description for ${name}`,
    teamIds,
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
 * Start an existing competition with given teams
 */
export async function startExistingTestCompetition(
  adminClient: ApiClient,
  competitionId: string,
  teamIds: string[],
  externalLink?: string,
  imageUrl?: string,
): Promise<StartCompetitionResponse> {
  // Ensure database is initialized
  await ensureDatabaseInitialized();

  const result = await adminClient.startExistingCompetition(
    competitionId,
    teamIds,
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
