/**
 * Isolated test for chain filtering in LiveTradeProcessor
 *
 * This test uses synthetic data instead of live blockchain data to ensure:
 * - Deterministic test results
 * - No dependency on real trade history
 * - Complete control over test scenarios
 */
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";

import { balances, trades } from "@recallnet/db-schema/trading/defs";

import { db } from "@/database/db.js";
import {
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
} from "@/e2e/utils/test-helpers.js";
import { ServiceRegistry } from "@/services/index.js";
import { LiveTradeProcessor } from "@/services/live-trade-processor.service.js";
import { SpecificChain } from "@/types/index.js";
import type { IndexedTrade } from "@/types/live-trading.js";

import { MockPriceTracker } from "./mocks/mock-price-tracker.js";

describe("LiveTradeProcessor Chain Filtering (Isolated)", () => {
  let liveTradeProcessor: LiveTradeProcessor;
  let services: ServiceRegistry;
  let adminApiKey: string;

  beforeAll(async () => {
    // Initialize services with MockPriceTracker
    services = new ServiceRegistry();
    const mockPriceTracker = new MockPriceTracker();

    liveTradeProcessor = new LiveTradeProcessor(
      mockPriceTracker,
      services.competitionManager,
      services.balanceManager,
    );

    adminApiKey = await getAdminApiKey();
  });

  test("should filter out trades from unsupported chains", async () => {
    console.log("🔍 Testing chain filtering with synthetic data...");

    // Create a test agent with a dummy wallet
    const testWallet = "0x" + "f".repeat(40); // Synthetic wallet address
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Chain Filter Test Agent",
      walletAddress: testWallet,
      agentWalletAddress: testWallet,
    });

    // Start a competition
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);
    const competitionResponse = await adminClient.startCompetition({
      agentIds: [agent.id],
      name: "Chain Filtering Test Competition",
      description: "Test competition for chain filtering",
    });

    // Type guard to ensure we have a successful response
    if (!("competition" in competitionResponse)) {
      throw new Error("Failed to start competition");
    }

    const competitionId = competitionResponse.competition.id;

    // Create SYNTHETIC test trades - no real blockchain data dependencies
    const syntheticTrades: IndexedTrade[] = [
      // Supported chain trades
      {
        id: "synthetic-1",
        sender: testWallet,
        recipient: "0x" + "a".repeat(40),
        chain: "ethereum",
        transactionHash: "0xtest1",
        blockNumber: "1000",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        tokenIn: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
        tokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
        amountIn: "100",
        amountOut: "100",
        gasUsed: "100000",
        gasPrice: "20000000000",
        protocol: "uniswap-v3",
      } as IndexedTrade,
      {
        id: "synthetic-2",
        sender: testWallet,
        recipient: "0x" + "b".repeat(40),
        chain: "polygon",
        transactionHash: "0xtest2",
        blockNumber: "1001",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        tokenIn: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC.e
        tokenOut: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // WETH
        amountIn: "200",
        amountOut: "200",
        gasUsed: "100000",
        gasPrice: "20000000000",
        protocol: "uniswap-v3",
      } as IndexedTrade,
      {
        id: "synthetic-3",
        sender: testWallet,
        recipient: "0x" + "c".repeat(40),
        chain: "arbitrum",
        transactionHash: "0xtest3",
        blockNumber: "1002",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        tokenIn: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", // USDC
        tokenOut: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
        amountIn: "300",
        amountOut: "300",
        gasUsed: "100000",
        gasPrice: "20000000000",
        protocol: "uniswap-v3",
      } as IndexedTrade,
      // Add a hypothetical unsupported chain trade (would be filtered)
      {
        id: "synthetic-4",
        sender: testWallet,
        recipient: "0x" + "d".repeat(40),
        chain: "avalanche", // NOT in supported chains list
        transactionHash: "0xtest4",
        blockNumber: "1003",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        tokenIn: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", // WAVAX
        tokenOut: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", // USDC
        amountIn: "400",
        amountOut: "400",
        gasUsed: "100000",
        gasPrice: "20000000000",
        protocol: "trader-joe",
      } as IndexedTrade,
    ];

    // Pre-fund the agent with balances for the synthetic trades
    // Only fund for the tokens that will be sold (tokenIn)
    console.log("💰 Creating synthetic balances for test agent...");

    const balancesToCreate = [
      {
        token: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        amount: 1000,
        chain: "eth",
      },
      {
        token: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        amount: 1000,
        chain: "polygon",
      },
      {
        token: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
        amount: 1000,
        chain: "arbitrum",
      },
      {
        token: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
        amount: 1000,
        chain: "avalanche",
      },
    ];

    for (const balance of balancesToCreate) {
      await db
        .insert(balances)
        .values({
          agentId: agent.id,
          tokenAddress: balance.token.toLowerCase(),
          amount: balance.amount,
          specificChain: balance.chain as SpecificChain,
          symbol: "TEST",
        })
        .onConflictDoUpdate({
          target: [balances.agentId, balances.tokenAddress],
          set: {
            amount: balance.amount,
            updatedAt: new Date(),
          },
        });
    }

    console.log("   ✅ Created synthetic balances");

    console.log(
      "\n🔄 Processing synthetic trades through LiveTradeProcessor...",
    );
    console.log(`   Input: ${syntheticTrades.length} synthetic trades`);
    console.log(`   - 3 from supported chains (ethereum, polygon, arbitrum)`);
    console.log(`   - 1 from unsupported chain (avalanche)`);

    const result = await liveTradeProcessor.processCompetitionTrades(
      competitionId,
      syntheticTrades,
    );

    console.log(`   Processed: ${result.trades.length} trades`);

    // Verify only supported chain trades were processed
    expect(result.trades.length).toBe(3); // Should process only the 3 supported chain trades

    const supportedChains = [
      "eth",
      "ethereum",
      "polygon",
      "arbitrum",
      "optimism",
      "base",
    ];

    // Verify all processed trades are from supported chains
    result.trades.forEach((trade) => {
      expect(supportedChains).toContain(trade.fromSpecificChain);
      if (trade.toSpecificChain) {
        expect(supportedChains).toContain(trade.toSpecificChain);
      }
    });

    // Verify the unsupported chain trade was filtered out
    const processedTradeIds = result.trades.map((t) => t.fromToken);
    expect(processedTradeIds).not.toContain(
      "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7",
    ); // WAVAX token from avalanche trade should be filtered

    console.log("   ✅ Chain filtering verified:");
    console.log("      - Processed 3 trades from supported chains");
    console.log(
      "      - Filtered out 1 trade from unsupported chain (avalanche)",
    );

    // Verify database doesn't have any unsupported chain trades
    const persistedTrades = await db
      .select()
      .from(trades)
      .where(eq(trades.competitionId, competitionId));

    console.log(
      `\n✅ Database check: ${persistedTrades.length} trades persisted`,
    );

    // Verify the count matches what was processed
    expect(persistedTrades.length).toBe(3); // Only the 3 supported chain trades

    // Verify no avalanche trades were persisted
    const persistedChains = new Set(
      persistedTrades.map((t) => t.fromSpecificChain),
    );
    expect(persistedChains).not.toContain("avalanche");

    console.log(
      "✅ Test complete: Chain filtering working correctly with synthetic data",
    );
  });
});
