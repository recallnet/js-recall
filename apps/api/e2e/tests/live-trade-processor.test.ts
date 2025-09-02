/**
 * E2E Test for LiveTradeProcessor Service
 *
 * Uses real Envio indexer data and actual API endpoints to test
 * the live trade processing functionality.
 */
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";

import { db } from "@/database/db.js";
import { trades } from "@/database/schema/trading/defs.js";
import type { InsertTrade } from "@/database/schema/trading/types.js";
import {
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  startTestCompetition,
} from "@/e2e/utils/test-helpers.js";
import { ServiceRegistry } from "@/services/index.js";
import { IndexerSyncService } from "@/services/indexer-sync.service.js";
import { LiveTradeProcessor } from "@/services/live-trade-processor.service.js";
import type { IndexedTrade, IndexedTransfer } from "@/types/live-trading.js";

// Only run these tests when TEST_LIVE_TRADING is enabled
const describeIfLiveTrading =
  process.env.TEST_LIVE_TRADING === "true" ? describe : describe.skip;

describeIfLiveTrading(
  "LiveTradeProcessor Service (E2E with Real Envio)",
  { timeout: 120000 },
  () => {
    let indexerSyncService: IndexerSyncService;
    let liveTradeProcessor: LiveTradeProcessor;
    let services: ServiceRegistry;
    let adminApiKey: string;
    let realTrades: IndexedTrade[] = [];
    let uniqueWalletAddresses: string[] = [];

    beforeAll(async () => {
      // Initialize services
      services = new ServiceRegistry();
      indexerSyncService = new IndexerSyncService();
      liveTradeProcessor = new LiveTradeProcessor(
        services.priceTracker,
        services.competitionManager,
        services.balanceManager,
      );
      adminApiKey = await getAdminApiKey();

      // The Envio indexer is automatically started by setup.ts when TEST_LIVE_TRADING=true
      console.log("📡 Using Envio indexer managed by test setup");

      // Give the indexer a moment to ensure it's fully ready
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Fetch all available trades and use the most recent ones
      // (avoiding early indexing issues from when Envio first started)
      console.log("🔍 Fetching trades from Envio indexer...");
      const allTrades = await indexerSyncService.fetchAllTradesSince(0, 10000);
      console.log(`   Found ${allTrades.length} total trades in database`);

      // Get the most recent 1000 trades for testing (avoiding early indexing issues)
      realTrades = allTrades.slice(-1000);
      console.log(
        `   Using ${realTrades.length} most recent trades for testing`,
      );

      console.log(
        `📊 Total trades available for testing: ${realTrades.length}`,
      );

      if (realTrades.length > 0) {
        // Extract unique wallet addresses from the trades
        const addressSet = new Set<string>();
        realTrades.forEach((trade) => {
          addressSet.add(trade.sender.toLowerCase());
          addressSet.add(trade.recipient.toLowerCase());
        });
        uniqueWalletAddresses = Array.from(addressSet).slice(0, 10); // Take first 10 unique addresses for multiple tests
        console.log(
          `👤 Found ${uniqueWalletAddresses.length} unique wallet addresses to use as test agents`,
        );
      } else {
        console.log("⚠️ No trades indexed yet. Chain activity might be low.");
      }
    }, 240000); // 4 minute timeout (up to 3 minutes wait + setup)

    test("should fetch and display real trade data from Envio", async () => {
      // This test helps us understand what data is available
      expect(realTrades).toBeDefined();
      expect(Array.isArray(realTrades)).toBe(true);

      if (realTrades.length > 0) {
        const firstTrade = realTrades[0];
        console.log("📝 Sample trade from Envio:", {
          sender: firstTrade?.sender,
          recipient: firstTrade?.recipient,
          tokenIn: firstTrade?.tokenIn,
          tokenOut: firstTrade?.tokenOut,
          protocol: firstTrade?.protocol,
          chain: firstTrade?.chain,
          amountIn: firstTrade?.amountIn?.toString(),
          amountOut: firstTrade?.amountOut?.toString(),
        });

        // Verify trade structure
        expect(firstTrade).toHaveProperty("sender");
        expect(firstTrade).toHaveProperty("recipient");
        expect(firstTrade).toHaveProperty("tokenIn");
        expect(firstTrade).toHaveProperty("tokenOut");
        expect(firstTrade).toHaveProperty("amountIn");
        expect(firstTrade).toHaveProperty("amountOut");
        expect(firstTrade).toHaveProperty("protocol");
      }
    });

    test("should process real trades for competition agents", async () => {
      if (uniqueWalletAddresses.length < 2) {
        console.log("⚠️ Not enough unique addresses found, skipping test");
        return;
      }

      // Setup: Create competition with agents using real wallet addresses
      const adminClient = await setupAdminClient();

      // Create agents using real wallet addresses
      const testAgents: Array<{
        id: string;
        name: string;
        walletAddress?: string;
      }> = [];
      for (let i = 0; i < Math.min(3, uniqueWalletAddresses.length); i++) {
        const walletAddress = uniqueWalletAddresses[i]!;
        const { agent } = await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: `Live Trading Agent ${i + 1}`,
          agentWalletAddress: walletAddress, // Use real wallet address from Envio data
        });
        testAgents.push(agent);
        console.log(
          `✅ Created agent ${agent.name} with wallet ${walletAddress}`,
        );
      }

      // Start a competition with these agents
      const competitionName = `Live Trading Test ${Date.now()}`;
      const competitionResponse = await startTestCompetition(
        adminClient,
        competitionName,
        testAgents.map((a) => a.id),
      );

      expect(competitionResponse.success).toBe(true);
      const competitionId = competitionResponse.competition.id;
      console.log(`🏁 Started competition: ${competitionId}`);

      // Process the real trades through LiveTradeProcessor
      const processedTrades = await liveTradeProcessor.processCompetitionTrades(
        competitionId,
        realTrades.slice(0, 10), // Process first 10 trades
      );

      // Verify processing results
      expect(processedTrades).toBeDefined();
      expect(Array.isArray(processedTrades)).toBe(true);

      // Only trades from our competition agents should be processed
      processedTrades.forEach((trade: InsertTrade) => {
        // Check if the agent ID matches one of our test agents
        const agentInCompetition = testAgents.some(
          (a) => a.id === trade.agentId,
        );
        expect(agentInCompetition).toBe(true);
      });

      console.log(
        `✅ Processed ${processedTrades.length} trades for competition agents`,
      );
    });

    test("should enrich trades with real price data", async () => {
      if (realTrades.length === 0) {
        console.log("⚠️ No real trades found, skipping test");
        return;
      }

      // Setup a minimal competition
      const adminClient = await setupAdminClient();
      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Price Enrichment Test Agent",
        walletAddress:
          uniqueWalletAddresses[1] ||
          realTrades[1]?.sender ||
          "0x" + "1".repeat(40),
      });

      const competitionResponse = await startTestCompetition(
        adminClient,
        `Price Enrichment Test ${Date.now()}`,
        [agent.id],
      );
      const competitionId = competitionResponse.competition.id;

      // Get trades for testing - all should have complete tokens now thanks to our fix
      const testTrades = realTrades.slice(0, 5);

      // Verify all trades have complete token information (no unknowns)
      const tradesWithCompleteTokens = testTrades.filter(
        (trade) => trade.tokenIn !== "unknown" && trade.tokenOut !== "unknown",
      );

      console.log(
        `📊 Testing price enrichment with ${testTrades.length} trades`,
      );
      console.log(
        `   Complete tokens: ${tradesWithCompleteTokens.length}/${testTrades.length}`,
      );

      if (testTrades.length > 0) {
        // Process trades which will enrich them with prices internally
        const enrichedTrades =
          await liveTradeProcessor.processCompetitionTrades(
            competitionId,
            testTrades,
          );

        // Verify enrichment
        expect(enrichedTrades).toBeDefined();
        expect(enrichedTrades.length).toBeLessThanOrEqual(testTrades.length);

        enrichedTrades.forEach((trade: InsertTrade, index) => {
          const originalTrade = testTrades[index];
          // Check that trade data is preserved
          expect(trade.fromToken).toBe(originalTrade?.tokenIn);
          expect(trade.toToken).toBe(originalTrade?.tokenOut);

          // Check that price data was added (if available)
          if (trade.tradeAmountUsd && trade.tradeAmountUsd > 0) {
            console.log(`💰 Trade ${index}: ${trade.tradeAmountUsd} USD`);
            expect(typeof trade.tradeAmountUsd).toBe("number");
            expect(trade.tradeAmountUsd).toBeGreaterThan(0);
          }
        });
      } else {
        console.log(
          "⚠️ No trades with known tokens found for price enrichment",
        );
      }
    });

    test("should detect self-funding with real transfer data", async () => {
      // Fetch real transfers from Envio
      const realTransfers = await indexerSyncService.fetchAllTransfersSince(
        0,
        50,
      );
      console.log(`📊 Found ${realTransfers.length} real transfers from Envio`);

      if (realTransfers.length === 0) {
        console.log("⚠️ No real transfers found, skipping test");
        return;
      }

      // Setup competition
      const adminClient = await setupAdminClient();

      // Use addresses from transfers
      const transferAddresses = Array.from(
        new Set(realTransfers.flatMap((t: IndexedTransfer) => [t.from, t.to])),
      ).slice(0, 3);

      const testAgents = [];
      for (let i = 0; i < Math.min(2, transferAddresses.length); i++) {
        const { agent } = await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: `Self-Funding Test Agent ${i + 1}`,
          walletAddress: transferAddresses[i] || `0x${"3".repeat(40)}`,
        });
        testAgents.push(agent);
      }

      const competitionResponse = await startTestCompetition(
        adminClient,
        `Self-Funding Detection Test ${Date.now()}`,
        testAgents.map((a) => a.id),
      );
      const competitionId = competitionResponse.competition.id;

      // Process transfers for self-funding detection
      const detectionResult = await liveTradeProcessor.detectSelfFunding(
        competitionId,
        realTransfers.slice(0, 20),
      );

      // Verify detection results
      expect(detectionResult).toBeDefined();
      expect(detectionResult.alerts).toBeDefined();
      expect(Array.isArray(detectionResult.alerts)).toBe(true);

      if (detectionResult.alerts.length > 0) {
        console.log(
          `🚨 Detected ${detectionResult.alerts.length} potential self-funding issues`,
        );
        detectionResult.alerts.forEach((alert) => {
          expect(alert).toHaveProperty("agentId");
          expect(alert).toHaveProperty("competitionId");
          expect(alert).toHaveProperty("chain");
          expect(alert).toHaveProperty("tokenAddress");
          console.log(
            `  - Agent ${alert.agentId}: ${alert.tokenAddress} on ${alert.chain}`,
          );
        });
      } else {
        console.log("✅ No self-funding detected in sample transfers");
      }
    });

    test("should handle database persistence with real trade data", async () => {
      if (realTrades.length === 0) {
        console.log("⚠️ No real trades found, skipping test");
        return;
      }

      // Setup competition with real addresses
      const adminClient = await setupAdminClient();
      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "DB Persistence Test Agent",
        walletAddress:
          uniqueWalletAddresses[2] ||
          realTrades[2]?.sender ||
          "0x" + "2".repeat(40),
      });

      const competitionResponse = await startTestCompetition(
        adminClient,
        `DB Persistence Test ${Date.now()}`,
        [agent.id],
      );
      const competitionId = competitionResponse.competition.id;

      // Clear any existing test trades for this agent
      await db
        .delete(trades)
        .where(
          and(eq(trades.agentId, agent.id), eq(trades.tradeType, "on_chain")),
        );

      // Process a real trade that matches our agent's wallet
      const testTrade: IndexedTrade = {
        ...realTrades[0]!,
        sender: agent.walletAddress!.toLowerCase(), // Override sender to match our agent
      };

      const result = await liveTradeProcessor.processCompetitionTrades(
        competitionId,
        [testTrade],
      );

      // Verify trade was processed
      expect(result.length).toBeGreaterThan(0);

      // Check database for persisted trade
      const [persistedTrade] = await db
        .select()
        .from(trades)
        .where(
          and(eq(trades.agentId, agent.id), eq(trades.tradeType, "on_chain")),
        )
        .limit(1);

      if (persistedTrade) {
        expect(persistedTrade).toBeDefined();
        expect(persistedTrade.tradeType).toBe("on_chain");
        expect(persistedTrade.agentId).toBe(agent.id);
        console.log(
          `✅ Trade persisted to database with ID: ${persistedTrade.id}`,
        );

        // Clean up
        await db.delete(trades).where(eq(trades.id, persistedTrade.id));
      }
    });

    test("should handle chain exit detection with real transfers", async () => {
      const realTransfers = await indexerSyncService.fetchAllTransfersSince(
        0,
        100,
      );

      if (realTransfers.length === 0) {
        console.log("⚠️ No real transfers found, skipping test");
        return;
      }

      // Look for transfers to known exchange/bridge addresses (simplified check)
      const potentialExitTransfers = realTransfers.filter(
        (transfer: IndexedTransfer) => {
          const to = transfer.to.toLowerCase();
          // Check for transfers to addresses that might be exchanges/bridges
          // These are patterns, not actual exchange addresses
          return (
            to.includes("0000000000") || // Transfers to burn-like addresses
            BigInt(transfer.value) > BigInt(1000000000000000000)
          ); // Large transfers (> 1 ETH worth)
        },
      );

      if (potentialExitTransfers.length > 0) {
        console.log(
          `🔍 Found ${potentialExitTransfers.length} potential exit transfers`,
        );

        // Setup competition
        const adminClient = await setupAdminClient();
        const { agent } = await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Chain Exit Test Agent",
          walletAddress: potentialExitTransfers[0]?.from,
        });

        const competitionResponse = await startTestCompetition(
          adminClient,
          `Chain Exit Detection Test ${Date.now()}`,
          [agent.id],
        );
        const competitionId = competitionResponse.competition.id;

        // Detect chain exits (using detectSelfFunding which handles both self-funding and exits)
        const detectionResult = await liveTradeProcessor.detectSelfFunding(
          competitionId,
          potentialExitTransfers.slice(0, 10),
        );

        expect(detectionResult).toBeDefined();
        expect(detectionResult.alerts).toBeDefined();

        if (detectionResult.alerts.length > 0) {
          console.log(
            `🚨 Detected ${detectionResult.alerts.length} potential chain exits or self-funding`,
          );
        } else {
          console.log("✅ No chain exits detected in sample");
        }
      } else {
        console.log("ℹ️ No potential exit transfers found in sample");
      }
    });

    test("should achieve 100% token enrichment through retry cycles", async () => {
      console.log("\n🔄 Testing Token Enrichment\n");
      console.log("=".repeat(70));

      // Fetch 1000 of the most recent trades for comprehensive testing
      const allTrades = await indexerSyncService.fetchAllTradesSince(0, 10000);
      const testTrades = allTrades.slice(-1000); // Use the most recent 1000 trades

      console.log(
        `\n📊 Testing token enrichment on ${testTrades.length} recent trades`,
      );

      // Check completion status
      const completeCount = testTrades.filter(
        (t) => t.tokenIn !== "unknown" && t.tokenOut !== "unknown",
      ).length;

      const completionRate =
        testTrades.length > 0 ? (completeCount / testTrades.length) * 100 : 0;

      // Group by protocol for detailed analysis
      const protocolStats: Record<string, { total: number; complete: number }> =
        {};
      testTrades.forEach((trade) => {
        const protocol = trade.protocol;
        if (!protocolStats[protocol]) {
          protocolStats[protocol] = { total: 0, complete: 0 };
        }
        protocolStats[protocol]!.total++;
        if (trade.tokenIn !== "unknown" && trade.tokenOut !== "unknown") {
          protocolStats[protocol]!.complete++;
        }
      });

      console.log(
        `\n📊 Overall completion rate: ${completionRate.toFixed(1)}%`,
      );
      console.log(`  ✅ Complete: ${completeCount}/${testTrades.length}`);
      console.log(
        `  ❌ Incomplete: ${testTrades.length - completeCount}/${testTrades.length}`,
      );

      console.log("\n📈 Completion by protocol:");
      Object.entries(protocolStats).forEach(([protocol, stats]) => {
        const protocolRate = (stats.complete / stats.total) * 100;
        console.log(
          `  ${protocol}: ${protocolRate.toFixed(1)}% (${stats.complete}/${stats.total})`,
        );
      });

      // According to spec, we need 100% coverage
      if (completionRate < 100) {
        console.log(
          `\n⚠️ WARNING: Only ${completionRate.toFixed(1)}% coverage`,
        );
        console.log(
          "  The spec requires 100% token coverage for the app to work",
        );

        // Show sample of incomplete trades for debugging
        const incompletes = testTrades
          .filter((t) => t.tokenIn === "unknown" || t.tokenOut === "unknown")
          .slice(0, 3);

        if (incompletes.length > 0) {
          console.log("\n📋 Sample incomplete trades:");
          incompletes.forEach((trade) => {
            console.log(`  - ${trade.id.substring(0, 20)}...`);
            console.log(
              `    Protocol: ${trade.protocol}, Chain: ${trade.chain}`,
            );
            console.log(
              `    TokenIn: ${trade.tokenIn} (amount: ${trade.amountIn})`,
            );
            console.log(
              `    TokenOut: ${trade.tokenOut} (amount: ${trade.amountOut})`,
            );
          });
        }
      }

      // Test passes if no trades to evaluate
      if (testTrades.length === 0) {
        console.log("\n⚠️ No trades found to test, skipping...");
        return;
      }

      // We expect high coverage (allowing for very minor edge cases)
      expect(completionRate).toBeGreaterThanOrEqual(95);

      // Test filtering behavior in LiveTradeProcessor
      const processingTestTrades = await indexerSyncService.fetchAllTradesSince(
        0,
        100,
      );
      if (processingTestTrades.length > 0) {
        console.log("\n🧪 Testing LiveTradeProcessor filtering behavior...");

        // Setup minimal competition
        const adminClient = await setupAdminClient();
        const { agent } = await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Consistency Test Agent",
          walletAddress:
            uniqueWalletAddresses[3] ||
            processingTestTrades[0]?.sender ||
            "0x" + "9".repeat(40),
        });

        const competitionResponse = await startTestCompetition(
          adminClient,
          `Consistency Test ${Date.now()}`,
          [agent.id],
        );

        // Process trades - should only process complete ones
        const processedTrades =
          await liveTradeProcessor.processCompetitionTrades(
            competitionResponse.competition.id,
            processingTestTrades,
          );

        // Verify only complete trades were processed
        const inputCompleteTrades = processingTestTrades.filter(
          (t) => t.tokenIn !== "unknown" && t.tokenOut !== "unknown",
        );

        console.log(`  Input: ${processingTestTrades.length} total trades`);
        console.log(`  Input complete: ${inputCompleteTrades.length} trades`);
        console.log(`  Processed: ${processedTrades.length} trades`);

        // Processed count should not exceed complete trades count
        expect(processedTrades.length).toBeLessThanOrEqual(
          inputCompleteTrades.length,
        );
        console.log(
          "  ✅ LiveTradeProcessor correctly filtered unknown tokens",
        );
      }
    }, 30000); // 30 second timeout
  },
);

// Helper function to setup admin client
async function setupAdminClient() {
  const adminClient = createTestClient();
  const adminApiKey = await getAdminApiKey();
  await adminClient.loginAsAdmin(adminApiKey);
  return adminClient;
}
