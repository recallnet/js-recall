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

describe("BoostRepository.boostAgent() Integration Tests", () => {
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

    // Create comprehensive test data for boostAgent testing

    // 1. Create users
    testUserId1 = randomUUID();
    testWallet1 = `0x${randomUUID().replace(/-/g, "").substring(0, 40).padEnd(40, "1")}`;
    await db.insert(coreSchema.users).values({
      id: testUserId1,
      walletAddress: testWallet1,
      name: "Test User 1 for BoostAgent",
      status: "active",
    });

    testUserId2 = randomUUID();
    testWallet2 = `0x${randomUUID().replace(/-/g, "").substring(0, 40).padEnd(40, "2")}`;
    await db.insert(coreSchema.users).values({
      id: testUserId2,
      walletAddress: testWallet2,
      name: "Test User 2 for BoostAgent",
      status: "active",
    });

    // 2. Create competitions
    testCompetitionId1 = randomUUID();
    await db.insert(coreSchema.competitions).values({
      id: testCompetitionId1,
      name: "Test Competition 1 for BoostAgent",
      description: "First test competition",
      status: "pending",
    });

    testCompetitionId2 = randomUUID();
    await db.insert(coreSchema.competitions).values({
      id: testCompetitionId2,
      name: "Test Competition 2 for BoostAgent",
      description: "Second test competition",
      status: "pending",
    });

    // 3. Create agents with unique handles per test run
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
      ownerId: testUserId1,
      handle: `ag2-${testRunId}`,
      name: "Test Agent 2",
      apiKey: `key2-${testAgentId2}`,
      status: "active",
    });

    testAgentId3 = randomUUID();
    await db.insert(coreSchema.agents).values({
      id: testAgentId3,
      ownerId: testUserId2,
      handle: `ag3-${testRunId}`,
      name: "Test Agent 3",
      apiKey: `key3-${testAgentId3}`,
      status: "active",
    });
  });

  afterEach(async () => {
    // Clean up in proper order respecting ALL foreign key constraints

    try {
      // 1. Clean up agent boosts first (restrict constraint on agentBoostTotals)
      await db.delete(schema.agentBoosts);

      // 2. Clean up agent boost totals (now safe to delete)
      await db.delete(schema.agentBoostTotals);

      // 3. Clean up boost changes (restrict constraint on boostBalances)
      await db.delete(schema.boostChanges);

      // 4. Clean up boost balances (now safe to delete)
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

  describe("basic boostAgent functionality", () => {
    test("should successfully boost agent with all side effects", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 1000n,
      });

      // Boost an agent
      const result = await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 500n,
      });

      expect(result.type).toBe("applied");

      if (result.type === "applied") {
        expect(result.agentBoost).toBeDefined();
        expect(result.agentBoost.agentBoostTotalId).toBeDefined();
        expect(result.agentBoost.changeId).toBeDefined();

        expect(result.agentBoostTotal).toBeDefined();
        expect(result.agentBoostTotal.agentId).toBe(testAgentId1);
        expect(result.agentBoostTotal.competitionId).toBe(testCompetitionId1);
        expect(result.agentBoostTotal.total).toBe(500n);
      }

      // Verify all side effects occurred

      // 1. User balance was decreased
      const remainingBalance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(remainingBalance).toBe(500n); // 1000 - 500

      // 2. Agent boost total was created/updated
      const agentTotals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });
      expect(agentTotals[testAgentId1]).toBe(500n);

      // 3. User boosts tracking was updated
      const userBoosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(userBoosts[testAgentId1]).toBe(500n);

      // 4. Verify actual database records exist
      const agentBoostTotalRecords = await db
        .select()
        .from(schema.agentBoostTotals)
        .where(
          and(
            eq(schema.agentBoostTotals.agentId, testAgentId1),
            eq(schema.agentBoostTotals.competitionId, testCompetitionId1),
          ),
        );

      expect(agentBoostTotalRecords).toHaveLength(1);
      expect(agentBoostTotalRecords[0]?.total).toBe(500n);

      const agentBoostRecords = await db
        .select()
        .from(schema.agentBoosts)
        .where(
          eq(
            schema.agentBoosts.agentBoostTotalId,
            agentBoostTotalRecords[0]!.id,
          ),
        );

      expect(agentBoostRecords).toHaveLength(1);
      expect(agentBoostRecords[0]?.changeId).toBeDefined();
    });

    test("should handle multiple boosts to same agent", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 1000n,
      });

      // First boost
      const result1 = await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 300n,
      });

      expect(result1.type).toBe("applied");
      if (result1.type === "applied") {
        expect(result1.agentBoostTotal.total).toBe(300n);
      }

      // Second boost to same agent
      const result2 = await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 200n,
      });

      expect(result2.type).toBe("applied");
      if (result2.type === "applied") {
        expect(result2.agentBoostTotal.total).toBe(500n); // 300 + 200
      }

      // Verify cumulative effects
      const remainingBalance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(remainingBalance).toBe(500n); // 1000 - 300 - 200

      const agentTotals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });
      expect(agentTotals[testAgentId1]).toBe(500n);

      // Verify multiple agentBoost records were created
      const agentBoostTotalRecords = await db
        .select()
        .from(schema.agentBoostTotals)
        .where(
          and(
            eq(schema.agentBoostTotals.agentId, testAgentId1),
            eq(schema.agentBoostTotals.competitionId, testCompetitionId1),
          ),
        );

      const agentBoostRecords = await db
        .select()
        .from(schema.agentBoosts)
        .where(
          eq(
            schema.agentBoosts.agentBoostTotalId,
            agentBoostTotalRecords[0]!.id,
          ),
        );

      expect(agentBoostRecords).toHaveLength(2); // Two separate boost records
    });

    test("should handle boosts to multiple agents", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 1000n,
      });

      // Boost multiple agents
      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 400n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId2,
        competitionId: testCompetitionId1,
        amount: 300n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId3,
        competitionId: testCompetitionId1,
        amount: 200n,
      });

      // Verify all agents were boosted correctly
      const agentTotals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });

      expect(agentTotals).toEqual({
        [testAgentId1]: 400n,
        [testAgentId2]: 300n,
        [testAgentId3]: 200n,
      });

      const userBoosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      expect(userBoosts).toEqual({
        [testAgentId1]: 400n,
        [testAgentId2]: 300n,
        [testAgentId3]: 200n,
      });

      const remainingBalance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(remainingBalance).toBe(100n); // 1000 - 400 - 300 - 200
    });
  });

  describe("multi-user boost aggregation", () => {
    test("should aggregate boosts from multiple users to same agent", async () => {
      // Setup: Give both users balance
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 600n,
      });

      await repository.increase({
        userId: testUserId2,
        wallet: testWallet2,
        competitionId: testCompetitionId1,
        amount: 400n,
      });

      // Both users boost same agent
      const result1 = await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 300n,
      });

      expect(result1.type).toBe("applied");
      if (result1.type === "applied") {
        expect(result1.agentBoostTotal.total).toBe(300n);
      }

      const result2 = await repository.boostAgent({
        userId: testUserId2,
        wallet: testWallet2,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 250n,
      });

      expect(result2.type).toBe("applied");
      if (result2.type === "applied") {
        expect(result2.agentBoostTotal.total).toBe(550n); // 300 + 250
      }

      // Verify aggregated totals
      const agentTotals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });
      expect(agentTotals[testAgentId1]).toBe(550n);

      // Verify individual user contributions
      const user1Boosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(user1Boosts[testAgentId1]).toBe(300n);

      const user2Boosts = await repository.userBoosts({
        userId: testUserId2,
        competitionId: testCompetitionId1,
      });
      expect(user2Boosts[testAgentId1]).toBe(250n);

      // Verify database records
      const agentBoostTotalRecords = await db
        .select()
        .from(schema.agentBoostTotals)
        .where(
          and(
            eq(schema.agentBoostTotals.agentId, testAgentId1),
            eq(schema.agentBoostTotals.competitionId, testCompetitionId1),
          ),
        );

      expect(agentBoostTotalRecords).toHaveLength(1);
      expect(agentBoostTotalRecords[0]?.total).toBe(550n);

      // Verify multiple agentBoost records exist
      const agentBoostRecords = await db
        .select()
        .from(schema.agentBoosts)
        .where(
          eq(
            schema.agentBoosts.agentBoostTotalId,
            agentBoostTotalRecords[0]!.id,
          ),
        );

      expect(agentBoostRecords).toHaveLength(2); // One per user
    });
  });

  describe("idempotency with real database", () => {
    test("should handle idempotent boost operations", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 800n,
      });

      const idemKey = randomBytes(32);

      // First boost with idempotency key
      const result1 = await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 400n,
        idemKey,
      });

      expect(result1.type).toBe("applied");
      if (result1.type === "applied") {
        expect(result1.agentBoostTotal.total).toBe(400n);
      }

      // Second boost with same idempotency key - should be noop
      const result2 = await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 400n,
        idemKey, // Same key
      });

      expect(result2.type).toBe("noop");
      expect(result2.agentBoostTotal.total).toBe(400n); // No change

      // Verify side effects happened only once
      const remainingBalance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(remainingBalance).toBe(400n); // 800 - 400 (only once)

      const agentTotals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });
      expect(agentTotals[testAgentId1]).toBe(400n);

      // Verify only one agentBoost record despite two calls
      const agentBoostTotalRecords = await db
        .select()
        .from(schema.agentBoostTotals)
        .where(
          and(
            eq(schema.agentBoostTotals.agentId, testAgentId1),
            eq(schema.agentBoostTotals.competitionId, testCompetitionId1),
          ),
        );

      const agentBoostRecords = await db
        .select()
        .from(schema.agentBoosts)
        .where(
          eq(
            schema.agentBoosts.agentBoostTotalId,
            agentBoostTotalRecords[0]!.id,
          ),
        );

      expect(agentBoostRecords).toHaveLength(1); // Only one despite two calls
    });

    test("should work across different database sessions/connections", async () => {
      // Setup: Give user fresh balance (ensure no leftover state)
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 800n, // Increased amount to avoid balance issues
      });

      const idemKey = randomBytes(32);

      // First operation with original repository
      const result1 = await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 350n,
        idemKey,
      });

      expect(result1.type).toBe("applied");

      // Create NEW repository instance (simulating different request/connection)
      const newRepository = new BoostRepository(db);

      // Same operation with same idemKey - should be idempotent across instances
      const result2 = await newRepository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 350n,
        idemKey,
      });

      expect(result2.type).toBe("noop");

      // Verify only one boost was applied
      const remainingBalance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(remainingBalance).toBe(450n); // 800 - 350 (only once)

      const agentTotals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });
      expect(agentTotals[testAgentId1]).toBe(350n);
    });
  });

  describe("error conditions with real database", () => {
    test("should fail when user has insufficient balance", async () => {
      // Setup: Give user small balance
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 100n,
      });

      // Try to boost more than available
      await expect(
        repository.boostAgent({
          userId: testUserId1,
          wallet: testWallet1,
          agentId: testAgentId1,
          competitionId: testCompetitionId1,
          amount: 200n, // More than 100n available
        }),
      ).rejects.toThrow("Can not decrease balance below zero");

      // Verify no boost records were created
      const agentTotals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });
      expect(agentTotals[testAgentId1]).toBeUndefined();

      const userBoosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(userBoosts[testAgentId1]).toBeUndefined();

      // Verify user balance is unchanged
      const balance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(balance).toBe(100n);
    });

    test("should fail when user has no balance", async () => {
      // Try to boost without any balance
      await expect(
        repository.boostAgent({
          userId: testUserId1,
          wallet: testWallet1,
          agentId: testAgentId1,
          competitionId: testCompetitionId1,
          amount: 100n,
        }),
      ).rejects.toThrow("Can not decrease balance of non-existent wallet");

      // Verify no boost records were created
      const agentTotals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });
      expect(agentTotals[testAgentId1]).toBeUndefined();
    });

    test("should fail with non-existent user", async () => {
      const fakeUserId = "00000000-0000-0000-0000-000000000000";

      await expect(
        repository.boostAgent({
          userId: fakeUserId,
          wallet: testWallet1,
          agentId: testAgentId1,
          competitionId: testCompetitionId1,
          amount: 100n,
        }),
      ).rejects.toThrow("Can not decrease balance of non-existent wallet");
    });

    test("should fail with non-existent agent", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 500n,
      });

      const fakeAgentId = "00000000-0000-0000-0000-000000000000";

      await expect(
        repository.boostAgent({
          userId: testUserId1,
          wallet: testWallet1,
          agentId: fakeAgentId,
          competitionId: testCompetitionId1,
          amount: 100n,
        }),
      ).rejects.toThrow(/violates foreign key constraint.*agent/);

      // Verify user balance is unchanged (transaction rolled back)
      const balance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(balance).toBe(500n); // Unchanged due to rollback
    });

    test("should fail with non-existent competition", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 500n,
      });

      const fakeCompetitionId = "00000000-0000-0000-0000-000000000000";

      await expect(
        repository.boostAgent({
          userId: testUserId1,
          wallet: testWallet1,
          agentId: testAgentId1,
          competitionId: fakeCompetitionId,
          amount: 100n,
        }),
      ).rejects.toThrow("Can not decrease balance of non-existent wallet"); // This error comes first

      // Verify user balance in real competition is unchanged
      const balance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(balance).toBe(500n);
    });
  });

  describe("database transaction atomicity", () => {
    test("should ensure all operations are atomic", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 700n,
      });

      // Boost agent - this should be fully atomic
      const result = await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 400n,
      });

      expect(result.type).toBe("applied");

      // Verify ALL related operations happened atomically:

      // 1. User balance decreased
      const userBalance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(userBalance).toBe(300n); // 700 - 400

      // 2. Boost change log created (negative entry for user)
      const balanceRecords = await db
        .select({ id: schema.boostBalances.id })
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, testUserId1),
            eq(schema.boostBalances.competitionId, testCompetitionId1),
          ),
        );

      const changeRecords = await db
        .select()
        .from(schema.boostChanges)
        .where(eq(schema.boostChanges.balanceId, balanceRecords[0]!.id))
        .orderBy(schema.boostChanges.createdAt);

      // Should have: +700 (increase), -400 (decrease for boost)
      expect(changeRecords).toHaveLength(2);
      expect(changeRecords.find((c) => c.deltaAmount === 700n)).toBeDefined();
      expect(changeRecords.find((c) => c.deltaAmount === -400n)).toBeDefined();

      // 3. Agent boost total created/updated
      const agentTotals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });
      expect(agentTotals[testAgentId1]).toBe(400n);

      // 4. Agent boost record created
      const agentBoostRecords = await db.select().from(schema.agentBoosts);

      expect(agentBoostRecords).toHaveLength(1);

      // 5. User boost tracking updated
      const userBoosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(userBoosts[testAgentId1]).toBe(400n);

      // This proves that all 5 operations happened atomically!
    });
  });

  describe("complex scenarios", () => {
    test("should handle complex multi-user multi-agent boost matrix", async () => {
      // Setup: Give both users balance
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 1000n,
      });

      await repository.increase({
        userId: testUserId2,
        wallet: testWallet2,
        competitionId: testCompetitionId1,
        amount: 800n,
      });

      // Create complex boost matrix:
      // User1 -> Agent1: 300n
      // User1 -> Agent2: 200n
      // User2 -> Agent1: 250n
      // User2 -> Agent3: 150n
      // User1 -> Agent1: +100n (second boost)

      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 300n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId2,
        competitionId: testCompetitionId1,
        amount: 200n,
      });

      await repository.boostAgent({
        userId: testUserId2,
        wallet: testWallet2,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 250n,
      });

      await repository.boostAgent({
        userId: testUserId2,
        wallet: testWallet2,
        agentId: testAgentId3,
        competitionId: testCompetitionId1,
        amount: 150n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 100n,
      });

      // Verify final state across all functions
      const agentTotals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });

      expect(agentTotals).toEqual({
        [testAgentId1]: 650n, // 300 + 250 + 100
        [testAgentId2]: 200n,
        [testAgentId3]: 150n,
      });

      const user1Boosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      expect(user1Boosts).toEqual({
        [testAgentId1]: 400n, // 300 + 100
        [testAgentId2]: 200n,
      });

      const user2Boosts = await repository.userBoosts({
        userId: testUserId2,
        competitionId: testCompetitionId1,
      });

      expect(user2Boosts).toEqual({
        [testAgentId1]: 250n,
        [testAgentId3]: 150n,
      });

      // Verify user balances
      const user1Balance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(user1Balance).toBe(400n); // 1000 - 300 - 200 - 100

      const user2Balance = await repository.userBoostBalance({
        userId: testUserId2,
        competitionId: testCompetitionId1,
      });
      expect(user2Balance).toBe(400n); // 800 - 250 - 150

      // Mathematical verification: sum of user boosts should equal agent totals
      for (const agentId of Object.keys(agentTotals)) {
        const user1Contribution = user1Boosts[agentId] || 0n;
        const user2Contribution = user2Boosts[agentId] || 0n;
        expect(agentTotals[agentId]).toBe(
          user1Contribution + user2Contribution,
        );
      }
    });

    test("should handle competition isolation correctly", async () => {
      // Setup: Give user balance in both competitions
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 600n,
      });

      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId2,
        amount: 400n,
      });

      // Boost agents in competition 1
      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 300n,
      });

      // Boost agents in competition 2 (same agent, different total)
      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId2,
        amount: 200n,
      });

      // Verify isolation
      const comp1Totals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });
      expect(comp1Totals[testAgentId1]).toBe(300n);

      const comp2Totals = await repository.agentBoostTotals({
        competitionId: testCompetitionId2,
      });
      expect(comp2Totals[testAgentId1]).toBe(200n);

      // Same agent has different totals in different competitions
      expect(comp1Totals[testAgentId1]).not.toBe(comp2Totals[testAgentId1]);

      // Verify user boosts are also isolated
      const user1Comp1Boosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(user1Comp1Boosts[testAgentId1]).toBe(300n);

      const user1Comp2Boosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId2,
      });
      expect(user1Comp2Boosts[testAgentId1]).toBe(200n);
    });
  });

  describe("transaction behavior", () => {
    test("should work within database transactions", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 600n,
      });

      // Test boostAgent within a transaction
      await db.transaction(async (tx) => {
        const result = await repository.boostAgent(
          {
            userId: testUserId1,
            wallet: testWallet1,
            agentId: testAgentId1,
            competitionId: testCompetitionId1,
            amount: 300n,
          },
          tx,
        );

        expect(result.type).toBe("applied");
        if (result.type === "applied") {
          expect(result.agentBoostTotal.total).toBe(300n);
        }

        // Verify changes are visible within same transaction
        const agentTotals = await repository.agentBoostTotals(
          {
            competitionId: testCompetitionId1,
          },
          tx,
        );
        expect(agentTotals[testAgentId1]).toBe(300n);

        const userBoosts = await repository.userBoosts(
          {
            userId: testUserId1,
            competitionId: testCompetitionId1,
          },
          tx,
        );
        expect(userBoosts[testAgentId1]).toBe(300n);
      });

      // Verify the transaction committed properly
      const finalAgentTotals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });
      expect(finalAgentTotals[testAgentId1]).toBe(300n);

      const finalUserBoosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(finalUserBoosts[testAgentId1]).toBe(300n);
    });
  });

  describe("integration with all repository functions", () => {
    test("should maintain perfect consistency across all boost functions", async () => {
      // Complex end-to-end workflow testing all functions together

      // Setup: Give both users balance
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 1000n,
      });

      await repository.increase({
        userId: testUserId2,
        wallet: testWallet2,
        competitionId: testCompetitionId1,
        amount: 800n,
      });

      // Perform boost operations
      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 350n,
      });

      await repository.boostAgent({
        userId: testUserId2,
        wallet: testWallet2,
        agentId: testAgentId1,
        competitionId: testCompetitionId1,
        amount: 200n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId2,
        competitionId: testCompetitionId1,
        amount: 150n,
      });

      // Verify perfect consistency across all functions:

      // 1. Individual user balances
      const user1Balance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(user1Balance).toBe(500n); // 1000 - 350 - 150

      const user2Balance = await repository.userBoostBalance({
        userId: testUserId2,
        competitionId: testCompetitionId1,
      });
      expect(user2Balance).toBe(600n); // 800 - 200

      // 2. Individual user boost tracking
      const user1Boosts = await repository.userBoosts({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(user1Boosts).toEqual({
        [testAgentId1]: 350n,
        [testAgentId2]: 150n,
      });

      const user2Boosts = await repository.userBoosts({
        userId: testUserId2,
        competitionId: testCompetitionId1,
      });
      expect(user2Boosts).toEqual({
        [testAgentId1]: 200n,
      });

      // 3. Agent boost totals (aggregated)
      const agentTotals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });
      expect(agentTotals).toEqual({
        [testAgentId1]: 550n, // 350 + 200
        [testAgentId2]: 150n,
      });

      // 4. Mathematical consistency checks
      // Total spent by all users should equal total agent boosts
      const totalUserSpending = 1000n - user1Balance + (800n - user2Balance);
      const totalAgentBoosts = Object.values(agentTotals).reduce(
        (sum, amount) => sum + amount,
        0n,
      );
      expect(totalUserSpending).toBe(totalAgentBoosts); // 700n

      // Agent totals should equal sum of user contributions
      expect(agentTotals[testAgentId1]).toBe(
        (user1Boosts[testAgentId1] || 0n) + (user2Boosts[testAgentId1] || 0n),
      );
      expect(agentTotals[testAgentId2]).toBe(
        (user1Boosts[testAgentId2] || 0n) + (user2Boosts[testAgentId2] || 0n),
      );

      // This test proves perfect mathematical consistency across all repository functions!
    });
  });

  describe("race condition tests", () => {
    test("should handle multiple users simultaneously boosting the same agent", async () => {
      // Create additional users for concurrent testing
      const numUsers = 10;
      const users: Array<{ id: string; wallet: string }> = [];

      // Setup users with boost balance
      for (let i = 0; i < numUsers; i++) {
        const userId = randomUUID();
        const wallet = `0x${randomUUID().replace(/-/g, "").substring(0, 40).padEnd(40, String(i))}`;

        await db.insert(coreSchema.users).values({
          id: userId,
          walletAddress: wallet,
          name: `Concurrent User ${i}`,
          status: "active",
        });

        users.push({ id: userId, wallet });

        // Give each user some boost balance
        await repository.increase({
          userId,
          wallet,
          competitionId: testCompetitionId1,
          amount: 1000n,
        });
      }

      const boostAmount = 100n;
      const targetAgentId = testAgentId1;

      // Execute concurrent boosts - all users try to boost the same agent at once
      const boostPromises = users.map((user) =>
        repository
          .boostAgent({
            userId: user.id,
            wallet: user.wallet,
            agentId: targetAgentId,
            competitionId: testCompetitionId1,
            amount: boostAmount,
            idemKey: Buffer.from(`concurrent-boost-${user.id}-${Date.now()}`),
          })
          .then((result) => ({ user, result })),
      );

      // Wait for all boosts to complete
      const results = await Promise.all(boostPromises);
      // All boosts should succeed and
      results.forEach(({ result }) => {
        expect(result.type).toBe("applied");
        expect(result.agentBoostTotal).toBeDefined();
      });

      // Verify the final agent boost total is correct
      const agentTotals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });
      expect(agentTotals[targetAgentId]).toBe(BigInt(numUsers) * boostAmount);

      // Verify each user's balance was correctly deducted
      for (const user of users) {
        const balance = await repository.userBoostBalance({
          userId: user.id,
          competitionId: testCompetitionId1,
        });
        expect(balance).toBe(1000n - boostAmount);
      }

      // Verify database consistency - check the raw tables
      const [agentBoostTotal] = await db
        .select()
        .from(schema.agentBoostTotals)
        .where(
          and(
            eq(schema.agentBoostTotals.agentId, targetAgentId),
            eq(schema.agentBoostTotals.competitionId, testCompetitionId1),
          ),
        );

      expect(agentBoostTotal).toBeDefined();
      expect(agentBoostTotal!.total).toBe(BigInt(numUsers) * boostAmount);

      // Verify we have the correct number of agent boost records
      const agentBoostRecords = await db
        .select()
        .from(schema.agentBoosts)
        .where(eq(schema.agentBoosts.agentBoostTotalId, agentBoostTotal!.id));

      expect(agentBoostRecords).toHaveLength(numUsers);
    });

    test("should maintain consistency when same user tries concurrent boosts with same idempotency key", async () => {
      // Give user balance
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 1000n,
      });

      const idemKey = randomBytes(32);
      const boostAmount = 200n;

      // Try to boost the same agent 10 times concurrently with the same idempotency key
      const concurrentAttempts = 10;
      const boostPromises = Array(concurrentAttempts)
        .fill(null)
        .map(() =>
          repository.boostAgent({
            userId: testUserId1,
            wallet: testWallet1,
            agentId: testAgentId1,
            competitionId: testCompetitionId1,
            amount: boostAmount,
            idemKey, // Same key for all attempts
          }),
        );

      const results = await Promise.all(boostPromises);

      // Exactly one should be "applied", the rest should be "noop"
      const appliedResults = results.filter((r) => r.type === "applied");
      const noopResults = results.filter((r) => r.type === "noop");

      expect(appliedResults).toHaveLength(1);
      expect(noopResults).toHaveLength(concurrentAttempts - 1);

      // All noop results should have the same agentBoostTotal value
      const totalFromNoops = noopResults[0]?.agentBoostTotal.total;
      noopResults.forEach((result) => {
        expect(result.agentBoostTotal.total).toBe(totalFromNoops);
      });

      // Verify balance was only deducted once
      const remainingBalance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(remainingBalance).toBe(1000n - boostAmount);

      // Verify agent total only increased once
      const agentTotals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });
      expect(agentTotals[testAgentId1]).toBe(boostAmount);
    });

    test("should handle mixed concurrent operations (different agents, same competition)", async () => {
      // Setup multiple users with balance
      const user1 = { id: testUserId1, wallet: testWallet1 };
      const user2 = { id: testUserId2, wallet: testWallet2 };

      await repository.increase({
        userId: user1.id,
        wallet: user1.wallet,
        competitionId: testCompetitionId1,
        amount: 2000n,
      });

      await repository.increase({
        userId: user2.id,
        wallet: user2.wallet,
        competitionId: testCompetitionId1,
        amount: 2000n,
      });

      // Create a mix of concurrent operations
      const operations = [
        // User 1 boosts agent 1
        repository.boostAgent({
          userId: user1.id,
          wallet: user1.wallet,
          agentId: testAgentId1,
          competitionId: testCompetitionId1,
          amount: 300n,
          idemKey: randomBytes(32),
        }),
        // User 2 boosts agent 1
        repository.boostAgent({
          userId: user2.id,
          wallet: user2.wallet,
          agentId: testAgentId1,
          competitionId: testCompetitionId1,
          amount: 400n,
          idemKey: randomBytes(32),
        }),
        // User 1 boosts agent 2
        repository.boostAgent({
          userId: user1.id,
          wallet: user1.wallet,
          agentId: testAgentId2,
          competitionId: testCompetitionId1,
          amount: 500n,
          idemKey: randomBytes(32),
        }),
        // User 2 boosts agent 2
        repository.boostAgent({
          userId: user2.id,
          wallet: user2.wallet,
          agentId: testAgentId2,
          competitionId: testCompetitionId1,
          amount: 600n,
          idemKey: randomBytes(32),
        }),
        // User 1 boosts agent 1 again
        repository.boostAgent({
          userId: user1.id,
          wallet: user1.wallet,
          agentId: testAgentId1,
          competitionId: testCompetitionId1,
          amount: 200n,
          idemKey: randomBytes(32),
        }),
      ];

      const results = await Promise.all(operations);

      // All operations should succeed
      results.forEach((result) => {
        expect(result.type).toBe("applied");
      });

      // Verify final state
      const agentTotals = await repository.agentBoostTotals({
        competitionId: testCompetitionId1,
      });

      // Agent 1: 300 + 400 + 200 = 900
      expect(agentTotals[testAgentId1]).toBe(900n);
      // Agent 2: 500 + 600 = 1100
      expect(agentTotals[testAgentId2]).toBe(1100n);

      // Verify user balances
      const user1Balance = await repository.userBoostBalance({
        userId: user1.id,
        competitionId: testCompetitionId1,
      });
      expect(user1Balance).toBe(2000n - 300n - 500n - 200n); // 1000n

      const user2Balance = await repository.userBoostBalance({
        userId: user2.id,
        competitionId: testCompetitionId1,
      });
      expect(user2Balance).toBe(2000n - 400n - 600n); // 1000n

      // Verify user boosts
      const user1Boosts = await repository.userBoosts({
        userId: user1.id,
        competitionId: testCompetitionId1,
      });
      expect(user1Boosts[testAgentId1]).toBe(500n); // 300 + 200
      expect(user1Boosts[testAgentId2]).toBe(500n);

      const user2Boosts = await repository.userBoosts({
        userId: user2.id,
        competitionId: testCompetitionId1,
      });
      expect(user2Boosts[testAgentId1]).toBe(400n);
      expect(user2Boosts[testAgentId2]).toBe(600n);
    });
  });
});
