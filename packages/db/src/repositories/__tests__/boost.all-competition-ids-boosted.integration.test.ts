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

describe("BoostRepository getAllCompetitionIdsBoostedDuringSeason Integration Tests", () => {
  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  let repository: BoostRepository;

  // Test users
  let user1Id: string;
  let user2Id: string;
  let user3Id: string;
  let wallet1: string;
  let wallet2: string;
  let wallet3: string;

  // Test competitions
  let competition1Id: string;
  let competition2Id: string;
  let competition3Id: string;

  // Test agents
  let agent1Id: string;
  let agent2Id: string;

  // Date window for tests
  const seasonStart = new Date("2025-01-01T00:00:00Z");
  const seasonEnd = new Date("2025-03-31T23:59:59Z");

  beforeEach(async () => {
    repository = new BoostRepository(db);

    // Create test users with unique wallets
    user1Id = randomUUID();
    wallet1 =
      `0x${randomUUID().replace(/-/g, "").substring(0, 40)}`.toLowerCase();
    await db.insert(coreSchema.users).values({
      id: user1Id,
      walletAddress: wallet1,
      name: "Test User 1",
      status: "active",
    });

    user2Id = randomUUID();
    wallet2 =
      `0x${randomUUID().replace(/-/g, "").substring(0, 40)}`.toLowerCase();
    await db.insert(coreSchema.users).values({
      id: user2Id,
      walletAddress: wallet2,
      name: "Test User 2",
      status: "active",
    });

    user3Id = randomUUID();
    wallet3 =
      `0x${randomUUID().replace(/-/g, "").substring(0, 40)}`.toLowerCase();
    await db.insert(coreSchema.users).values({
      id: user3Id,
      walletAddress: wallet3,
      name: "Test User 3",
      status: "active",
    });

    // Create test competitions
    competition1Id = randomUUID();
    await db.insert(coreSchema.competitions).values({
      id: competition1Id,
      name: "Competition 1",
      description: "Test competition 1",
      status: "pending",
    });

    competition2Id = randomUUID();
    await db.insert(coreSchema.competitions).values({
      id: competition2Id,
      name: "Competition 2",
      description: "Test competition 2",
      status: "pending",
    });

    competition3Id = randomUUID();
    await db.insert(coreSchema.competitions).values({
      id: competition3Id,
      name: "Competition 3",
      description: "Test competition 3",
      status: "pending",
    });

    // Create test agents (owned by user1)
    agent1Id = randomUUID();
    await db.insert(coreSchema.agents).values({
      id: agent1Id,
      ownerId: user1Id,
      name: "Agent 1",
      handle: `agent1-${randomUUID().slice(0, 8)}`,
      apiKey: `api-key-${randomUUID()}`,
      status: "active",
    });

    agent2Id = randomUUID();
    await db.insert(coreSchema.agents).values({
      id: agent2Id,
      ownerId: user1Id,
      name: "Agent 2",
      handle: `agent2-${randomUUID().slice(0, 8)}`,
      apiKey: `api-key-${randomUUID()}`,
      status: "active",
    });
  });

  afterEach(async () => {
    try {
      // Clean up agent boosts first (depends on agent_boost_totals and boost_changes)
      await db.delete(schema.agentBoosts);

      // Clean up agent boost totals
      await db
        .delete(schema.agentBoostTotals)
        .where(eq(schema.agentBoostTotals.agentId, agent1Id));
      await db
        .delete(schema.agentBoostTotals)
        .where(eq(schema.agentBoostTotals.agentId, agent2Id));

      // Clean up boost changes for all test users
      for (const userId of [user1Id, user2Id, user3Id]) {
        const balances = await db
          .select({ id: schema.boostBalances.id })
          .from(schema.boostBalances)
          .where(eq(schema.boostBalances.userId, userId));

        for (const balance of balances) {
          await db
            .delete(schema.boostChanges)
            .where(eq(schema.boostChanges.balanceId, balance.id));
        }

        await db
          .delete(schema.boostBalances)
          .where(eq(schema.boostBalances.userId, userId));
      }

      // Clean up agents
      await db
        .delete(coreSchema.agents)
        .where(eq(coreSchema.agents.id, agent1Id));
      await db
        .delete(coreSchema.agents)
        .where(eq(coreSchema.agents.id, agent2Id));

      // Clean up competitions
      await db
        .delete(coreSchema.competitions)
        .where(eq(coreSchema.competitions.id, competition1Id));
      await db
        .delete(coreSchema.competitions)
        .where(eq(coreSchema.competitions.id, competition2Id));
      await db
        .delete(coreSchema.competitions)
        .where(eq(coreSchema.competitions.id, competition3Id));

      // Clean up users
      await db.delete(coreSchema.users).where(eq(coreSchema.users.id, user1Id));
      await db.delete(coreSchema.users).where(eq(coreSchema.users.id, user2Id));
      await db.delete(coreSchema.users).where(eq(coreSchema.users.id, user3Id));
    } catch (error) {
      console.warn("Cleanup error:", error);
    }
  });

  /**
   * Helper to create a boost for a user on an agent in a competition.
   * First increases the user's balance, then boosts the agent.
   */
  async function createBoost(
    userId: string,
    agentId: string,
    competitionId: string,
    amount: bigint,
    createdAt?: Date,
  ) {
    // Give user balance first
    await repository.increase({
      userId,
      competitionId,
      amount,
    });

    // Boost the agent
    const result = await repository.boostAgent({
      userId,
      agentId,
      competitionId,
      amount,
    });

    // If a custom createdAt is provided, update the agent_boosts record
    if (createdAt && result.type === "applied") {
      await db
        .update(schema.agentBoosts)
        .set({ createdAt })
        .where(eq(schema.agentBoosts.id, result.agentBoost.id));
    }

    return result;
  }

  describe("getAllCompetitionIdsBoostedDuringSeason()", () => {
    test("should return empty map when no boosts exist", async () => {
      const result = await repository.getAllCompetitionIdsBoostedDuringSeason(
        seasonStart,
        seasonEnd,
      );

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    test("should return map with single wallet and single competition", async () => {
      await createBoost(
        user1Id,
        agent1Id,
        competition1Id,
        100n,
        new Date("2025-02-15T12:00:00Z"),
      );

      const result = await repository.getAllCompetitionIdsBoostedDuringSeason(
        seasonStart,
        seasonEnd,
      );

      expect(result.size).toBe(1);
      expect(result.has(wallet1)).toBe(true);
      expect(result.get(wallet1)).toEqual([competition1Id]);
    });

    test("should return distinct competition IDs per wallet", async () => {
      // User 1 boosts competition 1 twice (same agent)
      await createBoost(
        user1Id,
        agent1Id,
        competition1Id,
        100n,
        new Date("2025-02-01T12:00:00Z"),
      );
      await createBoost(
        user1Id,
        agent1Id,
        competition1Id,
        50n,
        new Date("2025-02-10T12:00:00Z"),
      );

      const result = await repository.getAllCompetitionIdsBoostedDuringSeason(
        seasonStart,
        seasonEnd,
      );

      expect(result.size).toBe(1);
      expect(result.get(wallet1)).toHaveLength(1);
      expect(result.get(wallet1)).toContain(competition1Id);
    });

    test("should return multiple competition IDs for a single wallet", async () => {
      // User 1 boosts competition 1 and competition 2
      await createBoost(
        user1Id,
        agent1Id,
        competition1Id,
        100n,
        new Date("2025-02-01T12:00:00Z"),
      );
      await createBoost(
        user1Id,
        agent2Id,
        competition2Id,
        100n,
        new Date("2025-02-15T12:00:00Z"),
      );

      const result = await repository.getAllCompetitionIdsBoostedDuringSeason(
        seasonStart,
        seasonEnd,
      );

      expect(result.size).toBe(1);
      expect(result.get(wallet1)).toHaveLength(2);
      expect(result.get(wallet1)).toContain(competition1Id);
      expect(result.get(wallet1)).toContain(competition2Id);
    });

    test("should return data for multiple wallets", async () => {
      // User 1 boosts competition 1
      await createBoost(
        user1Id,
        agent1Id,
        competition1Id,
        100n,
        new Date("2025-02-01T12:00:00Z"),
      );

      // User 2 boosts competition 2
      await createBoost(
        user2Id,
        agent1Id,
        competition2Id,
        100n,
        new Date("2025-02-15T12:00:00Z"),
      );

      // User 3 boosts competition 1 and competition 3
      await createBoost(
        user3Id,
        agent1Id,
        competition1Id,
        100n,
        new Date("2025-03-01T12:00:00Z"),
      );
      await createBoost(
        user3Id,
        agent2Id,
        competition3Id,
        100n,
        new Date("2025-03-15T12:00:00Z"),
      );

      const result = await repository.getAllCompetitionIdsBoostedDuringSeason(
        seasonStart,
        seasonEnd,
      );

      expect(result.size).toBe(3);

      expect(result.get(wallet1)).toHaveLength(1);
      expect(result.get(wallet1)).toContain(competition1Id);

      expect(result.get(wallet2)).toHaveLength(1);
      expect(result.get(wallet2)).toContain(competition2Id);

      expect(result.get(wallet3)).toHaveLength(2);
      expect(result.get(wallet3)).toContain(competition1Id);
      expect(result.get(wallet3)).toContain(competition3Id);
    });

    test("should respect date window start boundary", async () => {
      // Boost before the season start (should be excluded)
      await createBoost(
        user1Id,
        agent1Id,
        competition1Id,
        100n,
        new Date("2024-12-31T23:59:59Z"),
      );

      // Boost at exactly the season start (should be included)
      await createBoost(user2Id, agent1Id, competition2Id, 100n, seasonStart);

      const result = await repository.getAllCompetitionIdsBoostedDuringSeason(
        seasonStart,
        seasonEnd,
      );

      expect(result.has(wallet1)).toBe(false);
      expect(result.has(wallet2)).toBe(true);
      expect(result.get(wallet2)).toContain(competition2Id);
    });

    test("should respect date window end boundary", async () => {
      // Boost at exactly the season end (should be included)
      await createBoost(user1Id, agent1Id, competition1Id, 100n, seasonEnd);

      // Boost after the season end (should be excluded)
      await createBoost(
        user2Id,
        agent1Id,
        competition2Id,
        100n,
        new Date("2025-04-01T00:00:00Z"),
      );

      const result = await repository.getAllCompetitionIdsBoostedDuringSeason(
        seasonStart,
        seasonEnd,
      );

      expect(result.has(wallet1)).toBe(true);
      expect(result.get(wallet1)).toContain(competition1Id);
      expect(result.has(wallet2)).toBe(false);
    });

    test("should exclude boosts outside the date window", async () => {
      // Boost before the window
      await createBoost(
        user1Id,
        agent1Id,
        competition1Id,
        100n,
        new Date("2024-06-15T12:00:00Z"),
      );

      // Boost after the window
      await createBoost(
        user1Id,
        agent1Id,
        competition2Id,
        100n,
        new Date("2025-06-15T12:00:00Z"),
      );

      // Boost within the window
      await createBoost(
        user1Id,
        agent2Id,
        competition3Id,
        100n,
        new Date("2025-02-15T12:00:00Z"),
      );

      const result = await repository.getAllCompetitionIdsBoostedDuringSeason(
        seasonStart,
        seasonEnd,
      );

      expect(result.size).toBe(1);
      expect(result.get(wallet1)).toHaveLength(1);
      expect(result.get(wallet1)).toContain(competition3Id);
      expect(result.get(wallet1)).not.toContain(competition1Id);
      expect(result.get(wallet1)).not.toContain(competition2Id);
    });

    test("should handle multiple boosts to same competition from different agents", async () => {
      // User 1 boosts competition 1 via agent 1
      await createBoost(
        user1Id,
        agent1Id,
        competition1Id,
        100n,
        new Date("2025-02-01T12:00:00Z"),
      );

      // User 1 boosts competition 1 via agent 2
      await createBoost(
        user1Id,
        agent2Id,
        competition1Id,
        100n,
        new Date("2025-02-15T12:00:00Z"),
      );

      const result = await repository.getAllCompetitionIdsBoostedDuringSeason(
        seasonStart,
        seasonEnd,
      );

      expect(result.size).toBe(1);
      // Should only have competition1Id once (distinct)
      expect(result.get(wallet1)).toHaveLength(1);
      expect(result.get(wallet1)).toContain(competition1Id);
    });

    test("should handle empty date range", async () => {
      await createBoost(
        user1Id,
        agent1Id,
        competition1Id,
        100n,
        new Date("2025-02-15T12:00:00Z"),
      );

      // Query with end before start (should return empty)
      const result = await repository.getAllCompetitionIdsBoostedDuringSeason(
        new Date("2025-03-01T00:00:00Z"),
        new Date("2025-01-01T00:00:00Z"),
      );

      expect(result.size).toBe(0);
    });

    test("should handle same day date range", async () => {
      const exactDate = new Date("2025-02-15T12:00:00Z");

      await createBoost(user1Id, agent1Id, competition1Id, 100n, exactDate);

      // Query with same start and end date
      const result = await repository.getAllCompetitionIdsBoostedDuringSeason(
        new Date("2025-02-15T00:00:00Z"),
        new Date("2025-02-15T23:59:59Z"),
      );

      expect(result.size).toBe(1);
      expect(result.get(wallet1)).toContain(competition1Id);
    });

    test("should return lowercase wallet addresses", async () => {
      await createBoost(
        user1Id,
        agent1Id,
        competition1Id,
        100n,
        new Date("2025-02-15T12:00:00Z"),
      );

      const result = await repository.getAllCompetitionIdsBoostedDuringSeason(
        seasonStart,
        seasonEnd,
      );

      // All wallet addresses in the map should be lowercase
      for (const walletAddr of result.keys()) {
        expect(walletAddr).toBe(walletAddr.toLowerCase());
      }
    });
  });
});
