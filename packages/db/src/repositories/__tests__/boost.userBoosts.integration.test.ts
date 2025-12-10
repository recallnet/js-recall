import { eq } from "drizzle-orm";
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

describe("BoostRepository.userBoosts() Integration Tests", () => {
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

    // Create comprehensive test data for userBoosts testing

    // 1. Create users
    testUserId1 = randomUUID();
    testWallet1 = `0x${randomUUID().replace(/-/g, "").substring(0, 40).padEnd(40, "1")}`;
    await db.insert(coreSchema.users).values({
      id: testUserId1,
      walletAddress: testWallet1,
      name: "Test User 1 for UserBoosts",
      status: "active",
    });

    testUserId2 = randomUUID();
    testWallet2 = `0x${randomUUID().replace(/-/g, "").substring(0, 40).padEnd(40, "2")}`;
    await db.insert(coreSchema.users).values({
      id: testUserId2,
      walletAddress: testWallet2,
      name: "Test User 2 for UserBoosts",
      status: "active",
    });

    // 2. Create competitions
    testCompetitionId1 = randomUUID();
    await db.insert(coreSchema.competitions).values({
      id: testCompetitionId1,
      name: "Test Competition 1 for UserBoosts",
      description: "First test competition",
      status: "pending",
    });

    testCompetitionId2 = randomUUID();
    await db.insert(coreSchema.competitions).values({
      id: testCompetitionId2,
      name: "Test Competition 2 for UserBoosts",
      description: "Second test competition",
      status: "pending",
    });

    // 3. Create agents (required for userBoosts)
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
      // 1. Clean up agent boosts first (highest dependency level)
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

  describe("basic userBoosts functionality", () => {
    test("should return empty object when user has no boosts", async () => {
      const userBoosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      expect(userBoosts).toEqual({});
    });

    test("should return user boost totals after boosting agents", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 1000n,
      });

      // Boost agent1
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 300n,
      });

      // Boost agent2
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId2,
        competitionId: testCompetitionId1,
        amount: 200n,
      });

      // Get user boosts
      const userBoosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      expect(userBoosts).toEqual({
        [testAgentId1]: 300n,
        [testAgentId2]: 200n,
      });
    });

    test("should handle multiple boosts to same agent", async () => {
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
        amount: 150n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 100n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 250n,
      });

      // Get user boosts - should sum all boosts to same agent
      const userBoosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      expect(userBoosts).toEqual({
        [testAgentId1]: 500n, // 150 + 100 + 250
      });
    });
  });

  describe("user isolation", () => {
    test("should isolate boosts between different users", async () => {
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

      // User 1 boosts agents
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
        amount: 100n,
      });

      // User 2 boosts agents (different amounts, including same agent)
      await repository.boostAgent({
        userId: testUserId2,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 150n,
      });

      await repository.boostAgent({
        userId: testUserId2,
        agentId: testAgentId3,
        competitionId: testCompetitionId1,
        amount: 250n,
      });

      // Verify user boosts are isolated
      const user1Boosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      expect(user1Boosts).toEqual({
        [testAgentId1]: 200n,
        [testAgentId2]: 100n,
      });

      const user2Boosts = await repository.userBoosts({
        userId: testUserId2,
        competitionId: testCompetitionId1,
      });

      expect(user2Boosts).toEqual({
        [testAgentId1]: 150n,
        [testAgentId3]: 250n,
      });

      // Verify they don't see each other's boosts
      expect(user1Boosts).not.toEqual(user2Boosts);
      expect(user1Boosts[testAgentId3]).toBeUndefined();
      expect(user2Boosts[testAgentId2]).toBeUndefined();
    });

    test("should return empty object for user with no boosts", async () => {
      // User 1 boosts agents
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

      // User 2 has no boosts
      const user2Boosts = await repository.userBoosts({
        userId: testUserId2,
        competitionId: testCompetitionId1,
      });

      expect(user2Boosts).toEqual({});
    });

    test("should return empty object for non-existent user", async () => {
      const fakeUserId = "00000000-0000-0000-0000-000000000000";

      const userBoosts = await repository.userBoosts({
        userId: fakeUserId,
        competitionId: testCompetitionId1,
      });

      expect(userBoosts).toEqual({});
    });
  });

  describe("competition isolation", () => {
    test("should isolate boosts between different competitions", async () => {
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
        amount: 300n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId2,
        competitionId: testCompetitionId1,
        amount: 200n,
      });

      // Boost agents in competition 2 (different amounts)
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId2,
        amount: 150n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId3,
        competitionId: testCompetitionId2,
        amount: 250n,
      });

      // Verify boosts are isolated by competition
      const comp1Boosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      expect(comp1Boosts).toEqual({
        [testAgentId1]: 300n,
        [testAgentId2]: 200n,
      });

      const comp2Boosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId2,
      });

      expect(comp2Boosts).toEqual({
        [testAgentId1]: 150n,
        [testAgentId3]: 250n,
      });

      // Verify they are different
      expect(comp1Boosts).not.toEqual(comp2Boosts);
      expect(comp1Boosts[testAgentId3]).toBeUndefined();
      expect(comp2Boosts[testAgentId2]).toBeUndefined();
    });

    test("should return empty object for non-existent competition", async () => {
      const fakeCompetitionId = "00000000-0000-0000-0000-000000000000";

      const userBoosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: fakeCompetitionId,
      });

      expect(userBoosts).toEqual({});
    });
  });

  describe("complex boost scenarios", () => {
    test("should handle mixed boost amounts accurately", async () => {
      // Setup: Give user large balance
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 2000n,
      });

      // Perform various boost amounts
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 450n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId2,
        competitionId: testCompetitionId1,
        amount: 275n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId3,
        competitionId: testCompetitionId1,
        amount: 125n,
      });

      // Add more to agent1
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 350n,
      });

      const userBoosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      expect(userBoosts).toEqual({
        [testAgentId1]: 800n, // 450 + 350
        [testAgentId2]: 275n,
        [testAgentId3]: 125n,
      });

      // Verify total boosts match what was spent from user balance
      const totalBoosts = Object.values(userBoosts).reduce(
        (sum, amount) => sum + amount,
        0n,
      );
      expect(totalBoosts).toBe(1200n); // 800 + 275 + 125

      // Verify user's remaining balance
      const remainingBalance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(remainingBalance).toBe(800n); // 2000 - 1200
    });

    test("should handle idempotent boost operations correctly", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 1000n,
      });

      const idemKey = randomBytes(32);

      // First boost with idempotency key
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 400n,
        idemKey,
      });

      // Second boost with same idempotency key (should be noop)
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 400n,
        idemKey, // Same key
      });

      // userBoosts should reflect only one boost
      const userBoosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      expect(userBoosts).toEqual({
        [testAgentId1]: 400n, // Only counted once due to idempotency
      });

      // Verify user balance was only decremented once
      const remainingBalance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(remainingBalance).toBe(600n); // 1000 - 400 (only once)
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
        amount: 150n,
      });

      // Get user boosts via repository
      const repoUserBoosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      // Query database directly to verify accuracy
      const dbBoosts = await db
        .select({
          agentId: schema.agentBoostTotals.agentId,
          total: schema.agentBoostTotals.total,
        })
        .from(schema.agentBoostTotals)
        .where(eq(schema.agentBoostTotals.competitionId, testCompetitionId1));

      // Convert to same format as repository result
      const dbUserBoosts = dbBoosts.reduce<Record<string, bigint>>(
        (acc, curr) => {
          return { ...acc, [curr.agentId]: curr.total };
        },
        {},
      );

      // Should match exactly
      expect(repoUserBoosts).toEqual(dbUserBoosts);
      expect(repoUserBoosts).toEqual({
        [testAgentId1]: 350n,
        [testAgentId2]: 150n,
      });
    });

    test("should reflect boost total consistency", async () => {
      // Setup: Multiple users boost same agent
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 500n,
      });

      await repository.increase({
        userId: testUserId2,
        competitionId: testCompetitionId1,
        amount: 300n,
      });

      // Both users boost same agent
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

      // Get individual user boosts
      const user1Boosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      const user2Boosts = await repository.userBoosts({
        userId: testUserId2,
        competitionId: testCompetitionId1,
      });

      expect(user1Boosts[testAgentId1]).toBe(200n);
      expect(user2Boosts[testAgentId1]).toBe(150n);

      // Verify agent total is sum of all user boosts
      const agentTotals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });

      expect(agentTotals[testAgentId1]).toBe(350n); // 200 + 150

      // Verify the math: individual user boosts should sum to agent total
      const user1Total = user1Boosts[testAgentId1] || 0n;
      const user2Total = user2Boosts[testAgentId1] || 0n;
      expect(user1Total + user2Total).toBe(agentTotals[testAgentId1]);
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

      // Test reading userBoosts within a transaction
      await db.transaction(async (tx) => {
        const userBoosts = await repository.userBoosts(
          {
            userId: testUserId1,
            competitionId: testCompetitionId1,
          },
          tx,
        );

        expect(userBoosts).toEqual({
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

        // Read updated boosts within same transaction
        const updatedBoosts = await repository.userBoosts(
          {
            userId: testUserId1,
            competitionId: testCompetitionId1,
          },
          tx,
        );

        expect(updatedBoosts).toEqual({
          [testAgentId1]: 300n,
          [testAgentId2]: 150n,
        });
      });

      // Verify the transaction committed properly
      const finalBoosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      expect(finalBoosts).toEqual({
        [testAgentId1]: 300n,
        [testAgentId2]: 150n,
      });
    });
  });

  describe("edge cases and boundary conditions", () => {
    test("should handle large numbers correctly", async () => {
      // Setup: Give user large balance
      const largeAmount = 999999999999999999n; // Very large amount
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

      const userBoosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      expect(userBoosts[testAgentId1]).toBe(boostAmount);
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

      // Call userBoosts multiple times
      const boosts1 = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      const boosts2 = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      const boosts3 = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      // All calls should return identical results
      expect(boosts1).toEqual(boosts2);
      expect(boosts2).toEqual(boosts3);
      expect(boosts1).toEqual({
        [testAgentId1]: 200n,
        [testAgentId2]: 150n,
      });
    });
  });

  describe("integration with other functions", () => {
    test("should work correctly after complex increase/decrease/boost cycles", async () => {
      // Complex scenario: increases, decreases, and boosts

      // Start with balance
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 1000n,
      });

      // Boost an agent
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 300n,
      });

      // Add more balance
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 500n,
      });

      // Boost another agent
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId2,
        competitionId: testCompetitionId1,
        amount: 200n,
      });

      // Boost first agent again
      await repository.boostAgent({
        userId: testUserId1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 150n,
      });

      // Verify userBoosts reflects all boost operations
      const userBoosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      expect(userBoosts).toEqual({
        [testAgentId1]: 450n, // 300 + 150
        [testAgentId2]: 200n,
      });

      // Verify totals are consistent
      const totalBoosts = Object.values(userBoosts).reduce(
        (sum, amount) => sum + amount,
        0n,
      );
      expect(totalBoosts).toBe(650n); // 450 + 200

      // Verify remaining balance
      const remainingBalance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(remainingBalance).toBe(850n); // (1000 + 500) - 650
    });
  });
});
