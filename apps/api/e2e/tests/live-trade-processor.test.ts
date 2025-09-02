/**
 * E2E Test for LiveTradeProcessor Service
 * 
 * Uses real Envio indexer data and actual API endpoints to test
 * the live trade processing functionality.
 */

import { beforeAll, describe, expect, test } from "vitest";
import { v4 as uuidv4 } from "uuid";

import { db } from "@/database/db.js";
import { trades, balances } from "@/database/schema/trading/defs.js";
import { IndexerSyncService } from "@/services/indexer-sync.service.js";
import { LiveTradeProcessor } from "@/services/live-trade-processor.service.js";
import { getAdminApiKey, startTestCompetition, registerUserAndAgentAndGetClient } from "@/e2e/utils/test-helpers.js";
import { eq, and } from "drizzle-orm";
import type { IndexedTrade } from "@/services/indexer-sync.service.js";
import type { DetectedIssue } from "@/services/live-trade-processor.service.js";

// Only run these tests when TEST_LIVE_TRADING is enabled
const describeIfLiveTrading = process.env.TEST_LIVE_TRADING === "true" ? describe : describe.skip;

describeIfLiveTrading("LiveTradeProcessor Service (E2E with Real Envio)", () => {
    let indexerSyncService: IndexerSyncService;
    let liveTradeProcessor: LiveTradeProcessor;
    let adminApiKey: string;
    let realTrades: IndexedTrade[] = [];
    let uniqueWalletAddresses: string[] = [];

    beforeAll(async () => {
        // Initialize services
        indexerSyncService = new IndexerSyncService();
        liveTradeProcessor = new LiveTradeProcessor();
        adminApiKey = await getAdminApiKey();

        // Fetch some real trades from Envio to get actual wallet addresses
        console.log("🔍 Fetching real trades from Envio indexer...");
        realTrades = await indexerSyncService.fetchTradesSince(0, 20, 0);
        console.log(`📊 Found ${realTrades.length} real trades from Envio`);

        if (realTrades.length > 0) {
            // Extract unique wallet addresses from the trades
            const addressSet = new Set<string>();
            realTrades.forEach(trade => {
                addressSet.add(trade.sender.toLowerCase());
                addressSet.add(trade.recipient.toLowerCase());
            });
            uniqueWalletAddresses = Array.from(addressSet).slice(0, 5); // Take first 5 unique addresses
            console.log(`👤 Found ${uniqueWalletAddresses.length} unique wallet addresses to use as test agents`);
        }
    });

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
            expect(firstTrade).toHaveProperty('sender');
            expect(firstTrade).toHaveProperty('recipient');
            expect(firstTrade).toHaveProperty('tokenIn');
            expect(firstTrade).toHaveProperty('tokenOut');
            expect(firstTrade).toHaveProperty('amountIn');
            expect(firstTrade).toHaveProperty('amountOut');
            expect(firstTrade).toHaveProperty('protocol');
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
        const testAgents = [];
        for (let i = 0; i < Math.min(3, uniqueWalletAddresses.length); i++) {
            const walletAddress = uniqueWalletAddresses[i]!;
            const { agent } = await registerUserAndAgentAndGetClient({
                adminApiKey,
                agentName: `Live Trading Agent ${i + 1}`,
                walletAddress, // Use real wallet address from Envio data
            });
            testAgents.push(agent);
            console.log(`✅ Created agent ${agent.name} with wallet ${walletAddress}`);
        }

        // Start a competition with these agents
        const competitionName = `Live Trading Test ${Date.now()}`;
        const competitionResponse = await startTestCompetition(
            adminClient,
            competitionName,
            testAgents.map(a => a.id),
        );

        expect(competitionResponse.success).toBe(true);
        const competitionId = competitionResponse.competition.id;
        console.log(`🏁 Started competition: ${competitionId}`);

        // Process the real trades through LiveTradeProcessor
        const processedResult = await liveTradeProcessor.processCompetitionTrades(
            competitionId,
            realTrades.slice(0, 10), // Process first 10 trades
        );

        // Verify processing results
        expect(processedResult).toBeDefined();
        expect(processedResult.trades).toBeDefined();
        expect(Array.isArray(processedResult.trades)).toBe(true);

        // Only trades from our competition agents should be processed
        const competitionWallets = testAgents.map(a => a.walletAddress?.toLowerCase());
        processedResult.trades.forEach(trade => {
            const senderInCompetition = competitionWallets.includes(trade.sender.toLowerCase());
            const recipientInCompetition = competitionWallets.includes(trade.recipient.toLowerCase());
            expect(senderInCompetition || recipientInCompetition).toBe(true);
        });

        console.log(`✅ Processed ${processedResult.trades.length} trades for competition agents`);
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
            walletAddress: uniqueWalletAddresses[0] || "0x" + "1".repeat(40),
        });

        const competitionResponse = await startTestCompetition(
            adminClient,
            `Price Enrichment Test ${Date.now()}`,
            [agent.id],
        );
        const competitionId = competitionResponse.competition.id;

        // Get trades that match known token addresses
        const tradesWithKnownTokens = realTrades.filter(trade =>
            trade.tokenIn !== "unknown" &&
            trade.tokenOut !== "unknown" &&
            !trade.tokenIn.includes("curve-token")
        ).slice(0, 5);

        if (tradesWithKnownTokens.length > 0) {
            // Enrich trades with prices
            const enrichedTrades = await liveTradeProcessor.enrichTradesWithPrices(
                tradesWithKnownTokens,
                competitionId,
            );

            // Verify enrichment
            expect(enrichedTrades).toBeDefined();
            expect(enrichedTrades.length).toBe(tradesWithKnownTokens.length);

            enrichedTrades.forEach((trade, index) => {
                const originalTrade = tradesWithKnownTokens[index];
                // Check that trade data is preserved
                expect(trade.sender).toBe(originalTrade?.sender);
                expect(trade.tokenIn).toBe(originalTrade?.tokenIn);
                expect(trade.tokenOut).toBe(originalTrade?.tokenOut);

                // Check that price data was added (if available)
                if (trade.fromAmountUsd && trade.fromAmountUsd > 0) {
                    console.log(`💰 Trade ${index}: ${trade.fromAmountUsd} USD`);
                    expect(typeof trade.fromAmountUsd).toBe('number');
                    expect(trade.fromAmountUsd).toBeGreaterThan(0);
                }
            });
        } else {
            console.log("⚠️ No trades with known tokens found for price enrichment");
        }
    });

    test("should detect self-funding with real transfer data", async () => {
        // Fetch real transfers from Envio
        const realTransfers = await indexerSyncService.fetchTransfersSince(0, 50, 0);
        console.log(`📊 Found ${realTransfers.length} real transfers from Envio`);

        if (realTransfers.length === 0) {
            console.log("⚠️ No real transfers found, skipping test");
            return;
        }

        // Setup competition
        const adminClient = await setupAdminClient();

        // Use addresses from transfers
        const transferAddresses = Array.from(new Set(
            realTransfers.flatMap(t => [t.from, t.to])
        )).slice(0, 3);

        const testAgents = [];
        for (let i = 0; i < Math.min(2, transferAddresses.length); i++) {
            const { agent } = await registerUserAndAgentAndGetClient({
                adminApiKey,
                agentName: `Self-Funding Test Agent ${i + 1}`,
                walletAddress: transferAddresses[i],
            });
            testAgents.push(agent);
        }

        const competitionResponse = await startTestCompetition(
            adminClient,
            `Self-Funding Detection Test ${Date.now()}`,
            testAgents.map(a => a.id),
        );
        const competitionId = competitionResponse.competition.id;

        // Process transfers for self-funding detection
        const detectionResult = await liveTradeProcessor.detectSelfFunding(
            realTransfers.slice(0, 20),
            competitionId,
        );

        // Verify detection results
        expect(detectionResult).toBeDefined();
        expect(detectionResult.fundingIssues).toBeDefined();
        expect(Array.isArray(detectionResult.fundingIssues)).toBe(true);

        if (detectionResult.fundingIssues.length > 0) {
            console.log(`🚨 Detected ${detectionResult.fundingIssues.length} potential self-funding issues`);
            detectionResult.fundingIssues.forEach((issue: DetectedIssue) => {
                expect(issue).toHaveProperty('agentId');
                expect(issue).toHaveProperty('type');
                expect(issue).toHaveProperty('details');
                console.log(`  - Agent ${issue.agentId}: ${issue.type}`);
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
            walletAddress: uniqueWalletAddresses[0] || realTrades[0]?.sender || "0x" + "2".repeat(40),
        });

        const competitionResponse = await startTestCompetition(
            adminClient,
            `DB Persistence Test ${Date.now()}`,
            [agent.id],
        );
        const competitionId = competitionResponse.competition.id;

        // Clear any existing test trades for this agent
        await db.delete(trades).where(
            and(
                eq(trades.agentId, agent.id),
                eq(trades.tradeType, 'on_chain')
            )
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
        expect(result.trades.length).toBeGreaterThan(0);

        // Check database for persisted trade
        const [persistedTrade] = await db
            .select()
            .from(trades)
            .where(
                and(
                    eq(trades.agentId, agent.id),
                    eq(trades.tradeType, 'on_chain')
                )
            )
            .limit(1);

        if (persistedTrade) {
            expect(persistedTrade).toBeDefined();
            expect(persistedTrade.tradeType).toBe('on_chain');
            expect(persistedTrade.agentId).toBe(agent.id);
            console.log(`✅ Trade persisted to database with ID: ${persistedTrade.id}`);

            // Clean up
            await db.delete(trades).where(eq(trades.id, persistedTrade.id));
        }
    });

    test("should handle chain exit detection with real transfers", async () => {
        const realTransfers = await indexerSyncService.fetchTransfersSince(0, 100, 0);

        if (realTransfers.length === 0) {
            console.log("⚠️ No real transfers found, skipping test");
            return;
        }

        // Look for transfers to known exchange/bridge addresses (simplified check)
        const potentialExitTransfers = realTransfers.filter(transfer => {
            const to = transfer.to.toLowerCase();
            // Check for transfers to addresses that might be exchanges/bridges
            // These are patterns, not actual exchange addresses
            return to.includes('0000000000') || // Transfers to burn-like addresses
                transfer.value > BigInt(1000000000000000000); // Large transfers (> 1 ETH worth)
        });

        if (potentialExitTransfers.length > 0) {
            console.log(`🔍 Found ${potentialExitTransfers.length} potential exit transfers`);

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

            // Detect chain exits
            const detectionResult = await liveTradeProcessor.detectChainExits(
                potentialExitTransfers.slice(0, 10),
                competitionId,
            );

            expect(detectionResult).toBeDefined();
            expect(detectionResult.exitIssues).toBeDefined();

            if (detectionResult.exitIssues.length > 0) {
                console.log(`🚨 Detected ${detectionResult.exitIssues.length} potential chain exits`);
            } else {
                console.log("✅ No chain exits detected in sample");
            }
        } else {
            console.log("ℹ️ No potential exit transfers found in sample");
        }
    });
});

// Helper function to setup admin client
async function setupAdminClient() {
    const { createTestClient } = await import("@/e2e/utils/test-helpers.js");
    const adminClient = createTestClient();
    const adminApiKey = await getAdminApiKey();
    await adminClient.loginAsAdmin(adminApiKey);
    return adminClient;
}
