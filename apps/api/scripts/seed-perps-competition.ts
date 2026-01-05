#!/usr/bin/env node
/**
 * ================================================================================
 * PERPETUAL FUTURES COMPETITION SEED SCRIPT - FRONTEND TESTING ONLY
 * ================================================================================
 *
 * PURPOSE:
 * This script is designed EXCLUSIVELY for local frontend development and testing.
 * It creates a complete test environment for perpetual futures (perps) trading
 * competitions with realistic mock data.
 * This script requires the API server to be running locally on http://localhost:3000.
 *
 * ⚠️ WARNING: THIS SCRIPT IS FOR LOCAL DEVELOPMENT ONLY ⚠️
 * - DO NOT run this script in production environments
 * - DO NOT use this for actual trading competitions
 * - DO NOT run this against production databases
 *
 * WHAT THIS SCRIPT DOES:
 * 1. Creates test users and agents with predefined wallet addresses
 * 2. Sets up a perpetual futures competition via admin API
 * 3. Seeds realistic perps positions with varied P&L scenarios
 * 4. Generates historical portfolio snapshots for timeline visualization
 *
 * USE CASES:
 * - Testing perps-specific UI components (PositionsTable, etc.)
 * - Verifying conditional rendering logic (perps vs paper trading)
 * - Testing portfolio timeline charts with historical data
 * - Validating P&L display formatting (positive/negative values)
 * - Testing competition statistics display (averageEquity, totalPositions)
 *
 * PREREQUISITES:
 * 1. Local API server running on http://localhost:3000
 * 2. Local database with proper schema
 * 3. Valid admin API key (obtain from your local setup)
 * 4. Frontend dev server for viewing results
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
  perpetualPositions,
  perpsAccountSummaries,
  perpsCompetitionConfig,
  portfolioSnapshots,
} from "@recallnet/db/schema/trading/defs";
import {
  InsertPerpetualPosition,
  InsertPerpsAccountSummary,
  InsertPerpsRiskMetrics,
  InsertPortfolioSnapshot,
} from "@recallnet/db/schema/trading/types";

import { db } from "@/database/db.js";
import { ServiceRegistry } from "@/services/index.js";

const services = new ServiceRegistry();

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// ================================================================================
// CONFIGURATION - FILL IN YOUR ADMIN API KEY HERE
// ================================================================================
// ⚠️ IMPORTANT: This key should be from your LOCAL development environment only!
// Never commit a real API key to source control
const ADMIN_API_KEY = "bdccee4a38c5d0f7_7240afd90c2024e6"; // <-- FILL IN YOUR LOCAL ADMIN API KEY HERE
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

// ================================================================================
// Test data definitions
// ================================================================================
interface TestPosition {
  asset: string;
  side: "long" | "short";
  size: number;
  /** Null for positions recovered from fills */
  entryPrice: number | null;
  currentPrice: number;
  /** Null for positions recovered from fills */
  leverage: number | null;
  /** Null for positions recovered from fills */
  margin: number | null;
  pnl: number;
  /** Position status - defaults to "Open" if not specified */
  status?: "Open" | "Closed" | "Liquidated";
  /** For closed positions, when it was closed */
  closedAt?: Date;
}

interface TestAgent {
  name: string;
  handle: string;
  email: string;
  userWalletAddress: string; // User's wallet for authentication
  agentWalletAddress: string; // Agent's wallet for trading
  positions: TestPosition[];
  accountSummary: {
    totalEquity: number;
    availableBalance: number;
    marginUsed: number;
    totalVolume: number;
    totalTrades: number;
    totalUnrealizedPnl: number;
    totalRealizedPnl: number;
  };
  // Risk metrics for Calmar Ratio testing
  riskMetrics: {
    simpleReturn: number; // Decimal (0.15 = 15%)
    maxDrawdown: number; // Negative decimal (-0.10 = -10%)
    calmarRatio: number; // Can be positive, negative, or zero
    hasRiskMetrics: boolean;
  };
}

const testAgents: TestAgent[] = [
  {
    name: "BTC Bull Agent",
    handle: "btc_bull",
    email: "btc_bull@test.com",
    userWalletAddress: "0xaaaa000000000000000000000000000000000001",
    agentWalletAddress: "0x1111111111111111111111111111111111111111",
    positions: [
      {
        asset: "BTC",
        side: "long",
        size: 0.5,
        entryPrice: 95000,
        currentPrice: 103743, // +9.2% gain
        leverage: 10,
        margin: 5000,
        pnl: 4371.5,
      },
      {
        asset: "ETH",
        side: "long",
        size: 5,
        entryPrice: 3450,
        currentPrice: 3521, // +2.06% gain
        leverage: 5,
        margin: 3500,
        pnl: 355,
      },
    ],
    accountSummary: {
      totalEquity: 12326.5,
      availableBalance: 3826.5,
      marginUsed: 8500,
      totalVolume: 45000,
      totalTrades: 15,
      totalUnrealizedPnl: 4726.5, // Strong positive
      totalRealizedPnl: -2400, // Some past losses
    },
    // Excellent risk-adjusted performance
    riskMetrics: {
      simpleReturn: 0.2326, // 23.26% return
      maxDrawdown: -0.045, // Only 4.5% drawdown
      calmarRatio: 5.17, // Excellent Calmar Ratio
      hasRiskMetrics: true,
    },
  },
  {
    name: "Bear Market Trader",
    handle: "bear_trader",
    email: "bear_trader@test.com",
    userWalletAddress: "0xaaaa000000000000000000000000000000000002",
    agentWalletAddress: "0x2222222222222222222222222222222222222222",
    positions: [
      {
        asset: "BTC",
        side: "short",
        size: 0.3,
        entryPrice: 106000,
        currentPrice: 103743, // -2.13% (winning short)
        leverage: 8,
        margin: 3825,
        pnl: 677.1,
      },
      {
        asset: "SOL",
        side: "short",
        size: 100,
        entryPrice: 215,
        currentPrice: 209.76, // -2.44% (winning short)
        leverage: 10,
        margin: 2200,
        pnl: 524,
      },
    ],
    accountSummary: {
      totalEquity: 9201.1,
      availableBalance: 3176.1,
      marginUsed: 6025,
      totalVolume: 52600,
      totalTrades: 8,
      totalUnrealizedPnl: 1201.1, // Net positive from shorts
      totalRealizedPnl: -799, // Past losses
    },
    // Good risk management with shorts
    riskMetrics: {
      simpleReturn: -0.08, // -8% return (started with 10k)
      maxDrawdown: -0.12, // 12% drawdown
      calmarRatio: -0.67, // Negative but manageable
      hasRiskMetrics: true,
    },
  },
  {
    name: "ETH Maximalist",
    handle: "eth_maxi",
    email: "eth_maxi@test.com",
    userWalletAddress: "0xaaaa000000000000000000000000000000000003",
    agentWalletAddress: "0x3333333333333333333333333333333333333333",
    positions: [
      {
        asset: "ETH",
        side: "long",
        size: 10,
        entryPrice: 3285,
        currentPrice: 3521, // +7.18% gain
        leverage: 15,
        margin: 2267,
        pnl: 2360,
      },
    ],
    accountSummary: {
      totalEquity: 9627,
      availableBalance: 7360,
      marginUsed: 2267,
      totalVolume: 34000,
      totalTrades: 5,
      totalUnrealizedPnl: 2360,
      totalRealizedPnl: -733, // Some past losses
    },
    // Moderate performance with low drawdown
    riskMetrics: {
      simpleReturn: -0.037, // -3.7% return
      maxDrawdown: -0.025, // Very small 2.5% drawdown
      calmarRatio: -1.48, // Negative due to losses but low drawdown
      hasRiskMetrics: true,
    },
  },
  {
    name: "Risk Manager",
    handle: "risk_mgr",
    email: "risk_mgr@test.com",
    userWalletAddress: "0xaaaa000000000000000000000000000000000004",
    agentWalletAddress: "0x4444444444444444444444444444444444444444",
    positions: [
      {
        asset: "BTC",
        side: "long",
        size: 0.1,
        entryPrice: 104200,
        currentPrice: 103743, // -0.44% loss
        leverage: 2,
        margin: 4900,
        pnl: -45.7,
      },
      {
        asset: "ETH",
        side: "long",
        size: 1,
        entryPrice: 3545,
        currentPrice: 3521, // -0.68% loss
        leverage: 2,
        margin: 1775,
        pnl: -24,
      },
    ],
    accountSummary: {
      totalEquity: 8430.3, // Small loss but stable
      availableBalance: 1755.3,
      marginUsed: 6675,
      totalVolume: 13350,
      totalTrades: 12,
      totalUnrealizedPnl: -69.7, // Small negative
      totalRealizedPnl: -500, // Conservative past performance
    },
    // Conservative with minimal losses
    riskMetrics: {
      simpleReturn: -0.157, // -15.7% return
      maxDrawdown: -0.18, // 18% drawdown
      calmarRatio: -0.87, // Poor but not terrible
      hasRiskMetrics: true,
    },
  },
  {
    name: "Degen Trader",
    handle: "degen",
    email: "degen@test.com",
    userWalletAddress: "0xaaaa000000000000000000000000000000000005",
    agentWalletAddress: "0x5555555555555555555555555555555555555555",
    positions: [
      {
        asset: "DOGE",
        side: "long",
        size: 50000,
        entryPrice: 0.42,
        currentPrice: 0.38, // -9.52% loss
        leverage: 50,
        margin: 420,
        pnl: -2000,
      },
      {
        asset: "SHIB",
        side: "long",
        size: 100000000, // 100M SHIB
        entryPrice: 0.0000285,
        currentPrice: 0.0000259, // -9.12% loss
        leverage: 100,
        margin: 285,
        pnl: -260,
      },
    ],
    accountSummary: {
      totalEquity: 2740, // Heavy losses
      availableBalance: 2035,
      marginUsed: 705,
      totalVolume: 39000,
      totalTrades: 25,
      totalUnrealizedPnl: -2260, // Big negative
      totalRealizedPnl: -3000, // Massive past losses
    },
    // Terrible performance, high risk
    riskMetrics: {
      simpleReturn: -0.726, // -72.6% return (catastrophic)
      maxDrawdown: -0.75, // 75% drawdown
      calmarRatio: -0.97, // Very poor Calmar
      hasRiskMetrics: true,
    },
  },
  {
    // Agent with closed positions recovered from fills - tests null field handling
    name: "Fill Recovery Agent",
    handle: "fill_recovery",
    email: "fill_recovery@test.com",
    userWalletAddress: "0xaaaa000000000000000000000000000000000006",
    agentWalletAddress: "0x6666666666666666666666666666666666666666",
    positions: [
      // Open position with full data (normal)
      {
        asset: "BTC",
        side: "long",
        size: 0.25,
        entryPrice: 102000,
        currentPrice: 103743,
        leverage: 5,
        margin: 5100,
        pnl: 435.75,
        status: "Open",
      },
      // Closed position recovered from fills - no leverage/margin/entryPrice available
      {
        asset: "ETH",
        side: "long",
        size: 3,
        entryPrice: null, // Not available from fills
        currentPrice: 3521,
        leverage: null, // Not available from fills
        margin: null, // Not available from fills
        pnl: 450, // Closed with profit
        status: "Closed",
        closedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      },
      // Another closed position recovered from fills
      {
        asset: "SOL",
        side: "short",
        size: 50,
        entryPrice: null, // Not available from fills
        currentPrice: 209.76,
        leverage: null, // Not available from fills
        margin: null, // Not available from fills
        pnl: -125, // Closed with loss
        status: "Closed",
        closedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      },
      // Closed position with full data (closed normally, not recovered)
      {
        asset: "DOGE",
        side: "long",
        size: 10000,
        entryPrice: 0.35,
        currentPrice: 0.38,
        leverage: 3,
        margin: 1167,
        pnl: 300, // Closed with profit
        status: "Closed",
        closedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      },
    ],
    accountSummary: {
      totalEquity: 7360.75,
      availableBalance: 2260.75,
      marginUsed: 5100, // Only the open BTC position uses margin
      totalVolume: 28000,
      totalTrades: 12,
      totalUnrealizedPnl: 435.75, // Only from open BTC position
      totalRealizedPnl: 625, // From closed positions (450 - 125 + 300)
    },
    riskMetrics: {
      simpleReturn: 0.106, // 10.6% return
      maxDrawdown: -0.08, // 8% drawdown
      calmarRatio: 1.33, // Good Calmar Ratio
      hasRiskMetrics: true,
    },
  },
];

// ================================================================================
// Main seed function
// ================================================================================
async function seedPerpsCompetition(): Promise<void> {
  // Generate unique suffix for this run to avoid conflicts
  const uniqueSuffix = Date.now().toString(36).slice(-4);
  console.log(
    `${colors.cyan}========================================${colors.reset}`,
  );
  console.log(
    `${colors.cyan}  Seeding Perps Competition Database   ${colors.reset}`,
  );
  console.log(
    `${colors.cyan}========================================${colors.reset}\n`,
  );

  // Check if admin API key is set
  if (!ADMIN_API_KEY) {
    console.error(
      `${colors.red}ERROR: Please set the ADMIN_API_KEY variable in this script!${colors.reset}`,
    );
    console.error(
      `${colors.yellow}Edit the script and add your admin API key on line 24.${colors.reset}`,
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

    // First, find test competitions to get their IDs
    const testCompetitions = await db.query.competitions.findMany({
      where: like(competitions.name, "Test Perps Competition%"),
    });

    if (testCompetitions.length > 0) {
      const competitionIds = testCompetitions.map((c) => c.id);

      // Delete in correct order to avoid foreign key constraints
      // 1. Delete perps config
      await db
        .delete(perpsCompetitionConfig)
        .where(inArray(perpsCompetitionConfig.competitionId, competitionIds));

      // 2. Delete positions
      await db
        .delete(perpetualPositions)
        .where(inArray(perpetualPositions.competitionId, competitionIds));

      // 3. Delete account summaries
      await db
        .delete(perpsAccountSummaries)
        .where(inArray(perpsAccountSummaries.competitionId, competitionIds));

      // 4. Delete portfolio snapshots
      await db
        .delete(portfolioSnapshots)
        .where(inArray(portfolioSnapshots.competitionId, competitionIds));

      // 5. Now we can safely delete competitions
      await db
        .delete(competitions)
        .where(inArray(competitions.id, competitionIds));

      console.log(
        `${colors.yellow}  ✓ Deleted ${testCompetitions.length} test competitions and all related data${colors.reset}`,
      );
    }

    // Define test wallet addresses to clean up
    const testUserWallets = [
      "0xaaaa000000000000000000000000000000000001",
      "0xaaaa000000000000000000000000000000000002",
      "0xaaaa000000000000000000000000000000000003",
      "0xaaaa000000000000000000000000000000000004",
      "0xaaaa000000000000000000000000000000000005",
      "0xaaaa000000000000000000000000000000000006", // Fill Recovery Agent
    ];

    // Now delete test users (this will cascade delete their agents)
    // Note: wallet addresses are stored in lowercase in the database
    const deletedUsers = await db
      .delete(users)
      .where(
        inArray(
          users.walletAddress,
          testUserWallets.map((w) => w.toLowerCase()),
        ),
      )
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
    const agentIdToWalletMap = new Map<string, string>();

    for (const testAgent of testAgents) {
      // Create user with agent in one call
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
          walletAddress: testAgent.userWalletAddress.toLowerCase(), // User's wallet for auth
          name: testAgent.name.replace(" Agent", ""),
          email: `${testAgent.handle}_${uniqueSuffix}@test.com`, // Unique email
          agentName: testAgent.name,
          agentHandle: `${testAgent.handle.slice(0, 10)}_${uniqueSuffix}`.slice(
            0,
            15,
          ), // Unique handle (max 15 chars)
          agentWalletAddress: testAgent.agentWalletAddress.toLowerCase(), // Agent's wallet for trading
        },
      );

      if (!response.success || !response.agent) {
        throw new Error(
          `Failed to create user/agent: ${response.error || "No agent returned"}`,
        );
      }

      const agentId = response.agent.id;
      createdAgentIds.push(agentId);
      agentIdToWalletMap.set(agentId, testAgent.agentWalletAddress);

      console.log(
        `${colors.green}  ✓ Created user and agent: ${testAgent.name} (${agentId})${colors.reset}`,
      );
    }

    // Step 2: Create or get perps arena
    console.log(
      `\n${colors.blue}Step 2: Creating/getting perps arena...${colors.reset}`,
    );

    interface ArenaResponse {
      success: boolean;
      arena?: { id: string; name: string };
      error?: string;
    }

    // Try to create perps arena (will fail if it already exists - that's OK)
    const perpsArenaId = "perpetual-futures-trading";
    try {
      const arenaResponse = await apiRequest<ArenaResponse>(
        "POST",
        "/api/admin/arenas",
        {
          id: perpsArenaId,
          name: "Perpetual Futures Trading Arena",
          category: "crypto_trading",
          skill: "perpetual_futures_trading",
          kind: "Competition",
          createdBy: "seed-script",
        },
      );
      if (arenaResponse.success && arenaResponse.arena) {
        console.log(
          `${colors.green}  ✓ Created perps arena: ${arenaResponse.arena.name}${colors.reset}`,
        );
      }
    } catch (error) {
      // Arena might already exist (409 conflict), which is fine
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes("409") || errorMsg.includes("already exists")) {
        console.log(
          `${colors.yellow}  ✓ Using existing perps arena: ${perpsArenaId}${colors.reset}`,
        );
      } else {
        // Some other error - rethrow
        throw error;
      }
    }

    // Step 3: Create perps competition using admin API
    console.log(
      `\n${colors.blue}Step 3: Creating perps competition via admin API...${colors.reset}`,
    );

    const competitionName = `Test Perps Competition ${uniqueSuffix} ${Date.now()}`;
    const now = new Date();
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

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
          "Test competition for perpetual futures trading with seeded data",
        type: "perpetual_futures",
        arenaId: perpsArenaId,
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        perpsProvider: {
          provider: "symphony",
          initialCapital: 500,
          selfFundingThreshold: 0,
          apiUrl: "http://localhost:3456",
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

    // Step 3: Start the competition with agents using admin API
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
      `${colors.green}  ✓ Competition started successfully with ${createdAgentIds.length} agents${colors.reset}`,
    );

    // Step 4: Seed perps positions and account summaries directly in database
    console.log(
      `\n${colors.blue}Step 4: Seeding perps positions and account summaries (database layer)...${colors.reset}`,
    );

    // Use transaction for consistency
    await db.transaction(async () => {
      const portfolioSnapshots: InsertPortfolioSnapshot[] = [];

      for (let i = 0; i < createdAgentIds.length; i++) {
        const agentId = createdAgentIds[i]!;
        const testData = testAgents[i]!;

        // Create account summary
        const accountSummary: InsertPerpsAccountSummary = {
          id: randomUUID(),
          agentId,
          competitionId,
          totalEquity: testData.accountSummary.totalEquity.toString(),
          availableBalance: testData.accountSummary.availableBalance.toString(),
          marginUsed: testData.accountSummary.marginUsed.toString(),
          totalVolume: testData.accountSummary.totalVolume.toString(),
          totalTrades: testData.accountSummary.totalTrades,
          totalUnrealizedPnl:
            testData.accountSummary.totalUnrealizedPnl.toString(),
          totalRealizedPnl: testData.accountSummary.totalRealizedPnl.toString(),
          openPositionsCount: testData.positions.filter(
            (p) => p.status === undefined || p.status === "Open",
          ).length,
          timestamp: now,
        };

        await services.perpsRepository.createPerpsAccountSummary(
          accountSummary,
        );
        console.log(
          `${colors.green}  ✓ Created account summary for ${testData.name}${colors.reset}`,
        );

        // Create positions
        const positions: InsertPerpetualPosition[] = testData.positions.map(
          (pos, index) => {
            // Calculate PnL percentage - handle null margin for recovered positions
            let pnlPercentage: string | null = null;
            if (pos.margin !== null && pos.margin > 0) {
              pnlPercentage = ((pos.pnl / pos.margin) * 100).toString();
            }

            return {
              id: randomUUID(),
              agentId,
              competitionId,
              providerPositionId: `${testData.agentWalletAddress}_${pos.asset}_${index}`,
              asset: pos.asset,
              isLong: pos.side === "long",
              // These fields are null for positions recovered from fills
              leverage: pos.leverage !== null ? pos.leverage.toString() : null,
              positionSize: pos.size.toString(),
              collateralAmount:
                pos.margin !== null ? pos.margin.toString() : null,
              entryPrice:
                pos.entryPrice !== null ? pos.entryPrice.toString() : null,
              currentPrice: pos.currentPrice.toString(),
              pnlUsdValue: pos.pnl.toString(),
              pnlPercentage,
              status: pos.status ?? "Open",
              closedAt: pos.closedAt ?? null,
              createdAt: now,
              capturedAt: now,
            };
          },
        );

        if (positions.length > 0) {
          await services.perpsRepository.batchUpsertPerpsPositions(positions);
          console.log(
            `${colors.green}  ✓ Created ${positions.length} positions for ${testData.name}${colors.reset}`,
          );
        }

        // Add portfolio snapshot (ID is auto-generated)
        portfolioSnapshots.push({
          agentId,
          competitionId,
          totalValue: testData.accountSummary.totalEquity,
          timestamp: now,
        });
      }

      // Create initial portfolio snapshots
      await services.competitionRepository.batchCreatePortfolioSnapshots(
        portfolioSnapshots,
      );
      console.log(
        `${colors.green}  ✓ Created initial portfolio snapshots${colors.reset}`,
      );

      // Create additional portfolio snapshots over time to show progression
      const additionalSnapshots: InsertPortfolioSnapshot[] = [];

      // Create snapshots for the past 7 days
      for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
        const snapshotTime = new Date(
          now.getTime() - dayOffset * 24 * 60 * 60 * 1000,
        );

        for (let i = 0; i < createdAgentIds.length; i++) {
          const agentId = createdAgentIds[i]!;
          const testData = testAgents[i]!;

          // Simulate portfolio value changes over time
          // Start with lower values and grow/shrink towards current
          const baseValue = testData.accountSummary.totalEquity;
          const variationPercent = (7 - dayOffset) * 0.05; // 5% change per day
          const randomFactor = 0.8 + Math.random() * 0.4; // Random factor between 0.8 and 1.2

          // Calculate historical value with some randomness
          let historicalValue =
            baseValue * (1 - variationPercent) * randomFactor;

          // For agents with negative PnL, show they started higher
          if (testData.accountSummary.totalUnrealizedPnl < 0) {
            historicalValue = baseValue * (1 + variationPercent * 0.5);
          }

          additionalSnapshots.push({
            agentId,
            competitionId,
            totalValue: Math.round(historicalValue),
            timestamp: snapshotTime,
          });
        }
      }

      // Create hourly snapshots for today to show intraday movement
      for (let hourOffset = 1; hourOffset <= 12; hourOffset++) {
        const snapshotTime = new Date(
          now.getTime() - hourOffset * 60 * 60 * 1000,
        );

        for (let i = 0; i < createdAgentIds.length; i++) {
          const agentId = createdAgentIds[i]!;
          const testData = testAgents[i]!;

          // Small variations for intraday
          const baseValue = testData.accountSummary.totalEquity;
          const hourlyVariation = (Math.random() - 0.5) * 0.02; // ±2% variation
          const intraDayValue = baseValue * (1 + hourlyVariation);

          additionalSnapshots.push({
            agentId,
            competitionId,
            totalValue: Math.round(intraDayValue),
            timestamp: snapshotTime,
          });
        }
      }

      // Sort by timestamp (oldest first) and create
      additionalSnapshots.sort((a, b) => {
        const aTime = a.timestamp?.getTime() ?? 0;
        const bTime = b.timestamp?.getTime() ?? 0;
        return aTime - bTime;
      });
      await services.competitionRepository.batchCreatePortfolioSnapshots(
        additionalSnapshots,
      );

      console.log(
        `${colors.green}  ✓ Created ${additionalSnapshots.length} historical portfolio snapshots (7 days + 12 hours)${colors.reset}`,
      );
    });

    // Step 5: Seed risk metrics (Calmar Ratio, Simple Return, Max Drawdown)
    console.log(
      `\n${colors.blue}Step 5: Seeding risk metrics for Calmar Ratio testing...${colors.reset}`,
    );

    for (let i = 0; i < createdAgentIds.length; i++) {
      const agentId = createdAgentIds[i]!;
      const testData = testAgents[i]!;

      // Only seed if agent has risk metrics defined
      if (testData.riskMetrics.hasRiskMetrics) {
        const riskMetrics: InsertPerpsRiskMetrics = {
          agentId,
          competitionId,
          simpleReturn: testData.riskMetrics.simpleReturn.toFixed(8),
          maxDrawdown: testData.riskMetrics.maxDrawdown.toFixed(8),
          calmarRatio: testData.riskMetrics.calmarRatio.toFixed(8),
          annualizedReturn: (testData.riskMetrics.simpleReturn * 52).toFixed(8), // Rough annualization for 1 week
          snapshotCount: 2, // We're using simple first/last snapshots
          calculationTimestamp: now,
        };

        await services.perpsRepository.saveRiskMetrics(riskMetrics);
        console.log(
          `${colors.green}  ✓ Created risk metrics for ${testData.name}: Calmar=${testData.riskMetrics.calmarRatio.toFixed(2)}${colors.reset}`,
        );
      }
    }

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
    console.log(`  Type: perpetual_futures`);
    console.log(`  Status: ACTIVE`);
    console.log(`  Agents: ${createdAgentIds.length}`);

    console.log(`\n${colors.green}Created Agents:${colors.reset}`);
    for (let i = 0; i < createdAgentIds.length; i++) {
      const agentId = createdAgentIds[i]!;
      const testData = testAgents[i]!;
      console.log(`  ${i + 1}. ${testData.name} (${agentId})`);
      console.log(`     Handle: @${testData.handle}`);
      console.log(`     User Wallet: ${testData.userWalletAddress}`);
      console.log(`     Agent Wallet: ${testData.agentWalletAddress}`);
      console.log(`     Positions: ${testData.positions.length}`);
      console.log(
        `     Total Equity: $${testData.accountSummary.totalEquity.toLocaleString()}`,
      );
      console.log(
        `     Unrealized PnL: $${testData.accountSummary.totalUnrealizedPnl.toLocaleString()}`,
      );
      if (testData.riskMetrics.hasRiskMetrics) {
        console.log(
          `     Calmar Ratio: ${testData.riskMetrics.calmarRatio.toFixed(2)}`,
        );
        console.log(
          `     Simple Return: ${(testData.riskMetrics.simpleReturn * 100).toFixed(2)}%`,
        );
        console.log(
          `     Max Drawdown: ${(Math.abs(testData.riskMetrics.maxDrawdown) * 100).toFixed(2)}%`,
        );
      }
    }

    console.log(`\n${colors.green}Next Steps:${colors.reset}`);
    console.log(`  1. Navigate to the frontend at http://localhost:3001`);
    console.log(`  2. View the competition at /competitions/${competitionId}`);
    console.log(`  3. Test the perps-specific UI components and data display`);

    console.log(
      `\n${colors.cyan}To view the seeded data via API:${colors.reset}`,
    );
    console.log(`  # Get all positions for the competition:`);
    console.log(
      `  curl ${API_BASE_URL}/api/competitions/${competitionId}/perps/all-positions`,
    );
    console.log(`\n  # Get competition summary:`);
    console.log(
      `  curl ${API_BASE_URL}/api/competitions/${competitionId}/perps/summary`,
    );
  } catch (error) {
    console.error(
      `${colors.red}Error seeding perps competition:${colors.reset}`,
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
  seedPerpsCompetition()
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
