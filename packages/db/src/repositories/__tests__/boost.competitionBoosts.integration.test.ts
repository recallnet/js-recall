import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
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

const createWallet = () => {
  return `0x${randomUUID().replace(/-/g, "").substring(0, 40).padEnd(40, "0")}`;
};

describe("BoostRepository.competitionBoosts() Integration Tests", () => {
  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  let repository: BoostRepository;
  let testUserId1: string;
  let testUserId2: string;
  let testCompetitionId: string;
  let testWallet1: string;
  let testWallet2: string;
  let testAgentId1: string;
  let testAgentId2: string;
  let testAgentId3: string;

  beforeEach(async () => {
    repository = new BoostRepository(db);

    // Create users
    testUserId1 = randomUUID();
    testWallet1 = createWallet();
    await db.insert(coreSchema.users).values({
      id: testUserId1,
      walletAddress: testWallet1,
      name: "Test User 1 for CompetitionBoosts",
      status: "active",
    });

    testUserId2 = randomUUID();
    testWallet2 = createWallet();
    await db.insert(coreSchema.users).values({
      id: testUserId2,
      walletAddress: testWallet2,
      name: "Test User 2 for CompetitionBoosts",
      status: "active",
    });

    // Create competition
    testCompetitionId = randomUUID();
    await db.insert(coreSchema.competitions).values({
      id: testCompetitionId,
      name: "Test Competition for CompetitionBoosts",
      description: "Test competition",
      status: "pending",
    });

    // Create agents
    testAgentId1 = randomUUID();
    await db.insert(coreSchema.agents).values({
      id: testAgentId1,
      ownerId: testUserId1,
      handle: "testagent1",
      name: "Test Agent 1",
      apiKey: `key1-${testAgentId1}`,
      status: "active",
    });

    testAgentId2 = randomUUID();
    await db.insert(coreSchema.agents).values({
      id: testAgentId2,
      ownerId: testUserId1,
      handle: "testagent2",
      name: "Test Agent 2",
      apiKey: `key2-${testAgentId2}`,
      status: "active",
    });

    testAgentId3 = randomUUID();
    await db.insert(coreSchema.agents).values({
      id: testAgentId3,
      ownerId: testUserId2,
      handle: "testagent3",
      name: "Test Agent 3",
      apiKey: `key3-${testAgentId3}`,
      status: "active",
    });
  });

  afterEach(async () => {
    try {
      await db.delete(schema.agentBoosts);
      await db.delete(schema.agentBoostTotals);
      await db.delete(schema.boostChanges);
      await db.delete(schema.boostBalances);
      await db
        .delete(coreSchema.agents)
        .where(eq(coreSchema.agents.ownerId, testUserId1));
      await db
        .delete(coreSchema.agents)
        .where(eq(coreSchema.agents.ownerId, testUserId2));
      await db
        .delete(coreSchema.competitions)
        .where(eq(coreSchema.competitions.id, testCompetitionId));
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

  describe("basic competitionBoosts functionality", () => {
    test("should return empty array when no boosts exist", async () => {
      const boosts = await repository.competitionBoosts({
        competitionId: testCompetitionId,
        limit: 50,
        offset: 0,
      });

      expect(boosts).toEqual([]);
    });

    test("should return boost records with agent information", async () => {
      // Setup: Give user balance and boost an agent
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId,
        amount: 500n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId,
        amount: 300n,
      });

      const boosts = await repository.competitionBoosts({
        competitionId: testCompetitionId,
        limit: 50,
        offset: 0,
      });

      expect(boosts).toHaveLength(1);
      expect(boosts[0]).toMatchObject({
        userId: testUserId1,
        agentId: testAgentId1,
        agentName: "Test Agent 1",
        agentHandle: "testagent1",
        amount: 300n,
      });
      expect(boosts[0]?.wallet).toBeInstanceOf(Uint8Array);
      expect(boosts[0]?.createdAt).toBeInstanceOf(Date);
    });

    test("should return multiple boost records in correct order", async () => {
      // Setup: Give users balance
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId,
        amount: 1000n,
      });

      await repository.increase({
        userId: testUserId2,
        wallet: testWallet2,
        competitionId: testCompetitionId,
        amount: 800n,
      });

      // Create boosts with slight delays to ensure different timestamps
      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId,
        amount: 200n,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await repository.boostAgent({
        userId: testUserId2,
        wallet: testWallet2,
        agentId: testAgentId2,
        competitionId: testCompetitionId,
        amount: 150n,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId3,
        competitionId: testCompetitionId,
        amount: 100n,
      });

      const boosts = await repository.competitionBoosts({
        competitionId: testCompetitionId,
        limit: 50,
        offset: 0,
      });

      expect(boosts).toHaveLength(3);

      // Should be ordered by createdAt DESC (most recent first)
      expect(boosts[0]?.amount).toBe(100n); // Last boost
      expect(boosts[1]?.amount).toBe(150n); // Second boost
      expect(boosts[2]?.amount).toBe(200n); // First boost
    });

    test("should convert negative deltaAmount to positive amount", async () => {
      // Setup and boost
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId,
        amount: 500n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId,
        amount: 250n,
      });

      const boosts = await repository.competitionBoosts({
        competitionId: testCompetitionId,
        limit: 50,
        offset: 0,
      });

      // Amount should be positive (negated from negative deltaAmount)
      expect(boosts[0]?.amount).toBe(250n);
      expect(boosts[0]?.amount).toBeGreaterThan(0n);
    });
  });

  describe("pagination functionality", () => {
    beforeEach(async () => {
      // Create 5 boost records for pagination testing
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId,
        amount: 2000n,
      });

      for (let i = 0; i < 5; i++) {
        await repository.boostAgent({
          userId: testUserId1,
          wallet: testWallet1,
          agentId: i % 2 === 0 ? testAgentId1 : testAgentId2,
          competitionId: testCompetitionId,
          amount: 100n * BigInt(i + 1),
        });
        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    });

    test("should respect limit parameter", async () => {
      const boosts = await repository.competitionBoosts({
        competitionId: testCompetitionId,
        limit: 3,
        offset: 0,
      });

      expect(boosts).toHaveLength(3);
    });

    test("should respect offset parameter", async () => {
      const firstPage = await repository.competitionBoosts({
        competitionId: testCompetitionId,
        limit: 2,
        offset: 0,
      });

      const secondPage = await repository.competitionBoosts({
        competitionId: testCompetitionId,
        limit: 2,
        offset: 2,
      });

      expect(firstPage).toHaveLength(2);
      expect(secondPage).toHaveLength(2);

      // Results should be different
      expect(firstPage[0]?.createdAt).not.toEqual(secondPage[0]?.createdAt);
    });

    test("should handle offset beyond available records", async () => {
      const boosts = await repository.competitionBoosts({
        competitionId: testCompetitionId,
        limit: 50,
        offset: 100,
      });

      expect(boosts).toEqual([]);
    });

    test("should return all records when limit exceeds total", async () => {
      const boosts = await repository.competitionBoosts({
        competitionId: testCompetitionId,
        limit: 100,
        offset: 0,
      });

      expect(boosts).toHaveLength(5);
    });
  });

  describe("countCompetitionBoosts functionality", () => {
    test("should return 0 when no boosts exist", async () => {
      const count = await repository.countCompetitionBoosts(testCompetitionId);
      expect(count).toBe(0);
    });

    test("should return correct count for single boost", async () => {
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId,
        amount: 500n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId,
        amount: 300n,
      });

      const count = await repository.countCompetitionBoosts(testCompetitionId);
      expect(count).toBe(1);
    });

    test("should return correct count for multiple boosts", async () => {
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId,
        amount: 2000n,
      });

      // Create 7 boosts
      for (let i = 0; i < 7; i++) {
        await repository.boostAgent({
          userId: testUserId1,
          wallet: testWallet1,
          agentId: i % 3 === 0 ? testAgentId1 : testAgentId2,
          competitionId: testCompetitionId,
          amount: 100n,
        });
      }

      const count = await repository.countCompetitionBoosts(testCompetitionId);
      expect(count).toBe(7);
    });

    test("should match actual boost records count", async () => {
      // Setup: Create multiple boosts
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId,
        amount: 1000n,
      });

      await repository.increase({
        userId: testUserId2,
        wallet: testWallet2,
        competitionId: testCompetitionId,
        amount: 800n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId,
        amount: 200n,
      });

      await repository.boostAgent({
        userId: testUserId2,
        wallet: testWallet2,
        agentId: testAgentId2,
        competitionId: testCompetitionId,
        amount: 150n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId3,
        competitionId: testCompetitionId,
        amount: 100n,
      });

      // Count should match records retrieved
      const count = await repository.countCompetitionBoosts(testCompetitionId);
      const boosts = await repository.competitionBoosts({
        competitionId: testCompetitionId,
        limit: 100,
        offset: 0,
      });

      expect(count).toBe(boosts.length);
      expect(count).toBe(3);
    });
  });

  describe("pagination consistency", () => {
    test("should work correctly with count for pagination", async () => {
      // Setup: Create 10 boost records
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId,
        amount: 5000n,
      });

      for (let i = 0; i < 10; i++) {
        await repository.boostAgent({
          userId: testUserId1,
          wallet: testWallet1,
          agentId: i % 3 === 0 ? testAgentId1 : testAgentId2,
          competitionId: testCompetitionId,
          amount: 100n,
        });
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      const count = await repository.countCompetitionBoosts(testCompetitionId);
      expect(count).toBe(10);

      // Test pagination
      const limit = 4;
      const page1 = await repository.competitionBoosts({
        competitionId: testCompetitionId,
        limit,
        offset: 0,
      });
      const page2 = await repository.competitionBoosts({
        competitionId: testCompetitionId,
        limit,
        offset: 4,
      });
      const page3 = await repository.competitionBoosts({
        competitionId: testCompetitionId,
        limit,
        offset: 8,
      });

      expect(page1).toHaveLength(4);
      expect(page2).toHaveLength(4);
      expect(page3).toHaveLength(2); // Only 2 remaining

      // Total retrieved should match count
      expect(page1.length + page2.length + page3.length).toBe(count);
    });

    test("should calculate hasMore flag correctly", async () => {
      // Setup: Create 5 boost records
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId,
        amount: 2000n,
      });

      for (let i = 0; i < 5; i++) {
        await repository.boostAgent({
          userId: testUserId1,
          wallet: testWallet1,
          agentId: testAgentId1,
          competitionId: testCompetitionId,
          amount: 100n,
        });
      }

      const total = await repository.countCompetitionBoosts(testCompetitionId);
      const limit = 3;
      const offset1 = 0;
      const offset2 = 3;

      const page1 = await repository.competitionBoosts({
        competitionId: testCompetitionId,
        limit,
        offset: offset1,
      });

      const page2 = await repository.competitionBoosts({
        competitionId: testCompetitionId,
        limit,
        offset: offset2,
      });

      // Calculate hasMore as service layer would
      const hasMore1 = offset1 + limit < total;
      const hasMore2 = offset2 + limit < total;

      expect(hasMore1).toBe(true); // 0 + 3 < 5
      expect(page1).toHaveLength(3);

      expect(hasMore2).toBe(false); // 3 + 3 = 6, not < 5
      expect(page2).toHaveLength(2); // Only 2 remaining
    });
  });

  describe("multi-user scenarios", () => {
    test("should include boosts from multiple users", async () => {
      // Setup: Give both users balance
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId,
        amount: 600n,
      });

      await repository.increase({
        userId: testUserId2,
        wallet: testWallet2,
        competitionId: testCompetitionId,
        amount: 400n,
      });

      // Both users boost different agents
      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId,
        amount: 250n,
      });

      await repository.boostAgent({
        userId: testUserId2,
        wallet: testWallet2,
        agentId: testAgentId2,
        competitionId: testCompetitionId,
        amount: 150n,
      });

      const boosts = await repository.competitionBoosts({
        competitionId: testCompetitionId,
        limit: 50,
        offset: 0,
      });

      expect(boosts).toHaveLength(2);

      // Find boosts by userId
      const user1Boost = boosts.find((b) => b.userId === testUserId1);
      const user2Boost = boosts.find((b) => b.userId === testUserId2);

      expect(user1Boost).toBeDefined();
      expect(user2Boost).toBeDefined();
      expect(user1Boost?.amount).toBe(250n);
      expect(user2Boost?.amount).toBe(150n);
    });

    test("should handle same user boosting multiple agents", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId,
        amount: 1000n,
      });

      // Boost three different agents
      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId,
        amount: 300n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId2,
        competitionId: testCompetitionId,
        amount: 200n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId3,
        competitionId: testCompetitionId,
        amount: 100n,
      });

      const boosts = await repository.competitionBoosts({
        competitionId: testCompetitionId,
        limit: 50,
        offset: 0,
      });

      expect(boosts).toHaveLength(3);

      // All should be from same user but different agents
      expect(boosts.every((b) => b.userId === testUserId1)).toBe(true);
      const agentIds = boosts.map((b) => b.agentId);
      expect(agentIds).toContain(testAgentId1);
      expect(agentIds).toContain(testAgentId2);
      expect(agentIds).toContain(testAgentId3);
    });

    test("should handle same user boosting same agent multiple times", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId,
        amount: 1000n,
      });

      // Boost same agent three times
      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId,
        amount: 100n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId,
        amount: 200n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId,
        amount: 150n,
      });

      const boosts = await repository.competitionBoosts({
        competitionId: testCompetitionId,
        limit: 50,
        offset: 0,
      });

      // Should return 3 separate boost records
      expect(boosts).toHaveLength(3);
      expect(boosts.every((b) => b.agentId === testAgentId1)).toBe(true);
      expect(boosts.every((b) => b.userId === testUserId1)).toBe(true);

      // Amounts should be preserved individually
      const amounts = boosts.map((b) => b.amount).sort((a, b) => Number(a - b));
      expect(amounts).toEqual([100n, 150n, 200n]);
    });
  });

  describe("data integrity", () => {
    test("should only include spending records, not credits", async () => {
      // Give user initial balance (this is a credit, deltaAmount > 0)
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId,
        amount: 500n,
      });

      // Boost (this is spending, deltaAmount < 0)
      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId,
        amount: 300n,
      });

      const boosts = await repository.competitionBoosts({
        competitionId: testCompetitionId,
        limit: 50,
        offset: 0,
      });

      // Should only return the boost (spending), not the initial credit
      expect(boosts).toHaveLength(1);
      expect(boosts[0]?.amount).toBe(300n);
    });

    test("should include agent information for all boosts", async () => {
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId,
        amount: 1000n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId,
        amount: 200n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId2,
        competitionId: testCompetitionId,
        amount: 150n,
      });

      const boosts = await repository.competitionBoosts({
        competitionId: testCompetitionId,
        limit: 50,
        offset: 0,
      });

      // Verify all boosts have agent information
      expect(boosts).toHaveLength(2);
      boosts.forEach((boost) => {
        expect(boost.agentName).toBeTruthy();
        expect(boost.agentHandle).toBeTruthy();
        expect(boost.agentName).toMatch(/Test Agent [1-3]/);
        expect(boost.agentHandle).toMatch(/testagent[1-3]/);
      });
    });
  });

  describe("transaction support", () => {
    test("should work within database transactions", async () => {
      // Setup boosts outside transaction
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId,
        amount: 500n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId,
        amount: 300n,
      });

      // Test reading within transaction
      await db.transaction(async (tx) => {
        const boosts = await repository.competitionBoosts(
          {
            competitionId: testCompetitionId,
            limit: 50,
            offset: 0,
          },
          tx,
        );

        expect(boosts).toHaveLength(1);
        expect(boosts[0]?.amount).toBe(300n);

        const count = await repository.countCompetitionBoosts(
          testCompetitionId,
          tx,
        );
        expect(count).toBe(1);
      });
    });
  });

  describe("edge cases", () => {
    test("should handle non-existent competition", async () => {
      const fakeCompetitionId = "00000000-0000-0000-0000-000000000000";

      const boosts = await repository.competitionBoosts({
        competitionId: fakeCompetitionId,
        limit: 50,
        offset: 0,
      });

      const count = await repository.countCompetitionBoosts(fakeCompetitionId);

      expect(boosts).toEqual([]);
      expect(count).toBe(0);
    });

    test("should handle limit of 1 correctly", async () => {
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId,
        amount: 500n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId,
        amount: 100n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId2,
        competitionId: testCompetitionId,
        amount: 150n,
      });

      const boosts = await repository.competitionBoosts({
        competitionId: testCompetitionId,
        limit: 1,
        offset: 0,
      });

      expect(boosts).toHaveLength(1);
    });

    test("should handle large offset correctly", async () => {
      await repository.increase({
        userId: testUserId1,
        wallet: testWallet1,
        competitionId: testCompetitionId,
        amount: 500n,
      });

      await repository.boostAgent({
        userId: testUserId1,
        wallet: testWallet1,
        agentId: testAgentId1,
        competitionId: testCompetitionId,
        amount: 200n,
      });

      const boosts = await repository.competitionBoosts({
        competitionId: testCompetitionId,
        limit: 50,
        offset: 1000,
      });

      expect(boosts).toEqual([]);
    });
  });
});
