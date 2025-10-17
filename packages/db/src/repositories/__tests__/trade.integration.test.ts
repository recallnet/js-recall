import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { Logger } from "pino";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { agents, competitions, users } from "../../schema/core/defs.js";
import { balances, trades } from "../../schema/trading/defs.js";
import { BalanceRepository } from "../balance.js";
import { TradeRepository } from "../trade.js";
import { db } from "./db.js";

const WETH_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

describe("TradeRepository - Concurrent Operations", () => {
  let balanceRepo: BalanceRepository;
  let tradeRepo: TradeRepository;
  let testOwnerId: string;
  let testAgentId: string;
  let testCompetitionId: string;

  beforeAll(() => {
    const mockLogger: MockProxy<Logger> = mock<Logger>();

    const specificChainTokens = {
      eth: {
        WETH: WETH_ADDRESS,
        USDC: USDC_ADDRESS,
      },
    };

    balanceRepo = new BalanceRepository(db, mockLogger, specificChainTokens);
    tradeRepo = new TradeRepository(db, mockLogger, balanceRepo);
  });

  beforeEach(async () => {
    // Clean up
    await db.delete(trades);
    await db.delete(balances);
    await db.delete(agents);
    await db.delete(competitions);
    await db.delete(users);

    // Create test user
    testOwnerId = randomUUID();
    await db.insert(users).values({
      id: testOwnerId,
      walletAddress: "0x1234567890123456789012345678901234567890",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test competition
    testCompetitionId = randomUUID();
    await db.insert(competitions).values({
      id: testCompetitionId,
      name: "Test Competition",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test agent
    testAgentId = randomUUID();

    await db.insert(agents).values({
      id: testAgentId,
      ownerId: testOwnerId,
      name: "Test Agent",
      handle: "test-" + Date.now().toString().slice(-8),
      walletAddress: "0x2234567890123456789012345678901234567890",
      apiKey: "test-key-" + randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Initialize balances with sufficient funds
    await db.insert(balances).values([
      {
        agentId: testAgentId,
        tokenAddress: WETH_ADDRESS,
        amount: 100,
        specificChain: "eth",
        symbol: "WETH",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        agentId: testAgentId,
        tokenAddress: USDC_ADDRESS,
        amount: 200000,
        specificChain: "eth",
        symbol: "USDC",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  });

  it("should handle concurrent trades from same agent successfully", async () => {
    // Execute multiple trades concurrently
    const trade1 = {
      id: randomUUID(),
      timestamp: new Date(),
      agentId: testAgentId,
      competitionId: testCompetitionId,
      fromToken: WETH_ADDRESS,
      toToken: USDC_ADDRESS,
      fromAmount: 1,
      toAmount: 2000,
      price: 2000,
      fromTokenSymbol: "WETH",
      toTokenSymbol: "USDC",
      fromSpecificChain: "eth" as const,
      toSpecificChain: "eth" as const,
      tradeAmountUsd: 2000,
      success: true,
      reason: "Concurrent test trade 1",
      fromChain: "evm" as const,
      toChain: "evm" as const,
    };

    const trade2 = {
      id: randomUUID(),
      timestamp: new Date(),
      agentId: testAgentId,
      competitionId: testCompetitionId,
      fromToken: USDC_ADDRESS,
      toToken: WETH_ADDRESS,
      fromAmount: 2000,
      toAmount: 1,
      price: 0.0005,
      fromTokenSymbol: "USDC",
      toTokenSymbol: "WETH",
      fromSpecificChain: "eth" as const,
      toSpecificChain: "eth" as const,
      tradeAmountUsd: 2000,
      success: true,
      reason: "Concurrent test trade 2",
      fromChain: "evm" as const,
      toChain: "evm" as const,
    };

    // Execute trades concurrently
    const results = await Promise.allSettled([
      tradeRepo.createTradeWithBalances(trade1),
      tradeRepo.createTradeWithBalances(trade2),
    ]);

    // Verify at least one trade succeeded
    const successCount = results.filter((r) => r.status === "fulfilled").length;
    expect(successCount).toBeGreaterThanOrEqual(1);

    // Verify no unexpected errors
    results.forEach((result) => {
      if (result.status === "rejected") {
        const error = result.reason;
        const errorMessage = error?.message || String(error);

        // Only acceptable errors are balance-related (one trade consumed the funds)
        expect(errorMessage).toMatch(/Insufficient balance|balance not found/i);
      }
    });

    // Verify database consistency
    const finalBalances = await db
      .select()
      .from(balances)
      .where(eq(balances.agentId, testAgentId));

    expect(finalBalances.length).toBe(2);

    // Verify all balances are non-negative
    finalBalances.forEach((balance) => {
      expect(balance.amount).toBeGreaterThanOrEqual(0);
    });
  });

  it("should handle multiple concurrent trades with high parallelism", async () => {
    const tradePromises: Promise<unknown>[] = [];

    // Create 10 concurrent trades alternating directions
    for (let i = 0; i < 10; i++) {
      const isWethToUsdc = i % 2 === 0;

      tradePromises.push(
        tradeRepo.createTradeWithBalances({
          id: randomUUID(),
          timestamp: new Date(),
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: isWethToUsdc ? WETH_ADDRESS : USDC_ADDRESS,
          toToken: isWethToUsdc ? USDC_ADDRESS : WETH_ADDRESS,
          fromAmount: isWethToUsdc ? 0.5 : 1000,
          toAmount: isWethToUsdc ? 1000 : 0.5,
          price: isWethToUsdc ? 2000 : 0.0005,
          fromTokenSymbol: isWethToUsdc ? "WETH" : "USDC",
          toTokenSymbol: isWethToUsdc ? "USDC" : "WETH",
          fromSpecificChain: "eth",
          toSpecificChain: "eth",
          tradeAmountUsd: 1000,
          success: true,
          reason: `Concurrent test ${i}`,
          fromChain: "evm",
          toChain: "evm",
        }),
      );
    }

    const results = await Promise.allSettled(tradePromises);

    // At least some trades should succeed
    const successCount = results.filter((r) => r.status === "fulfilled").length;
    expect(successCount).toBeGreaterThan(0);

    // Verify database consistency
    const finalBalances = await db
      .select()
      .from(balances)
      .where(eq(balances.agentId, testAgentId));

    // All balances should be valid
    finalBalances.forEach((balance) => {
      expect(balance.amount).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(balance.amount)).toBe(true);
    });
  });

  it("should handle same-token trades without balance overwrite bug", async () => {
    // Test case: cross-chain same-token swap (e.g., USDC on ETH -> USDC on Polygon)
    // Use the actual initial balance from beforeEach setup
    const initialBalance = 200000;

    // Execute a same-token trade
    const result = await tradeRepo.createTradeWithBalances({
      id: randomUUID(),
      timestamp: new Date(),
      agentId: testAgentId,
      competitionId: testCompetitionId,
      fromToken: USDC_ADDRESS, // Same token
      toToken: USDC_ADDRESS, // Same token
      fromAmount: 100, // Subtract 100
      toAmount: 150, // Add 150
      price: 1.5,
      fromTokenSymbol: "USDC",
      toTokenSymbol: "USDC",
      fromSpecificChain: "eth" as const,
      toSpecificChain: "eth" as const,
      tradeAmountUsd: 100,
      success: true,
      reason: "Same-token test",
      fromChain: "evm" as const,
      toChain: "evm" as const,
    });

    // Verify both balance values are correct
    // fromTokenBalance captures the result after decrement
    expect(result.updatedBalances.fromTokenBalance).toBe(initialBalance - 100); // 199900
    // toTokenBalance captures the result after increment (final balance)
    expect(result.updatedBalances.toTokenBalance).toBe(
      initialBalance - 100 + 150,
    ); // 200050

    // Verify database has the correct final balance
    const finalBalance = await db
      .select()
      .from(balances)
      .where(
        and(
          eq(balances.agentId, testAgentId),
          eq(balances.tokenAddress, USDC_ADDRESS),
        ),
      );

    expect(finalBalance[0]?.amount).toBe(initialBalance - 100 + 150); // 200050
  });
});
