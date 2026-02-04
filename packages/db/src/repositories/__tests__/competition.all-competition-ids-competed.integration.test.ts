import { randomUUID } from "crypto";
import { pino } from "pino";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import {
  agents,
  competitionAgents,
  competitions,
  users,
} from "../../schema/core/defs.js";
import { dropAllSchemas } from "../../utils/drop-all-schemas.js";
import { pushSchema } from "../../utils/push-schema.js";
import { AgentRepository } from "../agent.js";
import { CompetitionRewardsRepository } from "../competition-rewards.js";
import { CompetitionRepository } from "../competition.js";
import { UserRepository } from "../user.js";
import { db } from "./db.js";

describe("CompetitionRepository getAllCompetitionIdsCompetedDuringSeason Integration Tests", () => {
  let competitionRepo: CompetitionRepository;
  let agentRepo: AgentRepository;
  let userRepo: UserRepository;
  let competitionRewardsRepo: CompetitionRewardsRepository;
  let logger: ReturnType<typeof pino>;

  // Test users
  let user1Id: string;
  let user2Id: string;
  let user3Id: string;
  let wallet1: string;
  let wallet2: string;
  let wallet3: string;

  // Test agents (one per user)
  let agent1Id: string;
  let agent2Id: string;
  let agent3Id: string;

  // Test competitions
  let competition1Id: string;
  let competition2Id: string;
  let competition3Id: string;

  // Date window for tests
  const seasonStart = new Date("2025-01-01T00:00:00Z");
  const seasonEnd = new Date("2025-03-31T23:59:59Z");

  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  beforeEach(async () => {
    logger = pino({ level: "silent" });

    competitionRewardsRepo = new CompetitionRewardsRepository(
      db,
      logger as never,
    );
    competitionRepo = new CompetitionRepository(db, db, logger as never);
    agentRepo = new AgentRepository(
      db,
      logger as never,
      competitionRewardsRepo,
    );
    userRepo = new UserRepository(db, logger as never);

    const testId = randomUUID().substring(0, 8);

    // Create test users with unique wallets
    user1Id = randomUUID();
    wallet1 = `0x${testId}${"1".padEnd(32, "1")}`.toLowerCase();
    await userRepo.create({
      id: user1Id,
      privyId: `privy-1-${testId}`,
      walletAddress: wallet1,
      embeddedWalletAddress: `0x${testId}${"a".padEnd(32, "a")}`,
      name: "Test User 1",
      email: null,
      status: "active",
      metadata: null,
      walletLastVerifiedAt: new Date(),
      lastLoginAt: new Date(),
    });

    user2Id = randomUUID();
    wallet2 = `0x${testId}${"2".padEnd(32, "2")}`.toLowerCase();
    await userRepo.create({
      id: user2Id,
      privyId: `privy-2-${testId}`,
      walletAddress: wallet2,
      embeddedWalletAddress: `0x${testId}${"b".padEnd(32, "b")}`,
      name: "Test User 2",
      email: null,
      status: "active",
      metadata: null,
      walletLastVerifiedAt: new Date(),
      lastLoginAt: new Date(),
    });

    user3Id = randomUUID();
    wallet3 = `0x${testId}${"3".padEnd(32, "3")}`.toLowerCase();
    await userRepo.create({
      id: user3Id,
      privyId: `privy-3-${testId}`,
      walletAddress: wallet3,
      embeddedWalletAddress: `0x${testId}${"c".padEnd(32, "c")}`,
      name: "Test User 3",
      email: null,
      status: "active",
      metadata: null,
      walletLastVerifiedAt: new Date(),
      lastLoginAt: new Date(),
    });

    // Create test agents (one per user)
    agent1Id = randomUUID();
    await agentRepo.create({
      id: agent1Id,
      ownerId: user1Id,
      walletAddress: `0x${testId}${"d".padEnd(32, "d")}`,
      name: "Agent 1",
      handle: `ag1-${testId}`,
      email: null,
      description: null,
      imageUrl: null,
      apiKey: `key1-${Date.now()}`,
      apiKeyHash: `hash1-${Date.now()}`,
      metadata: null,
      status: "active",
    });

    agent2Id = randomUUID();
    await agentRepo.create({
      id: agent2Id,
      ownerId: user2Id,
      walletAddress: `0x${testId}${"e".padEnd(32, "e")}`,
      name: "Agent 2",
      handle: `ag2-${testId}`,
      email: null,
      description: null,
      imageUrl: null,
      apiKey: `key2-${Date.now()}`,
      apiKeyHash: `hash2-${Date.now()}`,
      metadata: null,
      status: "active",
    });

    agent3Id = randomUUID();
    await agentRepo.create({
      id: agent3Id,
      ownerId: user3Id,
      walletAddress: `0x${testId}${"f".padEnd(32, "f")}`,
      name: "Agent 3",
      handle: `ag3-${testId}`,
      email: null,
      description: null,
      imageUrl: null,
      apiKey: `key3-${Date.now()}`,
      apiKeyHash: `hash3-${Date.now()}`,
      metadata: null,
      status: "active",
    });
  });

  afterEach(async () => {
    // Clean up test data in reverse dependency order
    await db.delete(competitionAgents);
    await db.delete(competitions);
    await db.delete(agents);
    await db.delete(users);
  });

  /**
   * Helper to create a competition with a specific start date.
   */
  async function createCompetition(id: string, name: string, startDate: Date) {
    return competitionRepo.create({
      id,
      name,
      description: "Test competition",
      type: "trading",
      status: "pending",
      startDate,
      endDate: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000), // +7 days
      imageUrl: null,
      externalUrl: null,
      boostStartDate: null,
      boostEndDate: null,
      joinStartDate: null,
      joinEndDate: null,
      maxParticipants: null,
      registeredParticipants: 0,
      sandboxMode: false,
    });
  }

  describe("getAllCompetitionIdsCompetedDuringSeason()", () => {
    test("should return empty map when no competitions exist", async () => {
      const result =
        await competitionRepo.getAllCompetitionIdsCompetedDuringSeason(
          seasonStart,
          seasonEnd,
        );

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    test("should return empty map when no agents are registered in competitions", async () => {
      // Create competition but don't register any agents
      competition1Id = randomUUID();
      await createCompetition(
        competition1Id,
        "Competition 1",
        new Date("2025-02-15T00:00:00Z"),
      );

      const result =
        await competitionRepo.getAllCompetitionIdsCompetedDuringSeason(
          seasonStart,
          seasonEnd,
        );

      expect(result.size).toBe(0);
    });

    test("should return map with single wallet and single competition", async () => {
      competition1Id = randomUUID();
      await createCompetition(
        competition1Id,
        "Competition 1",
        new Date("2025-02-15T00:00:00Z"),
      );

      await competitionRepo.addAgentToCompetition(competition1Id, agent1Id);

      const result =
        await competitionRepo.getAllCompetitionIdsCompetedDuringSeason(
          seasonStart,
          seasonEnd,
        );

      expect(result.size).toBe(1);
      expect(result.has(wallet1)).toBe(true);
      expect(result.get(wallet1)).toEqual([competition1Id]);
    });

    test("should return distinct competition IDs per wallet", async () => {
      // User 1 competes in competition 1 (only one agent can compete per user per competition)
      competition1Id = randomUUID();
      await createCompetition(
        competition1Id,
        "Competition 1",
        new Date("2025-02-01T00:00:00Z"),
      );

      await competitionRepo.addAgentToCompetition(competition1Id, agent1Id);

      const result =
        await competitionRepo.getAllCompetitionIdsCompetedDuringSeason(
          seasonStart,
          seasonEnd,
        );

      expect(result.size).toBe(1);
      expect(result.get(wallet1)).toHaveLength(1);
      expect(result.get(wallet1)).toContain(competition1Id);
    });

    test("should return multiple competition IDs for a single wallet", async () => {
      // User 1's agent competes in competition 1 and competition 2
      competition1Id = randomUUID();
      await createCompetition(
        competition1Id,
        "Competition 1",
        new Date("2025-02-01T00:00:00Z"),
      );

      competition2Id = randomUUID();
      await createCompetition(
        competition2Id,
        "Competition 2",
        new Date("2025-02-15T00:00:00Z"),
      );

      await competitionRepo.addAgentToCompetition(competition1Id, agent1Id);
      await competitionRepo.addAgentToCompetition(competition2Id, agent1Id);

      const result =
        await competitionRepo.getAllCompetitionIdsCompetedDuringSeason(
          seasonStart,
          seasonEnd,
        );

      expect(result.size).toBe(1);
      expect(result.get(wallet1)).toHaveLength(2);
      expect(result.get(wallet1)).toContain(competition1Id);
      expect(result.get(wallet1)).toContain(competition2Id);
    });

    test("should return data for multiple wallets", async () => {
      competition1Id = randomUUID();
      await createCompetition(
        competition1Id,
        "Competition 1",
        new Date("2025-02-01T00:00:00Z"),
      );

      competition2Id = randomUUID();
      await createCompetition(
        competition2Id,
        "Competition 2",
        new Date("2025-02-15T00:00:00Z"),
      );

      competition3Id = randomUUID();
      await createCompetition(
        competition3Id,
        "Competition 3",
        new Date("2025-03-01T00:00:00Z"),
      );

      // User 1 competes in competition 1
      await competitionRepo.addAgentToCompetition(competition1Id, agent1Id);

      // User 2 competes in competition 2
      await competitionRepo.addAgentToCompetition(competition2Id, agent2Id);

      // User 3 competes in competition 1 and competition 3
      await competitionRepo.addAgentToCompetition(competition1Id, agent3Id);
      await competitionRepo.addAgentToCompetition(competition3Id, agent3Id);

      const result =
        await competitionRepo.getAllCompetitionIdsCompetedDuringSeason(
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
      // Competition before the season start (should be excluded)
      competition1Id = randomUUID();
      await createCompetition(
        competition1Id,
        "Competition Before",
        new Date("2024-12-31T23:59:59Z"),
      );

      // Competition at exactly the season start (should be included)
      competition2Id = randomUUID();
      await createCompetition(
        competition2Id,
        "Competition At Start",
        seasonStart,
      );

      await competitionRepo.addAgentToCompetition(competition1Id, agent1Id);
      await competitionRepo.addAgentToCompetition(competition2Id, agent2Id);

      const result =
        await competitionRepo.getAllCompetitionIdsCompetedDuringSeason(
          seasonStart,
          seasonEnd,
        );

      expect(result.has(wallet1)).toBe(false);
      expect(result.has(wallet2)).toBe(true);
      expect(result.get(wallet2)).toContain(competition2Id);
    });

    test("should respect date window end boundary", async () => {
      // Competition at exactly the season end (should be included)
      competition1Id = randomUUID();
      await createCompetition(competition1Id, "Competition At End", seasonEnd);

      // Competition after the season end (should be excluded)
      competition2Id = randomUUID();
      await createCompetition(
        competition2Id,
        "Competition After",
        new Date("2025-04-01T00:00:00Z"),
      );

      await competitionRepo.addAgentToCompetition(competition1Id, agent1Id);
      await competitionRepo.addAgentToCompetition(competition2Id, agent2Id);

      const result =
        await competitionRepo.getAllCompetitionIdsCompetedDuringSeason(
          seasonStart,
          seasonEnd,
        );

      expect(result.has(wallet1)).toBe(true);
      expect(result.get(wallet1)).toContain(competition1Id);
      expect(result.has(wallet2)).toBe(false);
    });

    test("should exclude competitions outside the date window", async () => {
      // Competition before the window
      competition1Id = randomUUID();
      await createCompetition(
        competition1Id,
        "Competition Before",
        new Date("2024-06-15T00:00:00Z"),
      );

      // Competition after the window
      competition2Id = randomUUID();
      await createCompetition(
        competition2Id,
        "Competition After",
        new Date("2025-06-15T00:00:00Z"),
      );

      // Competition within the window
      competition3Id = randomUUID();
      await createCompetition(
        competition3Id,
        "Competition Within",
        new Date("2025-02-15T00:00:00Z"),
      );

      await competitionRepo.addAgentToCompetition(competition1Id, agent1Id);
      await competitionRepo.addAgentToCompetition(competition2Id, agent1Id);
      await competitionRepo.addAgentToCompetition(competition3Id, agent1Id);

      const result =
        await competitionRepo.getAllCompetitionIdsCompetedDuringSeason(
          seasonStart,
          seasonEnd,
        );

      expect(result.size).toBe(1);
      expect(result.get(wallet1)).toHaveLength(1);
      expect(result.get(wallet1)).toContain(competition3Id);
      expect(result.get(wallet1)).not.toContain(competition1Id);
      expect(result.get(wallet1)).not.toContain(competition2Id);
    });

    test("should exclude withdrawn agents", async () => {
      competition1Id = randomUUID();
      await createCompetition(
        competition1Id,
        "Competition 1",
        new Date("2025-02-15T00:00:00Z"),
      );

      // Add agent and then withdraw
      await competitionRepo.addAgentToCompetition(competition1Id, agent1Id);
      await competitionRepo.updateAgentCompetitionStatus(
        competition1Id,
        agent1Id,
        "withdrawn",
        "Testing withdrawal",
      );

      // Add another agent that stays active
      await competitionRepo.addAgentToCompetition(competition1Id, agent2Id);

      const result =
        await competitionRepo.getAllCompetitionIdsCompetedDuringSeason(
          seasonStart,
          seasonEnd,
        );

      // Agent 1 (withdrawn) should not be included
      expect(result.has(wallet1)).toBe(false);
      // Agent 2 (active) should be included
      expect(result.has(wallet2)).toBe(true);
      expect(result.get(wallet2)).toContain(competition1Id);
    });

    test("should exclude disqualified agents", async () => {
      competition1Id = randomUUID();
      await createCompetition(
        competition1Id,
        "Competition 1",
        new Date("2025-02-15T00:00:00Z"),
      );

      // Add agent and then disqualify
      await competitionRepo.addAgentToCompetition(competition1Id, agent1Id);
      await competitionRepo.updateAgentCompetitionStatus(
        competition1Id,
        agent1Id,
        "disqualified",
        "Testing disqualification",
      );

      // Add another agent that stays active
      await competitionRepo.addAgentToCompetition(competition1Id, agent2Id);

      const result =
        await competitionRepo.getAllCompetitionIdsCompetedDuringSeason(
          seasonStart,
          seasonEnd,
        );

      // Agent 1 (disqualified) should not be included
      expect(result.has(wallet1)).toBe(false);
      // Agent 2 (active) should be included
      expect(result.has(wallet2)).toBe(true);
      expect(result.get(wallet2)).toContain(competition1Id);
    });

    test("should handle empty date range", async () => {
      competition1Id = randomUUID();
      await createCompetition(
        competition1Id,
        "Competition 1",
        new Date("2025-02-15T00:00:00Z"),
      );

      await competitionRepo.addAgentToCompetition(competition1Id, agent1Id);

      // Query with end before start (should return empty)
      const result =
        await competitionRepo.getAllCompetitionIdsCompetedDuringSeason(
          new Date("2025-03-01T00:00:00Z"),
          new Date("2025-01-01T00:00:00Z"),
        );

      expect(result.size).toBe(0);
    });

    test("should handle same day date range", async () => {
      const exactDate = new Date("2025-02-15T00:00:00Z");

      competition1Id = randomUUID();
      await createCompetition(competition1Id, "Competition 1", exactDate);

      await competitionRepo.addAgentToCompetition(competition1Id, agent1Id);

      // Query with same start and end date
      const result =
        await competitionRepo.getAllCompetitionIdsCompetedDuringSeason(
          new Date("2025-02-15T00:00:00Z"),
          new Date("2025-02-15T23:59:59Z"),
        );

      expect(result.size).toBe(1);
      expect(result.get(wallet1)).toContain(competition1Id);
    });

    test("should return lowercase wallet addresses", async () => {
      competition1Id = randomUUID();
      await createCompetition(
        competition1Id,
        "Competition 1",
        new Date("2025-02-15T00:00:00Z"),
      );

      await competitionRepo.addAgentToCompetition(competition1Id, agent1Id);

      const result =
        await competitionRepo.getAllCompetitionIdsCompetedDuringSeason(
          seasonStart,
          seasonEnd,
        );

      // All wallet addresses in the map should be lowercase
      for (const walletAddr of result.keys()) {
        expect(walletAddr).toBe(walletAddr.toLowerCase());
      }
    });

    test("should handle multiple agents from same user competing in different competitions", async () => {
      // Create a second agent for user 1
      const agent1bId = randomUUID();
      const testId = randomUUID().substring(0, 8);
      await agentRepo.create({
        id: agent1bId,
        ownerId: user1Id,
        walletAddress: `0x${testId}${"g".padEnd(32, "g")}`,
        name: "Agent 1b",
        handle: `ag1b-${testId}`,
        email: null,
        description: null,
        imageUrl: null,
        apiKey: `key1b-${Date.now()}`,
        apiKeyHash: `hash1b-${Date.now()}`,
        metadata: null,
        status: "active",
      });

      competition1Id = randomUUID();
      await createCompetition(
        competition1Id,
        "Competition 1",
        new Date("2025-02-01T00:00:00Z"),
      );

      competition2Id = randomUUID();
      await createCompetition(
        competition2Id,
        "Competition 2",
        new Date("2025-02-15T00:00:00Z"),
      );

      // Agent 1 competes in competition 1
      await competitionRepo.addAgentToCompetition(competition1Id, agent1Id);
      // Agent 1b competes in competition 2
      await competitionRepo.addAgentToCompetition(competition2Id, agent1bId);

      const result =
        await competitionRepo.getAllCompetitionIdsCompetedDuringSeason(
          seasonStart,
          seasonEnd,
        );

      // User 1's wallet should have both competitions (via different agents)
      expect(result.size).toBe(1);
      expect(result.get(wallet1)).toHaveLength(2);
      expect(result.get(wallet1)).toContain(competition1Id);
      expect(result.get(wallet1)).toContain(competition2Id);
    });

    test("should handle user with multiple agents in same competition (one withdrawn)", async () => {
      // Note: The system prevents multiple agents from the same user in a competition,
      // but if one is withdrawn, another can potentially be added.
      // However, validateOneAgentPerUser checks for ANY existing agent (including withdrawn).
      // This test verifies that even withdrawn agents don't count toward competed competitions.

      competition1Id = randomUUID();
      await createCompetition(
        competition1Id,
        "Competition 1",
        new Date("2025-02-15T00:00:00Z"),
      );

      // Add agent1 and withdraw it
      await competitionRepo.addAgentToCompetition(competition1Id, agent1Id);
      await competitionRepo.updateAgentCompetitionStatus(
        competition1Id,
        agent1Id,
        "withdrawn",
        "Testing",
      );

      const result =
        await competitionRepo.getAllCompetitionIdsCompetedDuringSeason(
          seasonStart,
          seasonEnd,
        );

      // User 1 should NOT be in the result since their agent was withdrawn
      expect(result.has(wallet1)).toBe(false);
    });
  });
});
