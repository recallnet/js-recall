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
  competitionsLeaderboard,
  users,
} from "../../../schema/core/defs.js";
import { portfolioSnapshots } from "../../../schema/trading/defs.js";
import { dropAllSchemas } from "../../../utils/drop-all-schemas.js";
import { pushSchema } from "../../../utils/push-schema.js";
import { CompetitionRepository } from "../../competition.js";
import { db } from "../db.js";

/**
 * Generate a random wallet address
 */
function generateWalletAddress(): string {
  const chars = "0123456789abcdef";
  let address = "0x";
  for (let i = 0; i < 40; i++) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }
  return address;
}

function generateHandle(): string {
  return `agent-${randomUUID().substring(0, 7)}`;
}

describe("CompetitionRepository.getAgentRankingsInCompetitions() Integration Tests", () => {
  let repository: CompetitionRepository;
  let logger: ReturnType<typeof pino>;

  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  beforeEach(async () => {
    logger = pino({ level: "silent" });
    repository = new CompetitionRepository(db, db, logger as never);
  });

  afterEach(async () => {
    await db.delete(portfolioSnapshots);
    await db.delete(competitionsLeaderboard);
    await db.delete(competitionAgents);
    await db.delete(competitions);
    await db.delete(agents);
    await db.delete(users);
  });

  test("should return correct ranking from competitions_leaderboard for ended competitions", async () => {
    // Create user
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      walletAddress: generateWalletAddress(),
      name: "Test User",
      status: "active",
    });

    // Create 3 agents
    const agent1Id = randomUUID();
    const agent2Id = randomUUID();
    const agent3Id = randomUUID();

    await db.insert(agents).values([
      {
        id: agent1Id,
        ownerId: userId,
        handle: generateHandle(),
        name: "Agent 1",
        apiKey: `key-${randomUUID()}`,
        status: "active",
      },
      {
        id: agent2Id,
        ownerId: userId,
        handle: generateHandle(),
        name: "Agent 2",
        apiKey: `key-${randomUUID()}`,
        status: "active",
      },
      {
        id: agent3Id,
        ownerId: userId,
        handle: generateHandle(),
        name: "Agent 3",
        apiKey: `key-${randomUUID()}`,
        status: "active",
      },
    ]);

    // Create an ended competition
    const competitionId = randomUUID();
    await db.insert(competitions).values({
      id: competitionId,
      name: "Test Ended Competition",
      description: "Test",
      status: "ended", // ENDED competition
      type: "trading",
    });

    // Register all 3 agents
    await db.insert(competitionAgents).values([
      {
        agentId: agent1Id,
        competitionId,
        status: "active",
      },
      {
        agentId: agent2Id,
        competitionId,
        status: "active",
      },
      {
        agentId: agent3Id,
        competitionId,
        status: "active",
      },
    ]);

    // Insert FINAL leaderboard rankings (what was calculated when competition ended)
    // Agent 1: Rank 1 (best)
    // Agent 2: Rank 2
    // Agent 3: Rank 3 (worst)
    const leaderboardId1 = randomUUID();
    const leaderboardId2 = randomUUID();
    const leaderboardId3 = randomUUID();

    await db.insert(competitionsLeaderboard).values([
      {
        id: leaderboardId1,
        competitionId,
        agentId: agent1Id,
        rank: 1,
        score: 20000,
        totalAgents: 3,
      },
      {
        id: leaderboardId2,
        competitionId,
        agentId: agent2Id,
        rank: 2,
        score: 15000,
        totalAgents: 3,
      },
      {
        id: leaderboardId3,
        competitionId,
        agentId: agent3Id,
        rank: 3,
        score: 10000,
        totalAgents: 3,
      },
    ]);

    // Insert portfolio snapshots with DIFFERENT values from final leaderboard
    // Note: this simulates a bug where base placement calculations would be incorrect if we
    // recalculated from snapshots: if we recalculate from snapshots, ranks would be wrong
    const now = new Date();
    await db.insert(portfolioSnapshots).values([
      {
        competitionId,
        agentId: agent1Id,
        timestamp: now,
        totalValue: 12000, // Lower than final score (would give different rank if recalculated)
      },
      {
        agentId: agent2Id,
        competitionId,
        timestamp: now,
        totalValue: 18000, // Higher than final score (would be rank 1 if recalculated from snapshots)
      },
      {
        agentId: agent3Id,
        competitionId,
        timestamp: now,
        totalValue: 9000,
      },
    ]);

    // Query rankings for agent 2
    const rankings = await repository.getAgentRankingsInCompetitions(agent2Id, [
      competitionId,
    ]);

    const agent2Ranking = rankings.get(competitionId);

    expect(agent2Ranking).toBeDefined();
    expect(agent2Ranking?.rank).toBe(2);
    expect(agent2Ranking?.totalAgents).toBe(3);
  });

  test("should calculate ranking from snapshots for active competitions", async () => {
    // Create user
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      walletAddress: generateWalletAddress(),
      name: "Test User",
      status: "active",
    });

    // Create 2 agents
    const agent1Id = randomUUID();
    const agent2Id = randomUUID();

    await db.insert(agents).values([
      {
        id: agent1Id,
        ownerId: userId,
        handle: generateHandle(),
        name: "Agent 1",
        apiKey: `key-${randomUUID()}`,
        status: "active",
      },
      {
        id: agent2Id,
        ownerId: userId,
        handle: generateHandle(),
        name: "Agent 2",
        apiKey: `key-${randomUUID()}`,
        status: "active",
      },
    ]);

    // Create an ACTIVE competition (not ended)
    const competitionId = randomUUID();
    await db.insert(competitions).values({
      id: competitionId,
      name: "Test Active Competition",
      description: "Test",
      status: "active", // ACTIVE competition
      type: "trading",
    });

    // Register both agents
    await db.insert(competitionAgents).values([
      {
        agentId: agent1Id,
        competitionId,
        status: "active",
      },
      {
        agentId: agent2Id,
        competitionId,
        status: "active",
      },
    ]);

    // Insert current portfolio snapshots
    const now = new Date();
    await db.insert(portfolioSnapshots).values([
      {
        competitionId,
        agentId: agent1Id,
        timestamp: now,
        totalValue: 20000, // Agent 1 leading
      },
      {
        agentId: agent2Id,
        competitionId,
        timestamp: now,
        totalValue: 15000, // Agent 2 in second
      },
    ]);

    // For ACTIVE competitions, there's no final leaderboard yet
    // So ranks should be calculated from snapshots

    const rankings = await repository.getAgentRankingsInCompetitions(agent2Id, [
      competitionId,
    ]);

    const agent2Ranking = rankings.get(competitionId);

    // For active competitions, should calculate from snapshots
    expect(agent2Ranking).toBeDefined();
    expect(agent2Ranking?.rank).toBe(2); // Second place based on snapshot values
    expect(agent2Ranking?.totalAgents).toBe(2);
  });

  test("should handle multiple competitions with mix of active and ended", async () => {
    // Create user
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      walletAddress: generateWalletAddress(),
      name: "Test User",
      status: "active",
    });

    // Create agent
    const agentId = randomUUID();
    await db.insert(agents).values({
      id: agentId,
      ownerId: userId,
      handle: generateHandle(),
      name: "Test Agent",
      apiKey: `key-${randomUUID()}`,
      status: "active",
    });

    // Create ended competition
    const endedCompId = randomUUID();
    await db.insert(competitions).values({
      id: endedCompId,
      name: "Ended Competition",
      description: "Test",
      status: "ended",
      type: "trading",
    });

    // Create active competition
    const activeCompId = randomUUID();
    await db.insert(competitions).values({
      id: activeCompId,
      name: "Active Competition",
      description: "Test",
      status: "active",
      type: "trading",
    });

    // Register in both
    await db.insert(competitionAgents).values([
      { agentId, competitionId: endedCompId, status: "active" },
      { agentId, competitionId: activeCompId, status: "active" },
    ]);

    // Insert final leaderboard for ended competition
    await db.insert(competitionsLeaderboard).values({
      id: randomUUID(),
      competitionId: endedCompId,
      agentId,
      rank: 5, // Final rank from when competition ended
      score: 15000,
      totalAgents: 10,
    });

    // Insert snapshots for both (active uses these, ended should NOT)
    const now = new Date();
    await db.insert(portfolioSnapshots).values([
      {
        competitionId: endedCompId,
        agentId,
        timestamp: now,
        totalValue: 18000, // Different value - should NOT affect ended competition rank
      },
      {
        competitionId: activeCompId,
        agentId,
        timestamp: now,
        totalValue: 12000,
      },
    ]);

    const rankings = await repository.getAgentRankingsInCompetitions(agentId, [
      endedCompId,
      activeCompId,
    ]);

    // Ended competition should use leaderboard table (rank 5)
    const endedRanking = rankings.get(endedCompId);
    expect(endedRanking).toBeDefined();
    expect(endedRanking?.rank).toBe(5); // From leaderboard, not snapshot
    expect(endedRanking?.totalAgents).toBe(10);

    // Active competition should calculate from snapshots
    const activeRanking = rankings.get(activeCompId);
    expect(activeRanking).toBeDefined();
  });
});
