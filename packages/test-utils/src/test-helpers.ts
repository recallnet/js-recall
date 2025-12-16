import axios from "axios";
import * as crypto from "crypto";
import { and, asc, eq } from "drizzle-orm";
import { getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { arenas } from "@recallnet/db/schema/core/defs";
import { portfolioSnapshots } from "@recallnet/db/schema/trading/defs";

import { ApiClient } from "./api-client.js";
import { db } from "./database.js";
import {
  createMockPrivyToken,
  createTestPrivyUser,
  generateRandomPrivyId,
} from "./privy.js";
import { getBaseUrl } from "./server.js";
import {
  CreateCompetitionResponse,
  CrossChainTradingType,
  ErrorResponse,
  StartCompetitionResponse,
  TradingConstraints,
} from "./types.js";

// Configured test token address
export const TEST_TOKEN_ADDRESS =
  process.env.TEST_SOL_TOKEN_ADDRESS ||
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R";

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
 * Default paper trading initial balances for test competitions
 * Matches all initial balances from .env.test to ensure test consistency
 */
export const DEFAULT_PAPER_TRADING_INITIAL_BALANCES: Array<{
  specificChain: string;
  tokenSymbol: string;
  amount: number;
}> = [
  // Solana (SVM) balances
  {
    specificChain: "svm",
    tokenSymbol: "sol",
    amount: 10, // INITIAL_SVM_SOL_BALANCE
  },
  {
    specificChain: "svm",
    tokenSymbol: "usdc",
    amount: 5000, // INITIAL_SVM_USDC_BALANCE
  },
  {
    specificChain: "svm",
    tokenSymbol: "usdt",
    amount: 1000, // INITIAL_SVM_USDT_BALANCE
  },
  // Ethereum balances
  {
    specificChain: "eth",
    tokenSymbol: "eth",
    amount: 1, // INITIAL_ETH_ETH_BALANCE
  },
  {
    specificChain: "eth",
    tokenSymbol: "usdc",
    amount: 5000, // INITIAL_ETH_USDC_BALANCE
  },
  // Note: INITIAL_ETH_USDT_BALANCE=0, so we skip it (zero amounts don't add value)
  // Optimism balances
  {
    specificChain: "optimism",
    tokenSymbol: "usdc",
    amount: 200, // INITIAL_OPTIMISM_USDC_BALANCE
  },
  // Polygon balances
  {
    specificChain: "polygon",
    tokenSymbol: "usdc",
    amount: 200, // INITIAL_POLYGON_USDC_BALANCE
  },
  // Arbitrum balances
  {
    specificChain: "arbitrum",
    tokenSymbol: "usdc",
    amount: 200, // INITIAL_ARBITRUM_USDC_BALANCE
  },
];

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
  rewardsIneligible,
  paperTradingInitialBalances,
}: {
  adminClient: ApiClient;
  name?: string;
  agentIds?: string[];
  sandboxMode?: boolean;
  externalUrl?: string;
  imageUrl?: string;
  tradingConstraints?: TradingConstraints;
  rewardsIneligible?: string[];
  paperTradingInitialBalances?: Array<{
    specificChain: string;
    tokenSymbol: string;
    amount: number;
  }>;
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
    arenaId: "default-paper-arena",
    paperTradingInitialBalances:
      paperTradingInitialBalances || DEFAULT_PAPER_TRADING_INITIAL_BALANCES,
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
  boostStartDate,
  boostEndDate,
  joinStartDate,
  joinEndDate,
  maxParticipants,
  tradingConstraints,
  rewardsIneligible,
  paperTradingInitialBalances,
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
  boostStartDate?: string;
  boostEndDate?: string;
  joinStartDate?: string;
  joinEndDate?: string;
  maxParticipants?: number;
  tradingConstraints?: TradingConstraints;
  rewardsIneligible?: string[];
  paperTradingInitialBalances?: Array<{
    specificChain: string;
    tokenSymbol: string;
    amount: number;
  }>;
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
    boostStartDate,
    boostEndDate,
    joinStartDate,
    joinEndDate,
    maxParticipants,
    tradingConstraints,
    rewardsIneligible,
    arenaId: "default-paper-arena",
    paperTradingInitialBalances:
      paperTradingInitialBalances || DEFAULT_PAPER_TRADING_INITIAL_BALANCES,
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
  // Ensure default arenas exist for tests
  await ensureDefaultArenas();

  // Create admin account
  const response = await axios.post(`${getBaseUrl()}/admin/setup`, {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
    email: ADMIN_EMAIL,
  });

  const adminApiKey = response.data.admin.apiKey;
  if (!adminApiKey) {
    throw new Error("Failed to get admin API key from setup response");
  }

  return adminApiKey;
}

/**
 * Ensure default arenas exist in the database for testing
 * This should be called before any test that creates competitions
 */
async function ensureDefaultArenas() {
  await db
    .insert(arenas)
    .values({
      id: "default-paper-arena",
      name: "Default Paper Trading Arena",
      createdBy: "system",
      category: "crypto_trading",
      skill: "spot_paper_trading",
      kind: "Competition",
    })
    .onConflictDoNothing();

  await db
    .insert(arenas)
    .values({
      id: "default-perps-arena",
      name: "Default Perpetual Futures Arena",
      createdBy: "system",
      category: "crypto_trading",
      skill: "perpetual_futures",
      kind: "Competition",
    })
    .onConflictDoNothing();

  await db
    .insert(arenas)
    .values({
      id: "default-spot-live-arena",
      name: "Default Spot Live Trading Arena",
      createdBy: "system",
      category: "crypto_trading",
      skill: "spot_live_trading",
      kind: "Competition",
    })
    .onConflictDoNothing();

  await db
    .insert(arenas)
    .values({
      id: "default-nfl-game-prediction-arena",
      name: "Default NFL Game Prediction Arena",
      createdBy: "system",
      category: "sports",
      skill: "sports_prediction",
      kind: "Competition",
    })
    .onConflictDoNothing();
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
  adminClient: ApiClient;
  name?: string;
  description?: string;
  sandboxMode?: boolean;
  externalUrl?: string;
  imageUrl?: string;
  startDate?: string;
  endDate?: string;
  boostStartDate?: string;
  boostEndDate?: string;
  joinStartDate?: string;
  joinEndDate?: string;
  maxParticipants?: number;
  tradingConstraints?: TradingConstraints;
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
    boostStartDate,
    boostEndDate,
    joinStartDate,
    joinEndDate,
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
  evaluationMetric,
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
  evaluationMetric?: "calmar_ratio" | "sortino_ratio" | "simple_return";
  perpsProvider?: {
    provider: "symphony" | "hyperliquid";
    initialCapital?: number;
    selfFundingThreshold?: number;
    minFundingThreshold?: number;
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
    evaluationMetric,
    perpsProvider,
    arenaId: "default-perps-arena",
  });

  if (!result.success) {
    throw new Error("Failed to start perps competition");
  }

  return result as StartCompetitionResponse;
}

/**
 * Start a spot live trading competition (create and start in one go)
 * Mirrors startPerpsTestCompetition pattern
 */
export async function startSpotLiveTestCompetition({
  adminClient,
  name,
  agentIds,
  sandboxMode,
  externalUrl,
  imageUrl,
  tradingConstraints,
  rewards,
  spotLiveConfig = {
    dataSource: "rpc_direct" as const,
    dataSourceConfig: {
      type: "rpc_direct",
      provider: "alchemy",
      chains: ["base"],
    },
    chains: ["base"],
    allowedProtocols: [
      {
        protocol: "aerodrome",
        chain: "base",
      },
    ],
    selfFundingThresholdUsd: 10,
    syncIntervalMinutes: 2,
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
  spotLiveConfig?: {
    dataSource: "rpc_direct" | "envio_indexing" | "hybrid";
    dataSourceConfig: Record<string, unknown>;
    chains: string[];
    allowedProtocols?: Array<{ protocol: string; chain: string }>;
    allowedTokens?: Array<{ address: string; specificChain: string }>;
    selfFundingThresholdUsd?: number;
    minFundingThreshold?: number;
    syncIntervalMinutes?: number;
  };
}): Promise<StartCompetitionResponse> {
  const competitionName = name || `Spot Live Test Competition ${Date.now()}`;
  const result = await adminClient.startCompetition({
    name: competitionName,
    description: `Spot live trading test competition for ${competitionName}`,
    type: "spot_live_trading",
    agentIds: agentIds || [],
    sandboxMode,
    externalUrl,
    imageUrl,
    tradingConstraints,
    rewards,
    spotLiveConfig,
    arenaId: "default-spot-live-arena",
  });

  if (!result.success) {
    throw new Error("Failed to start spot live competition");
  }

  return result as StartCompetitionResponse;
}

/**
 * Create a sports (NFL) game prediction competition
 */
export async function createSportsPredictionTestCompetition({
  adminClient,
  name,
  description,
  gameIds,
}: {
  adminClient: ApiClient;
  name?: string;
  description?: string;
  gameIds: string[];
}): Promise<CreateCompetitionResponse> {
  const competitionName =
    name || `NFL Prediction Test Competition ${crypto.randomUUID()}`;
  const result = await adminClient.createCompetition({
    name: competitionName,
    description:
      description || `NFL prediction test competition for ${competitionName}`,
    type: "sports_prediction",
    arenaId: "default-nfl-game-prediction-arena",
    gameIds,
  });

  if (!result.success) {
    throw new Error("Failed to create sports game prediction competition");
  }

  return result as CreateCompetitionResponse;
}

/**
 * NFL Test Client
 * Wrapper around NFL API endpoints and mock server controls
 */
export class NflTestClient {
  private client: ApiClient;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = "http://localhost:4569") {
    this.client = new ApiClient(apiKey);
    this.baseUrl = baseUrl;
  }

  /**
   * Get all games for a competition
   */
  async getGames(competitionId: string) {
    return this.client.getNflGames(competitionId);
  }

  /**
   * Get competition rules
   */
  async getRules(competitionId: string) {
    return this.client.getNflRules(competitionId);
  }

  /**
   * Get specific game info
   */
  async getGameInfo(competitionId: string, gameId: string) {
    return this.client.getNflGameInfo(competitionId, gameId);
  }

  /**
   * Get game plays (play-by-play data)
   */
  async getGamePlays(
    competitionId: string,
    gameId: string,
    limit: number = 50,
    offset: number = 0,
    latest: boolean = false,
  ) {
    return this.client.getNflGamePlays(
      competitionId,
      gameId,
      limit,
      offset,
      latest,
    );
  }

  /**
   * Predict game winner
   */
  async predictGameWinner(
    competitionId: string,
    gameId: string,
    predictedWinner: string,
    confidence: number,
    reason: string,
  ) {
    return this.client.predictGameWinner(
      competitionId,
      gameId,
      predictedWinner,
      confidence,
      reason,
    );
  }

  /**
   * Get game predictions
   */
  async getGamePredictions(
    competitionId: string,
    gameId: string,
    agentId?: string,
  ) {
    return this.client.getGamePredictions(competitionId, gameId, agentId);
  }

  /**
   * Get leaderboard for a competition or specific game
   */
  async getLeaderboard(competitionId: string, gameId?: string) {
    return this.client.getNflLeaderboard(competitionId, gameId);
  }

  /**
   * Mock Server Controls
   */

  /**
   * Reset mock server to first snapshot
   */
  async resetMockServer(providerGameId: number) {
    const response = await axios.post(
      `${this.baseUrl}/mock/reset/${providerGameId}`,
    );
    return response.data;
  }

  /**
   * Advance mock server to next snapshot
   */
  async advanceMockServer(providerGameId: number) {
    const response = await axios.post(
      `${this.baseUrl}/mock/advance/${providerGameId}`,
    );
    return response.data;
  }

  /**
   * Start auto-advance on mock server
   */
  async startAutoAdvance(providerGameId: number, intervalMs: number = 30000) {
    const response = await axios.post(
      `${this.baseUrl}/mock/auto-advance/${providerGameId}`,
      { intervalMs },
      { headers: { "Content-Type": "application/json" } },
    );
    return response.data;
  }

  /**
   * Stop auto-advance on mock server
   */
  async stopAutoAdvance(providerGameId: number) {
    const response = await axios.post(
      `${this.baseUrl}/mock/stop-auto-advance/${providerGameId}`,
    );
    return response.data;
  }
}
