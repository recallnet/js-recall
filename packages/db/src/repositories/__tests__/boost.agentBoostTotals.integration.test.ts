import { and, eq } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import * as schema from "../../schema/boost/defs.js";
import * as coreSchema from "../../schema/core/defs.js";
import { dropAllSchemas } from "../../utils/drop-all-schemas.js";
import { pushSchema } from "../../utils/push-schema.js";
import { BoostRepository } from "../boost.js";
import { db } from "./db.js";

describe("BoostRepository.agentBoostTotals() Integration Tests", () => {
  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  let repository: BoostRepository;
  let testUserId1: string;
  let testUserId2: string;
  let testCompetitionId1: string;
  let testCompetitionId2: string;
  let testWallet1: string;
  let testWallet2: string;
  let testAgentId1: string;
  let testAgentId2: string;
  let testAgentId3: string;

  beforeEach(async () => {
    repository = new BoostRepository(db);

    // Create comprehensive test data for agentBoostTotals testing

    // 1. Create users
    testUserId1 = randomUUID();
    testWallet1 = `0x${randomUUID().replace(/-/g, "").substring(0, 40).padEnd(40, "1")}`;
    await db.insert(coreSchema.users).values({
      id: testUserId1,
      walletAddress: testWallet1,
      name: "Test User 1 for AgentBoostTotals",
      status: "active",
    });

    testUserId2 = randomUUID();
    testWallet2 = `0x${randomUUID().replace(/-/g, "").substring(0, 40).padEnd(40, "2")}`;
    await db.insert(coreSchema.users).values({
      id: testUserId2,
      walletAddress: testWallet2,
      name: "Test User 2 for AgentBoostTotals",
      status: "active",
    });

    // 2. Create competitions
    testCompetitionId1 = randomUUID();
    await db.insert(coreSchema.competitions).values({
      id: testCompetitionId1,
      name: "Test Competition 1 for AgentBoostTotals",
      description: "First test competition",
      status: "pending",
    });

    testCompetitionId2 = randomUUID();
    await db.insert(coreSchema.competitions).values({
      id: testCompetitionId2,
      name: "Test Competition 2 for AgentBoostTotals",
      description: "Second test competition",
      status: "pending",
    });

    // 3. Create agents (required for agentBoostTotals)
    testAgentId1 = randomUUID();
    await db.insert(coreSchema.agents).values({
      id: testAgentId1,
      ownerId: testUserId1,
      handle: "agent1",
      name: "Test Agent 1",
      apiKey: `key1-${testAgentId1}`,
      status: "active",
    });

    testAgentId2 = randomUUID();
    await db.insert(coreSchema.agents).values({
      id: testAgentId2,
      ownerId: testUserId1,
      handle: "agent2",
      name: "Test Agent 2",
      apiKey: `key2-${testAgentId2}`,
      status: "active",
    });

    testAgentId3 = randomUUID();
    await db.insert(coreSchema.agents).values({
      id: testAgentId3,
      ownerId: testUserId2,
      handle: "agent3",
      name: "Test Agent 3",
      apiKey: `key3-${testAgentId3}`,
      status: "active",
    });
  });

  afterEach(async () => {
    // Clean up in proper order to respect foreign key constraints

    try {
      // 1. Clean up agent boosts first (restrict constraint on agentBoostTotals)
      await db.delete(schema.agentBoosts);

      // 2. Clean up agent boost totals
      await db.delete(schema.agentBoostTotals);

      // 3. Clean up boost changes
      await db.delete(schema.boostChanges);

      // 4. Clean up boost balances
      await db.delete(schema.boostBalances);

      // 5. Clean up agents
      await db
        .delete(coreSchema.agents)
        .where(eq(coreSchema.agents.ownerId, testUserId1));

      await db
        .delete(coreSchema.agents)
        .where(eq(coreSchema.agents.ownerId, testUserId2));

      // 6. Clean up competitions
      await db
        .delete(coreSchema.competitions)
        .where(eq(coreSchema.competitions.id, testCompetitionId1));

      await db
        .delete(coreSchema.competitions)
        .where(eq(coreSchema.competitions.id, testCompetitionId2));

      // 7. Clean up users
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

  describe("basic agentBoostTotals functionality", () => {
    test("should return empty object when no agents have been boosted", async () => {
      const totals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });

      expect(totals).toEqual({});
    });

    test("should return correct totals after single agent boost", async () => {
      // Setup: Give user balance and boost one agent
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 500n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 300n,
      });

      const totals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });

      expect(totals).toEqual({
        [testAgentId1]: 300n,
      });
    });

    test("should return correct totals after multiple agent boosts", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 1000n,
      });

      // Boost multiple agents
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 400n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId2,
        competitionId: testCompetitionId1,
        amount: 250n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId3,
        competitionId: testCompetitionId1,
        amount: 150n,
      });

      const totals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });

      expect(totals).toEqual({
        [testAgentId1]: 400n,
        [testAgentId2]: 250n,
        [testAgentId3]: 150n,
      });
    });

    test("should aggregate multiple boosts to same agent", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 1000n,
      });

      // Boost same agent multiple times
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 200n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 150n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 300n,
      });

      const totals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });

      expect(totals).toEqual({
        [testAgentId1]: 650n, // 200 + 150 + 300
      });
    });
  });

  describe("multi-user boost aggregation", () => {
    test("should aggregate boosts from multiple users to same agent", async () => {
      // Setup: Give both users balance
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 600n,
      });

      await repository.increase({
        userId: testUserId2,
        competitionId: testCompetitionId1,
        amount: 400n,
      });

      // Both users boost same agent
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 250n,
      });

      await repository.boostAgent({
        userId: testUserId2,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 150n,
      });

      // Agent total should be sum of all user boosts
      const totals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });

      expect(totals).toEqual({
        [testAgentId1]: 400n, // 250 + 150
      });
    });

    test("should handle complex multi-user multi-agent scenario", async () => {
      // Setup: Give both users balance
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 1000n,
      });

      await repository.increase({
        userId: testUserId2,
        competitionId: testCompetitionId1,
        amount: 800n,
      });

      // User 1 boosts multiple agents
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 300n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId2,
        competitionId: testCompetitionId1,
        amount: 200n,
      });

      // User 2 boosts agents (some overlap)
      await repository.boostAgent({
        userId: testUserId2,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 250n,
      });

      await repository.boostAgent({
        userId: testUserId2,
        agentId: testAgentId3,
        competitionId: testCompetitionId1,
        amount: 150n,
      });

      // User 1 boosts agent1 again
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 100n,
      });

      const totals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });

      expect(totals).toEqual({
        [testAgentId1]: 650n, // User1: 300+100, User2: 250 = 650
        [testAgentId2]: 200n, // User1: 200
        [testAgentId3]: 150n, // User2: 150
      });

      // Verify totals match individual user contributions
      const user1Boosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      const user2Boosts = await repository.userBoosts({
        userId: testUserId2,
        competitionId: testCompetitionId1,
      });

      // Agent1 total should equal sum of both users' contributions
      expect(totals[testAgentId1]).toBe(
        (user1Boosts[testAgentId1] || 0n) + (user2Boosts[testAgentId1] || 0n),
      );

      // Agent2 total should equal user1's contribution only
      expect(totals[testAgentId2]).toBe(user1Boosts[testAgentId2]);

      // Agent3 total should equal user2's contribution only
      expect(totals[testAgentId3]).toBe(user2Boosts[testAgentId3]);
    });
  });

  describe("competition isolation", () => {
    test("should isolate agent boost totals between competitions", async () => {
      // Setup: Give user balance in both competitions
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 800n,
      });

      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId2,
        amount: 600n,
      });

      // Boost agents in competition 1
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 400n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId2,
        competitionId: testCompetitionId1,
        amount: 300n,
      });

      // Boost agents in competition 2 (different amounts, some same agents)
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId2,
        amount: 200n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId3,
        competitionId: testCompetitionId2,
        amount: 150n,
      });

      // Verify totals are isolated by competition
      const comp1Totals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });

      expect(comp1Totals).toEqual({
        [testAgentId1]: 400n,
        [testAgentId2]: 300n,
      });

      const comp2Totals = await repository.agentBoostTotals({
        competitionId: testCompetitionId2,
      });

      expect(comp2Totals).toEqual({
        [testAgentId1]: 200n,
        [testAgentId3]: 150n,
      });

      // Verify they are different (same agent has different totals in different competitions)
      expect(comp1Totals[testAgentId1]).not.toBe(comp2Totals[testAgentId1]);
      expect(comp2Totals[testAgentId2]).toBeUndefined(); // Agent2 not in comp2
      expect(comp1Totals[testAgentId3]).toBeUndefined(); // Agent3 not in comp1
    });

    test("should return empty object for non-existent competition", async () => {
      const fakeCompetitionId = "00000000-0000-0000-0000-000000000000";

      const totals = await repository.agentBoostTotals({
        competitionId: fakeCompetitionId,
      });

      expect(totals).toEqual({});
    });
  });

  describe("database consistency verification", () => {
    test("should match database records exactly", async () => {
      // Setup: Create boost scenario
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 1000n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 350n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId2,
        competitionId: testCompetitionId1,
        amount: 250n,
      });

      // Get totals via repository
      const repoTotals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });

      // Query database directly to verify accuracy
      const dbTotals = await db
        .select({
          agentId: schema.agentBoostTotals.agentId,
          total: schema.agentBoostTotals.total,
        })
        .from(schema.agentBoostTotals)
        .where(eq(schema.agentBoostTotals.competitionId, testCompetitionId1));

      // Convert to same format as repository result
      const dbTotalsMap = dbTotals.reduce<Record<string, bigint>>(
        (acc, curr) => {
          return { ...acc, [curr.agentId]: curr.total };
        },
        {},
      );

      // Should match exactly
      expect(repoTotals).toEqual(dbTotalsMap);
      expect(repoTotals).toEqual({
        [testAgentId1]: 350n,
        [testAgentId2]: 250n,
      });
    });

    test("should reflect incremental boost updates", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 1000n,
      });

      // Initial boost
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 200n,
      });

      // Check initial total
      let totals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });
      expect(totals[testAgentId1]).toBe(200n);

      // Add more boost to same agent
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 150n,
      });

      // Check updated total
      totals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });
      expect(totals[testAgentId1]).toBe(350n); // 200 + 150

      // Add boost to different agent
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId2,
        competitionId: testCompetitionId1,
        amount: 100n,
      });

      // Check final totals
      totals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });
      expect(totals).toEqual({
        [testAgentId1]: 350n,
        [testAgentId2]: 100n,
      });
    });
  });

  describe("idempotency handling", () => {
    test("should handle idempotent boost operations correctly", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 800n,
      });

      const idemKey = randomBytes(32);

      // First boost with idempotency key
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 300n,
        idemKey,
      });

      // Second boost with same idempotency key (should be noop)
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 300n,
        idemKey, // Same key
      });

      // Agent total should reflect only one boost
      const totals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });

      expect(totals).toEqual({
        [testAgentId1]: 300n, // Only counted once due to idempotency
      });

      // Verify database has only one agent boost total record
      const dbTotals = await db
        .select()
        .from(schema.agentBoostTotals)
        .where(
          and(
            eq(schema.agentBoostTotals.agentId, testAgentId1),
            eq(schema.agentBoostTotals.competitionId, testCompetitionId1),
          ),
        );

      expect(dbTotals).toHaveLength(1);
      expect(dbTotals[0]?.total).toBe(300n);
    });
  });

  describe("cross-user consistency", () => {
    test("should maintain consistency between userBoosts and agentBoostTotals", async () => {
      // Setup: Give both users balance
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 700n,
      });

      await repository.increase({
        userId: testUserId2,
        competitionId: testCompetitionId1,
        amount: 500n,
      });

      // Complex boost scenario
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 300n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId2,
        competitionId: testCompetitionId1,
        amount: 200n,
      });

      await repository.boostAgent({
        userId: testUserId2,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 250n,
      });

      await repository.boostAgent({
        userId: testUserId2,
        agentId: testAgentId3,
        competitionId: testCompetitionId1,
        amount: 150n,
      });

      // Get all perspectives
      const agentTotals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });

      const user1Boosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      const user2Boosts = await repository.userBoosts({
        userId: testUserId2,
        competitionId: testCompetitionId1,
      });

      // Verify consistency: agent totals should equal sum of user contributions
      expect(agentTotals[testAgentId1]).toBe(
        (user1Boosts[testAgentId1] || 0n) + (user2Boosts[testAgentId1] || 0n),
      ); // 300 + 250 = 550

      expect(agentTotals[testAgentId2]).toBe(
        (user1Boosts[testAgentId2] || 0n) + (user2Boosts[testAgentId2] || 0n),
      ); // 200 + 0 = 200

      expect(agentTotals[testAgentId3]).toBe(
        (user1Boosts[testAgentId3] || 0n) + (user2Boosts[testAgentId3] || 0n),
      ); // 0 + 150 = 150

      expect(agentTotals).toEqual({
        [testAgentId1]: 550n,
        [testAgentId2]: 200n,
        [testAgentId3]: 150n,
      });
    });
  });

  describe("transaction behavior", () => {
    test("should work within database transactions", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 600n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 300n,
      });

      // Test reading agentBoostTotals within a transaction
      await db.transaction(async (tx) => {
        const totals = await repository.agentBoostTotals(
          {
            competitionId: testCompetitionId1,
          },
          tx,
        );

        expect(totals).toEqual({
          [testAgentId1]: 300n,
        });

        // Perform another boost within same transaction
        await repository.boostAgent(
          {
            userId: testUserId1,
            agentId: testAgentId2,
            competitionId: testCompetitionId1,
            amount: 150n,
          },
          tx,
        );

        // Read updated totals within same transaction
        const updatedTotals = await repository.agentBoostTotals(
          {
            competitionId: testCompetitionId1,
          },
          tx,
        );

        expect(updatedTotals).toEqual({
          [testAgentId1]: 300n,
          [testAgentId2]: 150n,
        });
      });

      // Verify the transaction committed properly
      const finalTotals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });

      expect(finalTotals).toEqual({
        [testAgentId1]: 300n,
        [testAgentId2]: 150n,
      });
    });
  });

  describe("edge cases and boundary conditions", () => {
    test("should handle agents with zero total correctly", async () => {
      // This scenario shouldn't normally happen, but test defensive behavior
      // Create agent boost total manually with zero (simulating edge case)
      await db.insert(schema.agentBoostTotals).values({
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        total: 0n,
      });

      const totals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });

      expect(totals).toEqual({
        [testAgentId1]: 0n,
      });
    });

    test("should handle large boost amounts", async () => {
      // Setup: Give user very large balance
      const largeAmount = 999999999999999999n;
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: largeAmount,
      });

      // Boost with large amount
      const boostAmount = 123456789012345678n;
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: boostAmount,
      });

      const totals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });

      expect(totals[testAgentId1]).toBe(boostAmount);
    });

    test("should return consistent results across multiple calls", async () => {
      // Setup: Create boost scenario
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 500n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 200n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId2,
        competitionId: testCompetitionId1,
        amount: 150n,
      });

      // Call agentBoostTotals multiple times
      const totals1 = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });

      const totals2 = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });

      const totals3 = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });

      // All calls should return identical results
      expect(totals1).toEqual(totals2);
      expect(totals2).toEqual(totals3);
      expect(totals1).toEqual({
        [testAgentId1]: 200n,
        [testAgentId2]: 150n,
      });
    });
  });

  describe("concurrent access simulation", () => {
    test("should handle concurrent reads correctly", async () => {
      // Setup: Create boost scenario
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 800n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 400n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId2,
        competitionId: testCompetitionId1,
        amount: 300n,
      });

      // Simulate concurrent reads from different repository instances
      const repo1 = new BoostRepository(db);
      const repo2 = new BoostRepository(db);
      const repo3 = new BoostRepository(db);

      const [totals1, totals2, totals3] = await Promise.all([
        repo1.agentBoostTotals({
          competitionId: testCompetitionId1,
        }),
        repo2.agentBoostTotals({
          competitionId: testCompetitionId1,
        }),
        repo3.agentBoostTotals({
          competitionId: testCompetitionId1,
        }),
      ]);

      // All concurrent reads should return the same correct totals
      const expected = {
        [testAgentId1]: 400n,
        [testAgentId2]: 300n,
      };

      expect(totals1).toEqual(expected);
      expect(totals2).toEqual(expected);
      expect(totals3).toEqual(expected);
    });
  });

  describe("integration with other repository functions", () => {
    test("should maintain consistency with userBoosts across operations", async () => {
      // Setup: Multiple users, complex boost scenario
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 600n,
      });

      await repository.increase({
        userId: testUserId2,
        competitionId: testCompetitionId1,
        amount: 400n,
      });

      // Perform various boosts
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 200n,
      });

      await repository.boostAgent({
        userId: testUserId2,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 150n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId2,
        competitionId: testCompetitionId1,
        amount: 100n,
      });

      // Get all perspectives
      const agentTotals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });

      const user1Boosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      const user2Boosts = await repository.userBoosts({
        userId: testUserId2,
        competitionId: testCompetitionId1,
      });

      // Verify mathematical consistency
      // For each agent, total should equal sum of all user contributions
      const agents = [
        ...new Set([
          ...Object.keys(agentTotals),
          ...Object.keys(user1Boosts),
          ...Object.keys(user2Boosts),
        ]),
      ];

      for (const agentId of agents) {
        const totalFromUsers =
          (user1Boosts[agentId] || 0n) + (user2Boosts[agentId] || 0n);
        expect(agentTotals[agentId]).toBe(totalFromUsers);
      }

      // Verify specific values
      expect(agentTotals[testAgentId1]).toBe(350n); // 200 + 150
      expect(agentTotals[testAgentId2]).toBe(100n); // 100 + 0
    });

    test("should work correctly after balance modifications", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 1000n,
      });

      // Initial boost
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 300n,
      });

      // Check initial totals
      let totals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });
      expect(totals[testAgentId1]).toBe(300n);

      // Add more balance to user
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 500n,
      });

      // Boost more
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 200n,
      });

      // Check updated totals
      totals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });
      expect(totals[testAgentId1]).toBe(500n); // 300 + 200

      // Verify user's balance reflects all operations
      const remainingBalance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(remainingBalance).toBe(1000n); // (1000 + 500) - 500 = 1000
    });
  });
});
