// ABOUTME: Integration tests for BalanceRepository multi-competition balances implementation
// ABOUTME: Tests isolation, cascade deletion, cache behavior, and edge cases for balances per competition
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { pino } from "pino";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import * as coreSchema from "../../schema/core/defs.js";
import * as tradingSchema from "../../schema/trading/defs.js";
import { dropAllSchemas } from "../../utils/drop-all-schemas.js";
import { pushSchema } from "../../utils/push-schema.js";
import { BalanceRepository } from "../balance.js";
import type { SpecificChain } from "../types/index.js";
import { db } from "./db.js";

const logger = pino({ level: "silent" });

// Mock token configurations
const specificChainTokens = {
  eth: {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  },
  base: {
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    WETH: "0x4200000000000000000000000000000000000006",
  },
  polygon: {},
  optimism: {},
  arbitrum: {},
  svm: {},
};

describe("BalanceRepository Multi-Competition Integration Tests", () => {
  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  let repository: BalanceRepository;
  let testUserId1: string;
  let testUserId2: string;
  let testCompetitionId1: string;
  let testCompetitionId2: string;
  let testAgentId1: string;
  let testAgentId2: string;

  beforeEach(async () => {
    repository = new BalanceRepository(db, logger, specificChainTokens);

    // Create test users
    testUserId1 = randomUUID();
    await db.insert(coreSchema.users).values({
      id: testUserId1,
      walletAddress: `0x${randomUUID().replace(/-/g, "").substring(0, 40).padEnd(40, "1")}`,
      name: "Test User 1",
      status: "active",
    });

    testUserId2 = randomUUID();
    await db.insert(coreSchema.users).values({
      id: testUserId2,
      walletAddress: `0x${randomUUID().replace(/-/g, "").substring(0, 40).padEnd(40, "2")}`,
      name: "Test User 2",
      status: "active",
    });

    // Create test competitions
    testCompetitionId1 = randomUUID();
    await db.insert(coreSchema.competitions).values({
      id: testCompetitionId1,
      name: "Test Competition 1",
      description: "First test competition",
      status: "pending",
    });

    testCompetitionId2 = randomUUID();
    await db.insert(coreSchema.competitions).values({
      id: testCompetitionId2,
      name: "Test Competition 2",
      description: "Second test competition",
      status: "pending",
    });

    // Create test agents
    const testRunId = randomUUID().substring(0, 8);

    testAgentId1 = randomUUID();
    await db.insert(coreSchema.agents).values({
      id: testAgentId1,
      ownerId: testUserId1,
      handle: `ag1-${testRunId}`,
      name: "Test Agent 1",
      apiKey: `key1-${testAgentId1}`,
      status: "active",
    });

    testAgentId2 = randomUUID();
    await db.insert(coreSchema.agents).values({
      id: testAgentId2,
      ownerId: testUserId2,
      handle: `ag2-${testRunId}`,
      name: "Test Agent 2",
      apiKey: `key2-${testAgentId2}`,
      status: "active",
    });
  });

  afterEach(async () => {
    // Clean up in proper order respecting foreign key constraints
    try {
      // Delete balances first (cascade handles trades)
      await db.delete(tradingSchema.balances);

      // Delete agents
      await db
        .delete(coreSchema.agents)
        .where(eq(coreSchema.agents.ownerId, testUserId1));
      await db
        .delete(coreSchema.agents)
        .where(eq(coreSchema.agents.ownerId, testUserId2));

      // Delete competitions
      await db
        .delete(coreSchema.competitions)
        .where(eq(coreSchema.competitions.id, testCompetitionId1));
      await db
        .delete(coreSchema.competitions)
        .where(eq(coreSchema.competitions.id, testCompetitionId2));

      // Delete users
      await db
        .delete(coreSchema.users)
        .where(eq(coreSchema.users.id, testUserId1));
      await db
        .delete(coreSchema.users)
        .where(eq(coreSchema.users.id, testUserId2));
    } catch (error) {
      console.warn("Cleanup error:", error);
    }
  });

  describe("Multi-Competition Isolation", () => {
    test("should isolate balances between different competitions", async () => {
      const usdcAddress = specificChainTokens.eth.USDC;

      // Create balance for agent1 in competition1
      await db.transaction(async (tx) => {
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId1,
          1000,
          "eth" as SpecificChain,
          "USDC",
        );
      });

      // Create balance for same agent in competition2
      await db.transaction(async (tx) => {
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId2,
          500,
          "eth" as SpecificChain,
          "USDC",
        );
      });

      // Verify isolation
      const balance1 = await repository.getBalance(
        testAgentId1,
        usdcAddress,
        testCompetitionId1,
      );
      const balance2 = await repository.getBalance(
        testAgentId1,
        usdcAddress,
        testCompetitionId2,
      );

      expect(balance1?.amount).toBe(1000);
      expect(balance2?.amount).toBe(500);

      // Verify they are separate records
      const allBalances = await db
        .select()
        .from(tradingSchema.balances)
        .where(eq(tradingSchema.balances.agentId, testAgentId1));

      expect(allBalances).toHaveLength(2);
      expect(allBalances.map((b) => b.competitionId)).toContain(
        testCompetitionId1,
      );
      expect(allBalances.map((b) => b.competitionId)).toContain(
        testCompetitionId2,
      );
    });

    test("should allow same agent to have different token balances in different competitions", async () => {
      const usdcAddress = specificChainTokens.eth.USDC;
      const wethAddress = specificChainTokens.eth.WETH;

      // Competition 1: Agent has USDC
      await db.transaction(async (tx) => {
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId1,
          2000,
          "eth" as SpecificChain,
          "USDC",
        );
      });

      // Competition 2: Same agent has WETH instead
      await db.transaction(async (tx) => {
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          wethAddress,
          testCompetitionId2,
          10,
          "eth" as SpecificChain,
          "WETH",
        );
      });

      // Verify different tokens in different competitions
      const comp1Balances = await repository.getAgentBalances(
        testAgentId1,
        testCompetitionId1,
      );
      const comp2Balances = await repository.getAgentBalances(
        testAgentId1,
        testCompetitionId2,
      );

      expect(comp1Balances).toHaveLength(1);
      expect(comp1Balances[0]?.tokenAddress).toBe(usdcAddress);
      expect(comp1Balances[0]?.amount).toBe(2000);

      expect(comp2Balances).toHaveLength(1);
      expect(comp2Balances[0]?.tokenAddress).toBe(wethAddress);
      expect(comp2Balances[0]?.amount).toBe(10);
    });

    test("should handle bulk balance queries correctly per competition", async () => {
      const usdcAddress = specificChainTokens.eth.USDC;

      // Create balances for both agents in competition1
      await db.transaction(async (tx) => {
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId1,
          1000,
          "eth" as SpecificChain,
          "USDC",
        );
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId2,
          usdcAddress,
          testCompetitionId1,
          2000,
          "eth" as SpecificChain,
          "USDC",
        );
      });

      // Create balances for both agents in competition2
      await db.transaction(async (tx) => {
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId2,
          500,
          "eth" as SpecificChain,
          "USDC",
        );
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId2,
          usdcAddress,
          testCompetitionId2,
          750,
          "eth" as SpecificChain,
          "USDC",
        );
      });

      // Bulk query for competition1
      const comp1Balances = await repository.getAgentsBulkBalances(
        [testAgentId1, testAgentId2],
        testCompetitionId1,
      );

      // Bulk query for competition2
      const comp2Balances = await repository.getAgentsBulkBalances(
        [testAgentId1, testAgentId2],
        testCompetitionId2,
      );

      expect(comp1Balances).toHaveLength(2);
      expect(
        comp1Balances.find((b) => b.agentId === testAgentId1)?.amount,
      ).toBe(1000);
      expect(
        comp1Balances.find((b) => b.agentId === testAgentId2)?.amount,
      ).toBe(2000);

      expect(comp2Balances).toHaveLength(2);
      expect(
        comp2Balances.find((b) => b.agentId === testAgentId1)?.amount,
      ).toBe(500);
      expect(
        comp2Balances.find((b) => b.agentId === testAgentId2)?.amount,
      ).toBe(750);
    });

    test("should count balances correctly per competition", async () => {
      const usdcAddress = specificChainTokens.eth.USDC;
      const wethAddress = specificChainTokens.eth.WETH;

      // Create 2 balances in competition1
      await db.transaction(async (tx) => {
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId1,
          1000,
          "eth" as SpecificChain,
          "USDC",
        );
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          wethAddress,
          testCompetitionId1,
          5,
          "eth" as SpecificChain,
          "WETH",
        );
      });

      // Create 3 balances in competition2
      await db.transaction(async (tx) => {
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId2,
          500,
          "eth" as SpecificChain,
          "USDC",
        );
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId2,
          usdcAddress,
          testCompetitionId2,
          1500,
          "eth" as SpecificChain,
          "USDC",
        );
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId2,
          wethAddress,
          testCompetitionId2,
          3,
          "eth" as SpecificChain,
          "WETH",
        );
      });

      const comp1Count = await repository.count(testCompetitionId1);
      const comp2Count = await repository.count(testCompetitionId2);
      const totalCount = await repository.count();

      expect(comp1Count).toBe(2);
      expect(comp2Count).toBe(3);
      expect(totalCount).toBe(5);
    });
  });

  describe("Cascade Deletion", () => {
    test("should cascade delete balances when competition is deleted", async () => {
      const usdcAddress = specificChainTokens.eth.USDC;

      // Create balance in competition1
      await db.transaction(async (tx) => {
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId1,
          1000,
          "eth" as SpecificChain,
          "USDC",
        );
      });

      // Verify balance exists
      const balanceBeforeDelete = await repository.getBalance(
        testAgentId1,
        usdcAddress,
        testCompetitionId1,
      );
      expect(balanceBeforeDelete?.amount).toBe(1000);

      // Delete competition
      await db
        .delete(coreSchema.competitions)
        .where(eq(coreSchema.competitions.id, testCompetitionId1));

      // Verify balance was cascade deleted
      const balanceAfterDelete = await repository.getBalance(
        testAgentId1,
        usdcAddress,
        testCompetitionId1,
      );
      expect(balanceAfterDelete).toBeUndefined();

      // Verify database record is gone
      const dbBalances = await db
        .select()
        .from(tradingSchema.balances)
        .where(
          and(
            eq(tradingSchema.balances.agentId, testAgentId1),
            eq(tradingSchema.balances.competitionId, testCompetitionId1),
          ),
        );
      expect(dbBalances).toHaveLength(0);
    });

    test("should cascade delete balances when agent is deleted", async () => {
      const usdcAddress = specificChainTokens.eth.USDC;

      // Create balances for agent in both competitions
      await db.transaction(async (tx) => {
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId1,
          1000,
          "eth" as SpecificChain,
          "USDC",
        );
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId2,
          500,
          "eth" as SpecificChain,
          "USDC",
        );
      });

      // Verify balances exist
      const comp1Balance = await repository.getBalance(
        testAgentId1,
        usdcAddress,
        testCompetitionId1,
      );
      const comp2Balance = await repository.getBalance(
        testAgentId1,
        usdcAddress,
        testCompetitionId2,
      );
      expect(comp1Balance?.amount).toBe(1000);
      expect(comp2Balance?.amount).toBe(500);

      // Delete agent
      await db
        .delete(coreSchema.agents)
        .where(eq(coreSchema.agents.id, testAgentId1));

      // Verify all balances for this agent were cascade deleted
      const dbBalances = await db
        .select()
        .from(tradingSchema.balances)
        .where(eq(tradingSchema.balances.agentId, testAgentId1));
      expect(dbBalances).toHaveLength(0);
    });

    test("should only delete balances for target competition when deleting", async () => {
      const usdcAddress = specificChainTokens.eth.USDC;

      // Create balances in both competitions
      await db.transaction(async (tx) => {
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId1,
          1000,
          "eth" as SpecificChain,
          "USDC",
        );
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId2,
          500,
          "eth" as SpecificChain,
          "USDC",
        );
      });

      // Delete competition1
      await db
        .delete(coreSchema.competitions)
        .where(eq(coreSchema.competitions.id, testCompetitionId1));

      // Verify competition1 balances are gone
      const comp1Balance = await repository.getBalance(
        testAgentId1,
        usdcAddress,
        testCompetitionId1,
      );
      expect(comp1Balance).toBeUndefined();

      // Verify competition2 balances still exist
      const comp2Balance = await repository.getBalance(
        testAgentId1,
        usdcAddress,
        testCompetitionId2,
      );
      expect(comp2Balance?.amount).toBe(500);
    });
  });

  describe("Balance Reset Isolation", () => {
    test("should only reset balances for target competition", async () => {
      const usdcAddress = specificChainTokens.eth.USDC;
      const wethAddress = specificChainTokens.eth.WETH;

      // Create initial balances in both competitions
      await db.transaction(async (tx) => {
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId1,
          1000,
          "eth" as SpecificChain,
          "USDC",
        );
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          wethAddress,
          testCompetitionId1,
          5,
          "eth" as SpecificChain,
          "WETH",
        );
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId2,
          2000,
          "eth" as SpecificChain,
          "USDC",
        );
      });

      // Reset balances for competition1 only
      const newBalances = new Map([
        [usdcAddress, { amount: 5000, symbol: "USDC" }],
      ]);
      await repository.resetAgentBalances(
        testAgentId1,
        testCompetitionId1,
        newBalances,
      );

      // Verify competition1 balances were reset
      const comp1Balances = await repository.getAgentBalances(
        testAgentId1,
        testCompetitionId1,
      );
      expect(comp1Balances).toHaveLength(1);
      expect(comp1Balances[0]?.tokenAddress).toBe(usdcAddress);
      expect(comp1Balances[0]?.amount).toBe(5000);

      // Verify competition2 balances unchanged
      const comp2Balances = await repository.getAgentBalances(
        testAgentId1,
        testCompetitionId2,
      );
      expect(comp2Balances).toHaveLength(1);
      expect(comp2Balances[0]?.tokenAddress).toBe(usdcAddress);
      expect(comp2Balances[0]?.amount).toBe(2000);
    });

    test("should handle resetting to empty balances in one competition", async () => {
      const usdcAddress = specificChainTokens.eth.USDC;

      // Create balances in both competitions
      await db.transaction(async (tx) => {
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId1,
          1000,
          "eth" as SpecificChain,
          "USDC",
        );
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId2,
          2000,
          "eth" as SpecificChain,
          "USDC",
        );
      });

      // Reset competition1 to empty
      await repository.resetAgentBalances(
        testAgentId1,
        testCompetitionId1,
        new Map(),
      );

      // Verify competition1 has no balances
      const comp1Balances = await repository.getAgentBalances(
        testAgentId1,
        testCompetitionId1,
      );
      expect(comp1Balances).toHaveLength(0);

      // Verify competition2 still has balances
      const comp2Balances = await repository.getAgentBalances(
        testAgentId1,
        testCompetitionId2,
      );
      expect(comp2Balances).toHaveLength(1);
      expect(comp2Balances[0]?.amount).toBe(2000);
    });

    test("should handle multiple resets in different competitions", async () => {
      const usdcAddress = specificChainTokens.eth.USDC;

      // Reset competition1
      await repository.resetAgentBalances(
        testAgentId1,
        testCompetitionId1,
        new Map([[usdcAddress, { amount: 1000, symbol: "USDC" }]]),
      );

      // Reset competition2 with different amount
      await repository.resetAgentBalances(
        testAgentId1,
        testCompetitionId2,
        new Map([[usdcAddress, { amount: 3000, symbol: "USDC" }]]),
      );

      // Verify both competitions have correct balances
      const comp1Balance = await repository.getBalance(
        testAgentId1,
        usdcAddress,
        testCompetitionId1,
      );
      const comp2Balance = await repository.getBalance(
        testAgentId1,
        usdcAddress,
        testCompetitionId2,
      );

      expect(comp1Balance?.amount).toBe(1000);
      expect(comp2Balance?.amount).toBe(3000);
    });
  });

  describe("Transaction Balance Updates", () => {
    test("should update balances correctly in same competition", async () => {
      const usdcAddress = specificChainTokens.eth.USDC;

      // Initial balance
      await db.transaction(async (tx) => {
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId1,
          1000,
          "eth" as SpecificChain,
          "USDC",
        );
      });

      // Increment
      await db.transaction(async (tx) => {
        const newBalance = await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId1,
          500,
          "eth" as SpecificChain,
          "USDC",
        );
        expect(newBalance).toBe(1500);
      });

      // Decrement
      await db.transaction(async (tx) => {
        const newBalance = await repository.decrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId1,
          300,
          "eth" as SpecificChain,
          "USDC",
        );
        expect(newBalance).toBe(1200);
      });

      // Verify final balance
      const finalBalance = await repository.getBalance(
        testAgentId1,
        usdcAddress,
        testCompetitionId1,
      );
      expect(finalBalance?.amount).toBe(1200);
    });

    test("should prevent overdraft in transaction", async () => {
      const usdcAddress = specificChainTokens.eth.USDC;

      // Create balance
      await db.transaction(async (tx) => {
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId1,
          1000,
          "eth" as SpecificChain,
          "USDC",
        );
      });

      // Try to decrement more than available
      await expect(
        db.transaction(async (tx) => {
          await repository.decrementBalanceInTransaction(
            tx,
            testAgentId1,
            usdcAddress,
            testCompetitionId1,
            1500,
            "eth" as SpecificChain,
            "USDC",
          );
        }),
      ).rejects.toThrow("Insufficient balance");

      // Verify balance unchanged
      const balance = await repository.getBalance(
        testAgentId1,
        usdcAddress,
        testCompetitionId1,
      );
      expect(balance?.amount).toBe(1000);
    });

    test("should isolate transaction updates between competitions", async () => {
      const usdcAddress = specificChainTokens.eth.USDC;

      // Create balances in both competitions
      await db.transaction(async (tx) => {
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId1,
          1000,
          "eth" as SpecificChain,
          "USDC",
        );
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId2,
          500,
          "eth" as SpecificChain,
          "USDC",
        );
      });

      // Update only competition1
      await db.transaction(async (tx) => {
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId1,
          200,
          "eth" as SpecificChain,
          "USDC",
        );
      });

      // Verify competition1 was updated
      const comp1Balance = await repository.getBalance(
        testAgentId1,
        usdcAddress,
        testCompetitionId1,
      );
      expect(comp1Balance?.amount).toBe(1200);

      // Verify competition2 unchanged
      const comp2Balance = await repository.getBalance(
        testAgentId1,
        usdcAddress,
        testCompetitionId2,
      );
      expect(comp2Balance?.amount).toBe(500);
    });
  });

  describe("Edge Cases", () => {
    test("should handle non-existent competition gracefully", async () => {
      const fakeCompetitionId = "00000000-0000-0000-0000-000000000000";
      const usdcAddress = specificChainTokens.eth.USDC;

      const balance = await repository.getBalance(
        testAgentId1,
        usdcAddress,
        fakeCompetitionId,
      );
      expect(balance).toBeUndefined();

      const balances = await repository.getAgentBalances(
        testAgentId1,
        fakeCompetitionId,
      );
      expect(balances).toHaveLength(0);
    });

    test("should handle empty agent list in bulk query", async () => {
      const balances = await repository.getAgentsBulkBalances(
        [],
        testCompetitionId1,
      );
      expect(balances).toHaveLength(0);
    });

    test("should handle agent with no balances in competition", async () => {
      const balances = await repository.getAgentBalances(
        testAgentId1,
        testCompetitionId1,
      );
      expect(balances).toHaveLength(0);
    });

    test("should enforce unique constraint per competition", async () => {
      const usdcAddress = specificChainTokens.eth.USDC;

      // Create balance
      await db.transaction(async (tx) => {
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId1,
          1000,
          "eth" as SpecificChain,
          "USDC",
        );
      });

      // Try to manually insert duplicate (should fail)
      await expect(
        db.insert(tradingSchema.balances).values({
          agentId: testAgentId1,
          competitionId: testCompetitionId1,
          tokenAddress: usdcAddress,
          amount: 500,
          specificChain: "eth",
          symbol: "USDC",
        }),
      ).rejects.toThrow();
    });

    test("should allow same agent/token combination in different competitions", async () => {
      const usdcAddress = specificChainTokens.eth.USDC;

      // Insert in competition1
      await db.insert(tradingSchema.balances).values({
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        tokenAddress: usdcAddress,
        amount: 1000,
        specificChain: "eth",
        symbol: "USDC",
      });

      // Insert same agent/token in competition2 (should succeed)
      await expect(
        db.insert(tradingSchema.balances).values({
          agentId: testAgentId1,
          competitionId: testCompetitionId2,
          tokenAddress: usdcAddress,
          amount: 500,
          specificChain: "eth",
          symbol: "USDC",
        }),
      ).resolves.toBeDefined();

      // Verify both exist
      const allBalances = await db
        .select()
        .from(tradingSchema.balances)
        .where(
          and(
            eq(tradingSchema.balances.agentId, testAgentId1),
            eq(tradingSchema.balances.tokenAddress, usdcAddress),
          ),
        );
      expect(allBalances).toHaveLength(2);
    });
  });

  describe("Complex Multi-Competition Scenarios", () => {
    test("should handle multiple agents across multiple competitions", async () => {
      const usdcAddress = specificChainTokens.eth.USDC;
      const wethAddress = specificChainTokens.eth.WETH;

      // Create complex state:
      // Agent1 in Comp1: USDC=1000, WETH=5
      // Agent1 in Comp2: USDC=500
      // Agent2 in Comp1: USDC=2000
      // Agent2 in Comp2: WETH=10

      await db.transaction(async (tx) => {
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId1,
          1000,
          "eth" as SpecificChain,
          "USDC",
        );
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          wethAddress,
          testCompetitionId1,
          5,
          "eth" as SpecificChain,
          "WETH",
        );
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId1,
          usdcAddress,
          testCompetitionId2,
          500,
          "eth" as SpecificChain,
          "USDC",
        );
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId2,
          usdcAddress,
          testCompetitionId1,
          2000,
          "eth" as SpecificChain,
          "USDC",
        );
        await repository.incrementBalanceInTransaction(
          tx,
          testAgentId2,
          wethAddress,
          testCompetitionId2,
          10,
          "eth" as SpecificChain,
          "WETH",
        );
      });

      // Verify competition1 state
      const comp1Agent1 = await repository.getAgentBalances(
        testAgentId1,
        testCompetitionId1,
      );
      expect(comp1Agent1).toHaveLength(2);

      const comp1Agent2 = await repository.getAgentBalances(
        testAgentId2,
        testCompetitionId1,
      );
      expect(comp1Agent2).toHaveLength(1);
      expect(comp1Agent2[0]?.amount).toBe(2000);

      // Verify competition2 state
      const comp2Agent1 = await repository.getAgentBalances(
        testAgentId1,
        testCompetitionId2,
      );
      expect(comp2Agent1).toHaveLength(1);
      expect(comp2Agent1[0]?.amount).toBe(500);

      const comp2Agent2 = await repository.getAgentBalances(
        testAgentId2,
        testCompetitionId2,
      );
      expect(comp2Agent2).toHaveLength(1);
      expect(comp2Agent2[0]?.amount).toBe(10);

      // Verify total count
      const totalCount = await repository.count();
      expect(totalCount).toBe(5);
    });

    test("should maintain consistency across concurrent operations in different competitions", async () => {
      const usdcAddress = specificChainTokens.eth.USDC;

      // Concurrent operations in different competitions
      await Promise.all([
        db.transaction(async (tx) => {
          await repository.incrementBalanceInTransaction(
            tx,
            testAgentId1,
            usdcAddress,
            testCompetitionId1,
            1000,
            "eth" as SpecificChain,
            "USDC",
          );
        }),
        db.transaction(async (tx) => {
          await repository.incrementBalanceInTransaction(
            tx,
            testAgentId1,
            usdcAddress,
            testCompetitionId2,
            500,
            "eth" as SpecificChain,
            "USDC",
          );
        }),
      ]);

      // Verify both succeeded independently
      const comp1Balance = await repository.getBalance(
        testAgentId1,
        usdcAddress,
        testCompetitionId1,
      );
      const comp2Balance = await repository.getBalance(
        testAgentId1,
        usdcAddress,
        testCompetitionId2,
      );

      expect(comp1Balance?.amount).toBe(1000);
      expect(comp2Balance?.amount).toBe(500);
    });
  });
});
