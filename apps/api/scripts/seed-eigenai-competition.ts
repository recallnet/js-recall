#!/usr/bin/env node
/**
 * ================================================================================
 * EIGENAI VERIFICATION BADGE SEED SCRIPT - FRONTEND TESTING ONLY
 * ================================================================================
 *
 * PURPOSE:
 * This script is designed EXCLUSIVELY for local frontend development and testing.
 * It creates a test environment with EigenAI verification data so you can test
 * how the EigenAI badge appears in competition standings tables.
 *
 * ⚠️ WARNING: THIS SCRIPT IS FOR LOCAL DEVELOPMENT ONLY ⚠️
 * - DO NOT run this script in production environments
 * - DO NOT use this for actual competitions
 * - DO NOT run this against production databases
 *
 * WHAT THIS SCRIPT DOES:
 * 1. Creates a spot live trading competition with test agents (same as seed-spot-live-competition.ts)
 * 2. Seeds EigenAI signature submissions for SOME agents (not all)
 * 3. Seeds badge status records marking verified agents with active badges
 *
 * USE CASES:
 * - Testing EigenAI badge display in competition standings table
 * - Verifying conditional column visibility (only shows when badges exist)
 * - Testing tooltip content with signature counts
 * - Verifying badge icon rendering at different sizes
 *
 * EIGENAI TEST CONFIGURATION:
 * - Agent 1 (DeFi Alpha Hunter): Has active badge (15 signatures)
 * - Agent 2 (HODLer Bot): Has active badge (10 signatures)
 * - Agent 3 (Swing Trader AI): NO badge (never submitted)
 * - Agent 4 (FOMO Buyer): Has badge but INACTIVE (only 2 signatures, below threshold)
 * - Agent 5 (Paper Hands Pete): NO badge (never submitted)
 *
 * This allows testing:
 * - Badge display for verified agents
 * - "-" display for non-verified agents
 * - Conditional column visibility
 * - Tooltip showing different signature counts
 *
 * ================================================================================
 */
import axios from "axios";
import { randomUUID } from "crypto";
import * as dotenv from "dotenv";
import { inArray, like } from "drizzle-orm";
import * as path from "path";

import { competitions, users } from "@recallnet/db/schema/core/defs";
import {
  agentBadgeStatus,
  signatureSubmissions,
} from "@recallnet/db/schema/eigenai/defs";
import {
  InsertAgentBadgeStatus,
  InsertSignatureSubmission,
} from "@recallnet/db/schema/eigenai/types";
import {
  balances,
  portfolioSnapshots,
  spotLiveAgentSyncState,
  spotLiveAllowedTokens,
  spotLiveCompetitionChains,
  spotLiveCompetitionConfig,
  trades,
} from "@recallnet/db/schema/trading/defs";
import {
  InsertPortfolioSnapshot,
  InsertTrade,
} from "@recallnet/db/schema/trading/types";

import { db } from "@/database/db.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// ================================================================================
// CONFIGURATION - FILL IN YOUR ADMIN API KEY HERE
// ================================================================================
// ⚠️ IMPORTANT: This key should be from your LOCAL development environment only!
// Never commit a real API key to source control
const ADMIN_API_KEY = ""; // <-- FILL IN YOUR LOCAL ADMIN API KEY HERE
const API_BASE_URL = "http://localhost:3000"; // Local API only - DO NOT change to production URL

// EigenAI badge threshold (matches production config)
const BADGE_THRESHOLD = 10; // Signatures needed in 24h for active badge

// Colors for console output
const colors = {
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  reset: "\x1b[0m",
};

// Token addresses on Base
const BASE_TOKENS = {
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  WETH: "0x4200000000000000000000000000000000000006",
  cbETH: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
};

// ================================================================================
// Test data definitions
// ================================================================================
interface TestAgent {
  name: string;
  handle: string;
  email: string;
  userWalletAddress: string;
  agentWalletAddress: string;
  portfolio: {
    USDC: number;
    WETH: number;
  };
  tradeHistory: Array<{
    fromToken: "USDC" | "WETH";
    toToken: "USDC" | "WETH";
    fromAmount: number;
    toAmount: number;
    tradeAmountUsd: number;
    txHash: string;
    blockNumber: number;
    daysAgo: number;
  }>;
  startingValueUsd: number;
  currentValueUsd: number;
  // EigenAI verification config
  eigenai?: {
    signaturesCount: number; // Number of verified signatures to seed
    hasActiveBadge: boolean; // Whether badge should be active
  };
}

const ETH_PRICE_USD = 3500;

const TEST_TX_HASH =
  "0x0f8345ce2a18b4c017923d6800c18e665949444ce86491229f42f0b3f9758e04";

const testAgents: TestAgent[] = [
  {
    name: "DeFi Alpha Hunter",
    handle: "defi_alpha",
    email: "defi_alpha@test.com",
    userWalletAddress: "0xbbbb000000000000000000000000000000000001",
    agentWalletAddress: "0xaaaa111111111111111111111111111111111111",
    portfolio: {
      USDC: 2500,
      WETH: 3.5,
    },
    tradeHistory: [
      {
        fromToken: "USDC",
        toToken: "WETH",
        fromAmount: 10000,
        toAmount: 3.0,
        tradeAmountUsd: 10000,
        txHash: TEST_TX_HASH,
        blockNumber: 25000100,
        daysAgo: 5,
      },
      {
        fromToken: "USDC",
        toToken: "WETH",
        fromAmount: 2500,
        toAmount: 0.75,
        tradeAmountUsd: 2500,
        txHash: TEST_TX_HASH,
        blockNumber: 25100200,
        daysAgo: 3,
      },
      {
        fromToken: "WETH",
        toToken: "USDC",
        fromAmount: 0.25,
        toAmount: 900,
        tradeAmountUsd: 900,
        txHash: TEST_TX_HASH,
        blockNumber: 25200300,
        daysAgo: 1,
      },
    ],
    startingValueUsd: 15000,
    currentValueUsd: 14750,
    // EIGENAI: Active badge with 15 signatures
    eigenai: {
      signaturesCount: 15,
      hasActiveBadge: true,
    },
  },
  {
    name: "HODLer Bot",
    handle: "hodler_bot",
    email: "hodler_bot@test.com",
    userWalletAddress: "0xbbbb000000000000000000000000000000000002",
    agentWalletAddress: "0xaaaa222222222222222222222222222222222222",
    portfolio: {
      USDC: 500,
      WETH: 5.0,
    },
    tradeHistory: [
      {
        fromToken: "USDC",
        toToken: "WETH",
        fromAmount: 17000,
        toAmount: 5.0,
        tradeAmountUsd: 17000,
        txHash: TEST_TX_HASH,
        blockNumber: 25000500,
        daysAgo: 6,
      },
    ],
    startingValueUsd: 17500,
    currentValueUsd: 18000,
    // EIGENAI: Active badge with exactly threshold signatures
    eigenai: {
      signaturesCount: 10,
      hasActiveBadge: true,
    },
  },
  {
    name: "Swing Trader AI",
    handle: "swing_ai",
    email: "swing_ai@test.com",
    userWalletAddress: "0xbbbb000000000000000000000000000000000003",
    agentWalletAddress: "0xaaaa333333333333333333333333333333333333",
    portfolio: {
      USDC: 12000,
      WETH: 0.5,
    },
    tradeHistory: [
      {
        fromToken: "USDC",
        toToken: "WETH",
        fromAmount: 3500,
        toAmount: 1.0,
        tradeAmountUsd: 3500,
        txHash: TEST_TX_HASH,
        blockNumber: 25050000,
        daysAgo: 5,
      },
      {
        fromToken: "WETH",
        toToken: "USDC",
        fromAmount: 0.5,
        toAmount: 1800,
        tradeAmountUsd: 1800,
        txHash: TEST_TX_HASH,
        blockNumber: 25150000,
        daysAgo: 2,
      },
    ],
    startingValueUsd: 12000,
    currentValueUsd: 13750,
    // EIGENAI: No badge - never submitted
    eigenai: undefined,
  },
  {
    name: "FOMO Buyer",
    handle: "fomo_buyer",
    email: "fomo_buyer@test.com",
    userWalletAddress: "0xbbbb000000000000000000000000000000000004",
    agentWalletAddress: "0xaaaa444444444444444444444444444444444444",
    portfolio: {
      USDC: 100,
      WETH: 2.5,
    },
    tradeHistory: [
      {
        fromToken: "USDC",
        toToken: "WETH",
        fromAmount: 9900,
        toAmount: 2.5,
        tradeAmountUsd: 9900,
        txHash: TEST_TX_HASH,
        blockNumber: 25080000,
        daysAgo: 4,
      },
    ],
    startingValueUsd: 10000,
    currentValueUsd: 8850,
    // EIGENAI: Has submissions but below threshold - INACTIVE badge
    eigenai: {
      signaturesCount: 2,
      hasActiveBadge: false,
    },
  },
  {
    name: "Paper Hands Pete",
    handle: "paper_hands",
    email: "paper_hands@test.com",
    userWalletAddress: "0xbbbb000000000000000000000000000000000005",
    agentWalletAddress: "0xaaaa555555555555555555555555555555555555",
    portfolio: {
      USDC: 7500,
      WETH: 0.1,
    },
    tradeHistory: [
      {
        fromToken: "USDC",
        toToken: "WETH",
        fromAmount: 5000,
        toAmount: 1.5,
        tradeAmountUsd: 5000,
        txHash: TEST_TX_HASH,
        blockNumber: 25020000,
        daysAgo: 6,
      },
      {
        fromToken: "WETH",
        toToken: "USDC",
        fromAmount: 1.4,
        toAmount: 4500,
        tradeAmountUsd: 4500,
        txHash: TEST_TX_HASH,
        blockNumber: 25180000,
        daysAgo: 1,
      },
    ],
    startingValueUsd: 8000,
    currentValueUsd: 7850,
    // EIGENAI: No badge - never submitted
    eigenai: undefined,
  },
];

// ================================================================================
// Helper: Generate fake EigenAI signature submissions
// ================================================================================
function generateSignatureSubmissions(
  agentId: string,
  competitionId: string,
  count: number,
  now: Date,
): InsertSignatureSubmission[] {
  const submissions: InsertSignatureSubmission[] = [];

  for (let i = 0; i < count; i++) {
    // Spread submissions across the last 24 hours
    const hoursAgo = Math.random() * 20; // Random time in last 20 hours
    const submittedAt = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

    submissions.push({
      id: randomUUID(),
      agentId,
      competitionId,
      // Unique signature using UUIDs (65 bytes = 130 hex chars)
      // Uses randomUUID() for guaranteed uniqueness with the unique constraint
      signature:
        `0x${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}`.slice(
          0,
          132,
        ),
      chainId: "1", // Mainnet
      requestPrompt: `Test prompt ${i + 1}: What is the current market sentiment for ETH?`,
      responseModel: "gpt-oss-120b-f16",
      responseOutput: `Test response ${i + 1}: Based on current market indicators, ETH sentiment is bullish with strong support at $3,400.`,
      verificationStatus: "verified",
      submittedAt,
    });
  }

  return submissions;
}

// ================================================================================
// Main seed function
// ================================================================================
async function seedEigenaiCompetition(): Promise<void> {
  const uniqueSuffix = Date.now().toString(36).slice(-4);
  console.log(
    `${colors.cyan}========================================${colors.reset}`,
  );
  console.log(
    `${colors.cyan}  Seeding EigenAI Test Competition     ${colors.reset}`,
  );
  console.log(
    `${colors.cyan}========================================${colors.reset}\n`,
  );

  if (!ADMIN_API_KEY) {
    console.error(
      `${colors.red}ERROR: Please set the ADMIN_API_KEY variable in this script!${colors.reset}`,
    );
    console.error(
      `${colors.yellow}Edit the script and add your admin API key on line ~75.${colors.reset}`,
    );
    process.exit(1);
  }

  // Helper function for API requests
  async function apiRequest<T>(
    method: string,
    endpoint: string,
    data?: Record<string, unknown>,
  ): Promise<T> {
    try {
      const response = await axios({
        method,
        url: `${API_BASE_URL}${endpoint}`,
        headers: {
          Authorization: `Bearer ${ADMIN_API_KEY}`,
          "Content-Type": "application/json",
        },
        data,
      });
      return response.data as T;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(
          `API Error: ${error.response.status} - ${
            error.response.data?.error || error.response.statusText
          }`,
        );
      }
      throw error;
    }
  }

  try {
    // Step 0: Clean up any previous test data
    console.log(
      `${colors.blue}Step 0: Cleaning up previous test data...${colors.reset}`,
    );

    const testCompetitions = await db.query.competitions.findMany({
      where: like(competitions.name, "Test EigenAI Competition%"),
    });

    if (testCompetitions.length > 0) {
      const competitionIds = testCompetitions.map((c) => c.id);

      // Delete EigenAI data first
      await db
        .delete(signatureSubmissions)
        .where(inArray(signatureSubmissions.competitionId, competitionIds));
      await db
        .delete(agentBadgeStatus)
        .where(inArray(agentBadgeStatus.competitionId, competitionIds));

      // Delete spot live config
      await db
        .delete(spotLiveCompetitionConfig)
        .where(
          inArray(spotLiveCompetitionConfig.competitionId, competitionIds),
        );
      await db
        .delete(spotLiveCompetitionChains)
        .where(
          inArray(spotLiveCompetitionChains.competitionId, competitionIds),
        );
      await db
        .delete(spotLiveAllowedTokens)
        .where(inArray(spotLiveAllowedTokens.competitionId, competitionIds));
      await db
        .delete(spotLiveAgentSyncState)
        .where(inArray(spotLiveAgentSyncState.competitionId, competitionIds));
      await db
        .delete(trades)
        .where(inArray(trades.competitionId, competitionIds));
      await db
        .delete(balances)
        .where(inArray(balances.competitionId, competitionIds));
      await db
        .delete(portfolioSnapshots)
        .where(inArray(portfolioSnapshots.competitionId, competitionIds));
      await db
        .delete(competitions)
        .where(inArray(competitions.id, competitionIds));

      console.log(
        `${colors.yellow}  ✓ Deleted ${testCompetitions.length} test competitions and related data${colors.reset}`,
      );
    }

    // Clean up test users
    const testUserWallets = testAgents.map((a) =>
      a.userWalletAddress.toLowerCase(),
    );
    const deletedUsers = await db
      .delete(users)
      .where(inArray(users.walletAddress, testUserWallets))
      .returning({ id: users.id });

    if (deletedUsers.length > 0) {
      console.log(
        `${colors.yellow}  ✓ Deleted ${deletedUsers.length} test users and their agents${colors.reset}`,
      );
    }

    // Step 1: Create users and agents using admin API
    console.log(
      `\n${colors.blue}Step 1: Creating users and agents via admin API...${colors.reset}`,
    );

    const createdAgentIds: string[] = [];
    const agentIdToTestData = new Map<string, TestAgent>();

    for (const testAgent of testAgents) {
      interface UserRegistrationResponse {
        success: boolean;
        user?: { id: string; email: string; name: string };
        agent?: { id: string; name: string; handle: string };
        error?: string;
      }

      const response = await apiRequest<UserRegistrationResponse>(
        "POST",
        "/api/admin/users",
        {
          walletAddress: testAgent.userWalletAddress.toLowerCase(),
          name: testAgent.name
            .replace(" Agent", "")
            .replace(" Bot", "")
            .replace(" AI", ""),
          email: `${testAgent.handle}_${uniqueSuffix}@test.com`,
          agentName: testAgent.name,
          agentHandle: `${testAgent.handle.slice(0, 10)}_${uniqueSuffix}`.slice(
            0,
            15,
          ),
          agentWalletAddress: testAgent.agentWalletAddress.toLowerCase(),
        },
      );

      if (!response.success || !response.agent) {
        throw new Error(
          `Failed to create user/agent: ${response.error || "No agent returned"}`,
        );
      }

      const agentId = response.agent.id;
      createdAgentIds.push(agentId);
      agentIdToTestData.set(agentId, testAgent);

      const eigenaiStatus = testAgent.eigenai
        ? testAgent.eigenai.hasActiveBadge
          ? `✓ EigenAI ACTIVE (${testAgent.eigenai.signaturesCount} sigs)`
          : `○ EigenAI inactive (${testAgent.eigenai.signaturesCount} sigs)`
        : "✗ No EigenAI";

      console.log(
        `${colors.green}  ✓ Created: ${testAgent.name} - ${eigenaiStatus}${colors.reset}`,
      );
    }

    // Step 2: Create the spot live arena if it doesn't exist
    console.log(
      `\n${colors.blue}Step 2: Creating spot live arena...${colors.reset}`,
    );

    interface CreateArenaResponse {
      success: boolean;
      arena?: { id: string; name: string };
      error?: string;
    }

    try {
      const arenaResponse = await apiRequest<CreateArenaResponse>(
        "POST",
        "/api/admin/arenas",
        {
          id: "spot-live-trading",
          name: "Spot Live Trading Arena",
          createdBy: "system",
          category: "crypto_trading",
          skill: "spot_live_trading",
        },
      );

      if (arenaResponse.success) {
        console.log(`  ✓ Created arena: spot-live-trading`);
      } else {
        console.log(`  ℹ Arena may already exist: ${arenaResponse.error}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (
        errorMessage.includes("409") ||
        errorMessage.includes("already exists") ||
        errorMessage.includes("duplicate")
      ) {
        console.log(`  ℹ Arena already exists (skipping creation)`);
      } else {
        console.log(`  ✗ Arena creation failed: ${errorMessage}`);
        throw err;
      }
    }

    // Step 3: Create spot live competition via admin API
    console.log(
      `\n${colors.blue}Step 3: Creating spot live competition via admin API...${colors.reset}`,
    );

    const competitionName = `Test EigenAI Competition ${uniqueSuffix} ${Date.now()}`;
    const now = new Date();
    const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    interface CreateCompetitionResponse {
      success: boolean;
      competition: { id: string; name: string; type: string };
      error?: string;
    }

    const competitionResponse = await apiRequest<CreateCompetitionResponse>(
      "POST",
      "/api/admin/competition/create",
      {
        name: competitionName,
        description:
          "Test competition for EigenAI badge display with seeded verification data",
        type: "spot_live_trading",
        arenaId: "spot-live-trading",
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        spotLiveConfig: {
          dataSource: "rpc_direct",
          dataSourceConfig: {
            type: "rpc_direct",
            provider: "alchemy",
            chains: ["base"],
          },
          chains: ["base"],
          selfFundingThresholdUsd: 100,
          minFundingThreshold: 1000,
          syncIntervalMinutes: 2,
        },
      },
    );

    if (!competitionResponse.success) {
      throw new Error(
        `Failed to create competition: ${competitionResponse.error || "Unknown error"}`,
      );
    }

    const competitionId = competitionResponse.competition.id;
    console.log(
      `${colors.green}  ✓ Created competition: ${competitionName}${colors.reset}`,
    );
    console.log(`${colors.green}    ID: ${competitionId}${colors.reset}`);

    // Step 4: Start the competition with agents
    console.log(
      `\n${colors.blue}Step 4: Starting competition with agents via admin API...${colors.reset}`,
    );

    interface StartCompetitionResponse {
      success: boolean;
      error?: string;
    }

    const startResponse = await apiRequest<StartCompetitionResponse>(
      "POST",
      "/api/admin/competition/start",
      {
        competitionId,
        agentIds: createdAgentIds,
      },
    );

    if (!startResponse.success) {
      throw new Error(
        `Failed to start competition: ${startResponse.error || "Unknown error"}`,
      );
    }

    console.log(
      `${colors.green}  ✓ Competition started with ${createdAgentIds.length} agents${colors.reset}`,
    );

    // Step 5: Seed trades, balances, snapshots, AND EigenAI data
    console.log(
      `\n${colors.blue}Step 5: Seeding trades, balances, snapshots, and EigenAI data...${colors.reset}`,
    );

    await db.transaction(async () => {
      const allTrades: InsertTrade[] = [];
      const allSnapshots: InsertPortfolioSnapshot[] = [];
      const allSignatures: InsertSignatureSubmission[] = [];
      const allBadgeStatuses: InsertAgentBadgeStatus[] = [];

      for (const agentId of createdAgentIds) {
        const testData = agentIdToTestData.get(agentId)!;

        // Create trades
        for (const trade of testData.tradeHistory) {
          const tradeTimestamp = new Date(
            now.getTime() - trade.daysAgo * 24 * 60 * 60 * 1000,
          );

          const fromTokenAddress =
            trade.fromToken === "USDC" ? BASE_TOKENS.USDC : BASE_TOKENS.WETH;
          const toTokenAddress =
            trade.toToken === "USDC" ? BASE_TOKENS.USDC : BASE_TOKENS.WETH;
          const price =
            trade.fromToken === "USDC" ? ETH_PRICE_USD : 1 / ETH_PRICE_USD;

          allTrades.push({
            id: randomUUID(),
            agentId,
            competitionId,
            fromToken: fromTokenAddress,
            toToken: toTokenAddress,
            fromAmount: trade.fromAmount,
            toAmount: trade.toAmount,
            price,
            tradeAmountUsd: trade.tradeAmountUsd,
            fromTokenSymbol: trade.fromToken,
            toTokenSymbol: trade.toToken,
            success: true,
            reason: "Spot live trade detected from blockchain",
            timestamp: tradeTimestamp,
            fromChain: "evm",
            toChain: "evm",
            fromSpecificChain: "base",
            toSpecificChain: "base",
            tradeType: "spot_live",
            txHash: trade.txHash,
            blockNumber: trade.blockNumber,
            protocol: "Aerodrome",
            gasUsed: "150000",
            gasPrice: "1000000000",
            gasCostUsd: "0.50",
          });
        }

        // Create current balances
        await db
          .insert(balances)
          .values({
            agentId,
            competitionId,
            tokenAddress: BASE_TOKENS.USDC,
            amount: testData.portfolio.USDC,
            specificChain: "base",
            symbol: "USDC",
          })
          .onConflictDoNothing();

        await db
          .insert(balances)
          .values({
            agentId,
            competitionId,
            tokenAddress: BASE_TOKENS.WETH,
            amount: testData.portfolio.WETH,
            specificChain: "base",
            symbol: "WETH",
          })
          .onConflictDoNothing();

        // Create portfolio snapshots
        allSnapshots.push({
          agentId,
          competitionId,
          totalValue: testData.startingValueUsd,
          timestamp: startDate,
        });

        for (let dayOffset = 6; dayOffset >= 1; dayOffset--) {
          const snapshotTime = new Date(
            now.getTime() - dayOffset * 24 * 60 * 60 * 1000,
          );
          const progress = (7 - dayOffset) / 7;
          const baseValue =
            testData.startingValueUsd +
            (testData.currentValueUsd - testData.startingValueUsd) * progress;
          const noise = (Math.random() - 0.5) * 0.05 * baseValue;

          allSnapshots.push({
            agentId,
            competitionId,
            totalValue: Math.round(baseValue + noise),
            timestamp: snapshotTime,
          });
        }

        allSnapshots.push({
          agentId,
          competitionId,
          totalValue: testData.currentValueUsd,
          timestamp: now,
        });

        // Create sync state
        await db
          .insert(spotLiveAgentSyncState)
          .values({
            agentId,
            competitionId,
            specificChain: "base",
            lastScannedBlock: 25300000,
            lastScannedAt: now,
          })
          .onConflictDoNothing();

        // ===========================================
        // EIGENAI DATA SEEDING
        // ===========================================
        if (testData.eigenai) {
          // Generate signature submissions
          const signatures = generateSignatureSubmissions(
            agentId,
            competitionId,
            testData.eigenai.signaturesCount,
            now,
          );
          allSignatures.push(...signatures);

          // Get the most recent submission timestamp for lastVerifiedAt
          const latestSubmission = signatures.sort(
            (a, b) =>
              (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0),
          )[0];

          // Create badge status record
          allBadgeStatuses.push({
            id: randomUUID(),
            agentId,
            competitionId,
            isBadgeActive: testData.eigenai.hasActiveBadge,
            signaturesLast24h: testData.eigenai.signaturesCount,
            lastVerifiedAt: latestSubmission?.submittedAt ?? now,
            updatedAt: now,
          });
        }

        console.log(
          `${colors.green}  ✓ Seeded data for ${testData.name}${colors.reset}`,
        );
      }

      // Batch insert trades
      if (allTrades.length > 0) {
        await db.insert(trades).values(allTrades).onConflictDoNothing();
      }

      // Batch insert snapshots
      if (allSnapshots.length > 0) {
        allSnapshots.sort((a, b) => {
          const aTime = a.timestamp?.getTime() ?? 0;
          const bTime = b.timestamp?.getTime() ?? 0;
          return aTime - bTime;
        });
        for (const snapshot of allSnapshots) {
          await db.insert(portfolioSnapshots).values(snapshot);
        }
      }

      // Batch insert EigenAI signature submissions
      if (allSignatures.length > 0) {
        await db
          .insert(signatureSubmissions)
          .values(allSignatures)
          .onConflictDoNothing();
        console.log(
          `${colors.magenta}  ✓ Created ${allSignatures.length} EigenAI signature submissions${colors.reset}`,
        );
      }

      // Batch insert EigenAI badge statuses
      if (allBadgeStatuses.length > 0) {
        await db
          .insert(agentBadgeStatus)
          .values(allBadgeStatuses)
          .onConflictDoNothing();
        console.log(
          `${colors.magenta}  ✓ Created ${allBadgeStatuses.length} EigenAI badge status records${colors.reset}`,
        );
      }

      console.log(
        `${colors.green}  ✓ Created ${allTrades.length} total trades${colors.reset}`,
      );
      console.log(
        `${colors.green}  ✓ Created ${allSnapshots.length} portfolio snapshots${colors.reset}`,
      );
    });

    // Display results
    console.log(
      `\n${colors.cyan}========================================${colors.reset}`,
    );
    console.log(
      `${colors.cyan}  Seeding Complete!                    ${colors.reset}`,
    );
    console.log(
      `${colors.cyan}========================================${colors.reset}\n`,
    );

    console.log(`${colors.green}Competition Details:${colors.reset}`);
    console.log(`  ID: ${competitionId}`);
    console.log(`  Name: ${competitionName}`);
    console.log(`  Type: spot_live_trading`);
    console.log(`  Status: ACTIVE`);
    console.log(`  Agents: ${createdAgentIds.length}`);

    console.log(`\n${colors.magenta}EigenAI Badge Status:${colors.reset}`);
    console.log(`  Badge Threshold: ${BADGE_THRESHOLD} signatures in 24h`);
    console.log(
      `  Agents with ACTIVE badges: 2 (DeFi Alpha Hunter, HODLer Bot)`,
    );
    console.log(
      `  Agents with inactive badges: 1 (FOMO Buyer - below threshold)`,
    );
    console.log(
      `  Agents without badges: 2 (Swing Trader AI, Paper Hands Pete)`,
    );

    console.log(
      `\n${colors.green}Agent EigenAI Summary (sorted by badge status):${colors.reset}`,
    );

    const agentResults = createdAgentIds
      .map((agentId) => {
        const testData = agentIdToTestData.get(agentId)!;
        const roi =
          ((testData.currentValueUsd - testData.startingValueUsd) /
            testData.startingValueUsd) *
          100;
        return { agentId, testData, roi };
      })
      .sort((a, b) => {
        // Sort by: active badge first, then inactive badge, then no badge
        const aHasBadge = a.testData.eigenai?.hasActiveBadge
          ? 2
          : a.testData.eigenai
            ? 1
            : 0;
        const bHasBadge = b.testData.eigenai?.hasActiveBadge
          ? 2
          : b.testData.eigenai
            ? 1
            : 0;
        return bHasBadge - aHasBadge;
      });

    agentResults.forEach((result, index) => {
      const { testData, roi } = result;
      const roiColor = roi >= 0 ? colors.green : colors.red;
      const eigenaiDisplay = testData.eigenai
        ? testData.eigenai.hasActiveBadge
          ? `${colors.magenta}✓ ACTIVE (${testData.eigenai.signaturesCount} sigs)${colors.reset}`
          : `${colors.yellow}○ Inactive (${testData.eigenai.signaturesCount} sigs)${colors.reset}`
        : `${colors.red}✗ None${colors.reset}`;

      console.log(`  ${index + 1}. ${testData.name}`);
      console.log(`     EigenAI: ${eigenaiDisplay}`);
      console.log(
        `     ROI: ${roiColor}${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%${colors.reset}`,
      );
    });

    console.log(`\n${colors.green}Next Steps:${colors.reset}`);
    console.log(`  1. Navigate to the frontend at http://localhost:3001`);
    console.log(`  2. View the competition at /competitions/${competitionId}`);
    console.log(
      `  3. You should see the EigenAI column in the standings table`,
    );
    console.log(`  4. Agents with active badges will show the EigenAI logo`);
    console.log(`  5. Hover over badges to see signature count in tooltip`);
  } catch (error) {
    console.error(
      `${colors.red}Error seeding EigenAI competition:${colors.reset}`,
      error instanceof Error ? error.message : String(error),
    );

    if (error instanceof Error && error.stack) {
      console.error(`${colors.red}Stack trace:${colors.reset}`, error.stack);
    }

    process.exit(1);
  }
}

// Run the seed function
if (import.meta.url === `file://${process.argv[1]}`) {
  seedEigenaiCompetition()
    .then(() => {
      console.log(
        `${colors.green}Script completed successfully${colors.reset}`,
      );
      process.exit(0);
    })
    .catch((error) => {
      console.error(`${colors.red}Unhandled error:${colors.reset}`, error);
      process.exit(1);
    });
}
