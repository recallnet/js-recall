#!/usr/bin/env node
/**
 * ================================================================================
 * SPOT LIVE TRADING COMPETITION SEED SCRIPT - FRONTEND TESTING ONLY
 * ================================================================================
 *
 * PURPOSE:
 * This script is designed EXCLUSIVELY for local frontend development and testing.
 * It creates a complete test environment for spot live trading competitions with
 * realistic mock data simulating on-chain trading activity.
 *
 * ⚠️ WARNING: THIS SCRIPT IS FOR LOCAL DEVELOPMENT ONLY ⚠️
 * - DO NOT run this script in production environments
 * - DO NOT use this for actual trading competitions
 * - DO NOT run this against production databases
 *
 * WHAT THIS SCRIPT DOES:
 * 1. Creates test users and agents with predefined wallet addresses
 * 2. Sets up a spot live trading competition via admin API
 * 3. Seeds realistic on-chain trades with varied performance scenarios
 * 4. Generates historical portfolio snapshots for timeline visualization
 * 5. Creates token balances showing current holdings
 *
 * USE CASES:
 * - Testing spot live-specific UI components (trades table, balances display)
 * - Verifying conditional rendering logic (spot live vs paper trading vs perps)
 * - Testing portfolio timeline charts with historical data
 * - Validating ROI% ranking display
 * - Testing competition statistics display
 *
 * PREREQUISITES:
 * 1. Local API server running on http://localhost:3000
 * 2. Local database with proper schema (run migrations first)
 * 3. Valid admin API key (obtain from your local setup)
 * 4. Arena 'spot-live-trading' must exist in the database
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
  // Portfolio composition (token balances in human-readable amounts)
  portfolio: {
    USDC: number;
    WETH: number;
  };
  // Trading history - trades that led to current portfolio
  tradeHistory: Array<{
    fromToken: "USDC" | "WETH";
    toToken: "USDC" | "WETH";
    fromAmount: number;
    toAmount: number;
    tradeAmountUsd: number;
    txHash: string;
    blockNumber: number;
    daysAgo: number; // When the trade happened
  }>;
  // Starting portfolio value (for ROI calculation)
  startingValueUsd: number;
  // Current portfolio value
  currentValueUsd: number;
}

// ETH price assumption for calculations
const ETH_PRICE_USD = 3500;

const testAgents: TestAgent[] = [
  {
    name: "DeFi Alpha Hunter",
    handle: "defi_alpha",
    email: "defi_alpha@test.com",
    userWalletAddress: "0xbbbb000000000000000000000000000000000001",
    agentWalletAddress: "0xaaaa111111111111111111111111111111111111",
    portfolio: {
      USDC: 2500, // Kept some USDC
      WETH: 3.5, // Bought ETH that appreciated
    },
    tradeHistory: [
      {
        fromToken: "USDC",
        toToken: "WETH",
        fromAmount: 10000,
        toAmount: 3.0,
        tradeAmountUsd: 10000,
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        blockNumber: 25000100,
        daysAgo: 5,
      },
      {
        fromToken: "USDC",
        toToken: "WETH",
        fromAmount: 2500,
        toAmount: 0.75,
        tradeAmountUsd: 2500,
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111112",
        blockNumber: 25100200,
        daysAgo: 3,
      },
      {
        fromToken: "WETH",
        toToken: "USDC",
        fromAmount: 0.25,
        toAmount: 900,
        tradeAmountUsd: 900,
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111113",
        blockNumber: 25200300,
        daysAgo: 1,
      },
    ],
    startingValueUsd: 15000,
    currentValueUsd: 14750, // 2500 USDC + 3.5 ETH @ $3500 = $14,750
  },
  {
    name: "HODLer Bot",
    handle: "hodler_bot",
    email: "hodler_bot@test.com",
    userWalletAddress: "0xbbbb000000000000000000000000000000000002",
    agentWalletAddress: "0xaaaa222222222222222222222222222222222222",
    portfolio: {
      USDC: 500,
      WETH: 5.0, // Went heavy into ETH
    },
    tradeHistory: [
      {
        fromToken: "USDC",
        toToken: "WETH",
        fromAmount: 17000,
        toAmount: 5.0,
        tradeAmountUsd: 17000,
        txHash:
          "0x2222222222222222222222222222222222222222222222222222222222222221",
        blockNumber: 25000500,
        daysAgo: 6,
      },
    ],
    startingValueUsd: 17500,
    currentValueUsd: 18000, // 500 USDC + 5 ETH @ $3500 = $18,000
  },
  {
    name: "Swing Trader AI",
    handle: "swing_ai",
    email: "swing_ai@test.com",
    userWalletAddress: "0xbbbb000000000000000000000000000000000003",
    agentWalletAddress: "0xaaaa333333333333333333333333333333333333",
    portfolio: {
      USDC: 12000,
      WETH: 0.5, // Mostly in stables, small ETH position
    },
    tradeHistory: [
      {
        fromToken: "USDC",
        toToken: "WETH",
        fromAmount: 3500,
        toAmount: 1.0,
        tradeAmountUsd: 3500,
        txHash:
          "0x3333333333333333333333333333333333333333333333333333333333333331",
        blockNumber: 25050000,
        daysAgo: 5,
      },
      {
        fromToken: "WETH",
        toToken: "USDC",
        fromAmount: 0.5,
        toAmount: 1800,
        tradeAmountUsd: 1800,
        txHash:
          "0x3333333333333333333333333333333333333333333333333333333333333332",
        blockNumber: 25150000,
        daysAgo: 2,
      },
    ],
    startingValueUsd: 12000,
    currentValueUsd: 13750, // 12000 USDC + 0.5 ETH @ $3500 = $13,750
  },
  {
    name: "FOMO Buyer",
    handle: "fomo_buyer",
    email: "fomo_buyer@test.com",
    userWalletAddress: "0xbbbb000000000000000000000000000000000004",
    agentWalletAddress: "0xaaaa444444444444444444444444444444444444",
    portfolio: {
      USDC: 100,
      WETH: 2.5, // Bought high, now underwater
    },
    tradeHistory: [
      {
        fromToken: "USDC",
        toToken: "WETH",
        fromAmount: 9900,
        toAmount: 2.5, // Bought at ~$3960/ETH (bad timing)
        tradeAmountUsd: 9900,
        txHash:
          "0x4444444444444444444444444444444444444444444444444444444444444441",
        blockNumber: 25080000,
        daysAgo: 4,
      },
    ],
    startingValueUsd: 10000,
    currentValueUsd: 8850, // 100 USDC + 2.5 ETH @ $3500 = $8,850
  },
  {
    name: "Paper Hands Pete",
    handle: "paper_hands",
    email: "paper_hands@test.com",
    userWalletAddress: "0xbbbb000000000000000000000000000000000005",
    agentWalletAddress: "0xaaaa555555555555555555555555555555555555",
    portfolio: {
      USDC: 7500, // Sold ETH at loss
      WETH: 0.1,
    },
    tradeHistory: [
      {
        fromToken: "USDC",
        toToken: "WETH",
        fromAmount: 5000,
        toAmount: 1.5,
        tradeAmountUsd: 5000,
        txHash:
          "0x5555555555555555555555555555555555555555555555555555555555555551",
        blockNumber: 25020000,
        daysAgo: 6,
      },
      {
        fromToken: "WETH",
        toToken: "USDC",
        fromAmount: 1.4,
        toAmount: 4500, // Panic sold at loss
        tradeAmountUsd: 4500,
        txHash:
          "0x5555555555555555555555555555555555555555555555555555555555555552",
        blockNumber: 25180000,
        daysAgo: 1,
      },
    ],
    startingValueUsd: 8000,
    currentValueUsd: 7850, // 7500 USDC + 0.1 ETH @ $3500 = $7,850
  },
];

// ================================================================================
// Main seed function
// ================================================================================
async function seedSpotLiveCompetition(): Promise<void> {
  const uniqueSuffix = Date.now().toString(36).slice(-4);
  console.log(
    `${colors.cyan}========================================${colors.reset}`,
  );
  console.log(
    `${colors.cyan}  Seeding Spot Live Competition        ${colors.reset}`,
  );
  console.log(
    `${colors.cyan}========================================${colors.reset}\n`,
  );

  if (!ADMIN_API_KEY) {
    console.error(
      `${colors.red}ERROR: Please set the ADMIN_API_KEY variable in this script!${colors.reset}`,
    );
    console.error(
      `${colors.yellow}Edit the script and add your admin API key on line ~65.${colors.reset}`,
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
      where: like(competitions.name, "Test Spot Live Competition%"),
    });

    if (testCompetitions.length > 0) {
      const competitionIds = testCompetitions.map((c) => c.id);

      // Delete in correct order to avoid foreign key constraints
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
      `${colors.blue}Step 1: Creating users and agents via admin API...${colors.reset}`,
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

      console.log(
        `${colors.green}  ✓ Created user and agent: ${testAgent.name} (${agentId})${colors.reset}`,
      );
    }

    // Step 2: Create spot live competition using admin API
    console.log(
      `\n${colors.blue}Step 2: Creating spot live competition via admin API...${colors.reset}`,
    );

    const competitionName = `Test Spot Live Competition ${uniqueSuffix} ${Date.now()}`;
    const now = new Date();
    const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Started 7 days ago
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Ends in 7 days

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
          "Test competition for spot live trading with seeded on-chain data",
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
      `${colors.green}  ✓ Created competition: ${competitionName} (${competitionId})${colors.reset}`,
    );

    // Step 3: Start the competition with agents
    console.log(
      `\n${colors.blue}Step 3: Starting competition with agents via admin API...${colors.reset}`,
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

    // Step 4: Seed trades, balances, and snapshots directly in database
    console.log(
      `\n${colors.blue}Step 4: Seeding trades, balances, and portfolio snapshots...${colors.reset}`,
    );

    await db.transaction(async () => {
      const allTrades: InsertTrade[] = [];
      const allSnapshots: InsertPortfolioSnapshot[] = [];

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
        // USDC balance
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

        // WETH balance
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

        // Create portfolio snapshots (starting + daily + current)
        // Starting snapshot (7 days ago)
        allSnapshots.push({
          agentId,
          competitionId,
          totalValue: testData.startingValueUsd,
          timestamp: startDate,
        });

        // Daily snapshots with some variation
        for (let dayOffset = 6; dayOffset >= 1; dayOffset--) {
          const snapshotTime = new Date(
            now.getTime() - dayOffset * 24 * 60 * 60 * 1000,
          );

          // Linear interpolation with some noise
          const progress = (7 - dayOffset) / 7;
          const baseValue =
            testData.startingValueUsd +
            (testData.currentValueUsd - testData.startingValueUsd) * progress;
          const noise = (Math.random() - 0.5) * 0.05 * baseValue; // ±5% noise

          allSnapshots.push({
            agentId,
            competitionId,
            totalValue: Math.round(baseValue + noise),
            timestamp: snapshotTime,
          });
        }

        // Current snapshot
        allSnapshots.push({
          agentId,
          competitionId,
          totalValue: testData.currentValueUsd,
          timestamp: now,
        });

        // Create sync state (mark as synced up to current block)
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

        console.log(
          `${colors.green}  ✓ Seeded data for ${testData.name}: ${testData.tradeHistory.length} trades, $${testData.currentValueUsd.toLocaleString()} portfolio${colors.reset}`,
        );
      }

      // Batch insert trades
      if (allTrades.length > 0) {
        await db.insert(trades).values(allTrades).onConflictDoNothing();
      }

      // Batch insert snapshots
      if (allSnapshots.length > 0) {
        // Sort by timestamp
        allSnapshots.sort((a, b) => {
          const aTime = a.timestamp?.getTime() ?? 0;
          const bTime = b.timestamp?.getTime() ?? 0;
          return aTime - bTime;
        });

        for (const snapshot of allSnapshots) {
          await db.insert(portfolioSnapshots).values(snapshot);
        }
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
    console.log(`  Chain: Base`);

    console.log(
      `\n${colors.green}Created Agents (sorted by ROI):${colors.reset}`,
    );

    // Sort agents by ROI for display
    const agentResults = createdAgentIds
      .map((agentId) => {
        const testData = agentIdToTestData.get(agentId)!;
        const roi =
          ((testData.currentValueUsd - testData.startingValueUsd) /
            testData.startingValueUsd) *
          100;
        return { agentId, testData, roi };
      })
      .sort((a, b) => b.roi - a.roi);

    agentResults.forEach((result, index) => {
      const { agentId, testData, roi } = result;
      const roiColor = roi >= 0 ? colors.green : colors.red;
      console.log(`  ${index + 1}. ${testData.name} (${agentId})`);
      console.log(`     Handle: @${testData.handle}`);
      console.log(`     Wallet: ${testData.agentWalletAddress}`);
      console.log(
        `     Starting Value: $${testData.startingValueUsd.toLocaleString()}`,
      );
      console.log(
        `     Current Value: $${testData.currentValueUsd.toLocaleString()}`,
      );
      console.log(
        `     ROI: ${roiColor}${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%${colors.reset}`,
      );
      console.log(`     Trades: ${testData.tradeHistory.length}`);
    });

    console.log(`\n${colors.green}Next Steps:${colors.reset}`);
    console.log(`  1. Navigate to the frontend at http://localhost:3001`);
    console.log(`  2. View the competition at /competitions/${competitionId}`);
    console.log(
      `  3. Test the spot live-specific UI components and data display`,
    );

    console.log(
      `\n${colors.cyan}To view the seeded data via API:${colors.reset}`,
    );
    console.log(`  # Get competition leaderboard:`);
    console.log(
      `  curl ${API_BASE_URL}/api/competitions/${competitionId}/leaderboard`,
    );
    console.log(`\n  # Get competition trades:`);
    console.log(
      `  curl ${API_BASE_URL}/api/competitions/${competitionId}/trades`,
    );
  } catch (error) {
    console.error(
      `${colors.red}Error seeding spot live competition:${colors.reset}`,
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
  seedSpotLiveCompetition()
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
