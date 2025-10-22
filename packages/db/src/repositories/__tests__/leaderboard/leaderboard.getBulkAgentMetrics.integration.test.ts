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

import { agents, users } from "../../../schema/core/defs.js";
import { agentScore } from "../../../schema/ranking/defs.js";
import { dropAllSchemas } from "../../../utils/drop-all-schemas.js";
import { pushSchema } from "../../../utils/push-schema.js";
import { LeaderboardRepository } from "../../leaderboard.js";
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

describe("LeaderboardRepository.getBulkAgentMetrics() Integration Tests", () => {
  let repository: LeaderboardRepository;
  let logger: ReturnType<typeof pino>;

  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  beforeEach(async () => {
    logger = pino({ level: "silent" });
    repository = new LeaderboardRepository(db, logger as never);
  });

  afterEach(async () => {
    await db.delete(agentScore);
    await db.delete(agents);
    await db.delete(users);
  });

  test("should return empty results when no agents exist", async () => {
    const result = await repository.getBulkAgentMetrics([]);

    expect(result).toEqual({
      agentInfo: [],
      agentRanks: [],
      competitionCounts: [],
      tradeCounts: [],
      positionCounts: [],
      bestPlacements: [],
      bestPnls: [],
      totalRois: [],
    });
  });

  test("should handle agent with single competition type score", async () => {
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
      name: "Agent A",
      apiKey: `key-${randomUUID()}`,
      status: "active",
    });

    // Create agent score for trading
    await db.insert(agentScore).values({
      id: randomUUID(),
      agentId,
      type: "trading",
      mu: 25.0,
      sigma: 8.333,
      ordinal: 100.0,
    });

    const result = await repository.getBulkAgentMetrics([agentId]);

    // Agent info should be returned (without score)
    expect(result.agentInfo).toHaveLength(1);
    expect(result.agentInfo[0]).toMatchObject({
      agentId,
      name: "Agent A",
    });

    // Agent ranks should include type, score, and rank (calculated in SQL)
    expect(result.agentRanks).toHaveLength(1);
    expect(result.agentRanks[0]).toMatchObject({
      agentId,
      type: "trading",
      ordinal: 100.0,
      rank: 1, // Only one agent, so rank is 1
    });
  });

  test("FIXED: should return scores for multiple competition types separately", async () => {
    // Create user
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      walletAddress: generateWalletAddress(),
      name: "Test User",
      status: "active",
    });

    // Create agents
    const agentAId = randomUUID();
    const agentBId = randomUUID();
    const agentCId = randomUUID();
    const agentDId = randomUUID();

    await db.insert(agents).values([
      {
        id: agentAId,
        ownerId: userId,
        handle: generateHandle(),
        name: "Agent A",
        apiKey: `key-${randomUUID()}`,
        status: "active",
      },
      {
        id: agentBId,
        ownerId: userId,
        handle: generateHandle(),
        name: "Agent B",
        apiKey: `key-${randomUUID()}`,
        status: "active",
      },
      {
        id: agentCId,
        ownerId: userId,
        handle: generateHandle(),
        name: "Agent C",
        apiKey: `key-${randomUUID()}`,
        status: "active",
      },
      {
        id: agentDId,
        ownerId: userId,
        handle: generateHandle(),
        name: "Agent D",
        apiKey: `key-${randomUUID()}`,
        status: "active",
      },
    ]);

    // Insert 3 agent scores for "trading": A (rank 1), B (rank 2), C (rank 3)
    await db.insert(agentScore).values([
      {
        id: randomUUID(),
        agentId: agentAId,
        type: "trading",
        mu: 30.0,
        sigma: 5.0,
        ordinal: 300.0, // Highest score
      },
      {
        id: randomUUID(),
        agentId: agentBId,
        type: "trading",
        mu: 27.0,
        sigma: 6.0,
        ordinal: 200.0, // Second highest
      },
      {
        id: randomUUID(),
        agentId: agentCId,
        type: "trading",
        mu: 25.0,
        sigma: 7.0,
        ordinal: 100.0, // Third highest
      },
    ]);

    // Insert 2 agent scores for "perpetual_futures": C (rank 1), D (rank 2)
    await db.insert(agentScore).values([
      {
        id: randomUUID(),
        agentId: agentCId,
        type: "perpetual_futures",
        mu: 28.0,
        sigma: 5.5,
        ordinal: 250.0, // Highest in perpetual_futures
      },
      {
        id: randomUUID(),
        agentId: agentDId,
        type: "perpetual_futures",
        mu: 26.0,
        sigma: 6.5,
        ordinal: 150.0, // Second in perpetual_futures
      },
    ]);

    // Query for Agent C who has scores in BOTH competition types
    const result = await repository.getBulkAgentMetrics([agentCId]);

    // Agent info should be returned
    expect(result.agentInfo).toHaveLength(1);
    expect(result.agentInfo[0]).toMatchObject({
      agentId: agentCId,
      name: "Agent C",
    });

    // Agent C should have ranks for BOTH competition types with ranks calculated in SQL
    expect(result.agentRanks).toHaveLength(2);

    // Find the ranks for each type
    const tradingRank = result.agentRanks.find((s) => s.type === "trading");
    const perpetualRank = result.agentRanks.find(
      (s) => s.type === "perpetual_futures",
    );

    // Validate trading rank (should be rank 3 out of 3: A=300, B=200, C=100)
    expect(tradingRank).toBeDefined();
    expect(tradingRank).toMatchObject({
      agentId: agentCId,
      type: "trading",
      ordinal: 100.0,
      rank: 3, // Lowest score among 3 agents
    });

    // Validate perpetual_futures rank (should be rank 1 out of 2: C=250, D=150)
    expect(perpetualRank).toBeDefined();
    expect(perpetualRank).toMatchObject({
      agentId: agentCId,
      type: "perpetual_futures",
      ordinal: 250.0,
      rank: 1, // Highest score among 2 agents
    });
  });

  test("REFACTORED: Ranks calculated in SQL using ROW_NUMBER window function", async () => {
    // Create user
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      walletAddress: generateWalletAddress(),
      name: "Test User",
      status: "active",
    });

    // Create agents
    const agentAId = randomUUID();
    const agentBId = randomUUID();
    const agentCId = randomUUID();

    await db.insert(agents).values([
      {
        id: agentAId,
        ownerId: userId,
        handle: generateHandle(),
        name: "Agent A",
        apiKey: `key-${randomUUID()}`,
        status: "active",
      },
      {
        id: agentBId,
        ownerId: userId,
        handle: generateHandle(),
        name: "Agent B",
        apiKey: `key-${randomUUID()}`,
        status: "active",
      },
      {
        id: agentCId,
        ownerId: userId,
        handle: generateHandle(),
        name: "Agent C",
        apiKey: `key-${randomUUID()}`,
        status: "active",
      },
    ]);

    // Insert scores for both competition types
    await db.insert(agentScore).values([
      // Trading scores
      {
        id: randomUUID(),
        agentId: agentAId,
        type: "trading",
        mu: 30.0,
        sigma: 5.0,
        ordinal: 300.0,
      },
      {
        id: randomUUID(),
        agentId: agentBId,
        type: "trading",
        mu: 27.0,
        sigma: 6.0,
        ordinal: 200.0,
      },
      // Perpetual futures scores
      {
        id: randomUUID(),
        agentId: agentBId,
        type: "perpetual_futures",
        mu: 28.0,
        sigma: 5.5,
        ordinal: 250.0,
      },
      {
        id: randomUUID(),
        agentId: agentCId,
        type: "perpetual_futures",
        mu: 26.0,
        sigma: 6.5,
        ordinal: 150.0,
      },
    ]);

    const result = await repository.getBulkAgentMetrics([
      agentAId,
      agentBId,
      agentCId,
    ]);

    // Should have 4 rank entries total (2 trading + 2 perpetual)
    expect(result.agentRanks.length).toBe(4);

    // Verify all ranks include agentId, type, ordinal, and rank
    result.agentRanks.forEach((rankData) => {
      expect(rankData).toHaveProperty("agentId");
      expect(rankData).toHaveProperty("type");
      expect(rankData).toHaveProperty("ordinal");
      expect(rankData).toHaveProperty("rank");
    });

    // Group by type to verify ranks are correct within each competition type
    const tradingRanks = result.agentRanks.filter((r) => r.type === "trading");
    const perpetualRanks = result.agentRanks.filter(
      (r) => r.type === "perpetual_futures",
    );

    // Trading: A (300, rank 1), B (200, rank 2)
    expect(tradingRanks).toHaveLength(2);
    const agentATradingRank = tradingRanks.find((r) => r.agentId === agentAId);
    expect(agentATradingRank).toMatchObject({
      ordinal: 300,
      rank: 1, // Highest in trading
    });
    const agentBTradingRank = tradingRanks.find((r) => r.agentId === agentBId);
    expect(agentBTradingRank).toMatchObject({
      ordinal: 200,
      rank: 2, // Second in trading
    });

    // Perpetual: B (250, rank 1), C (150, rank 2)
    expect(perpetualRanks).toHaveLength(2);
    const agentBPerpetualRank = perpetualRanks.find(
      (r) => r.agentId === agentBId,
    );
    expect(agentBPerpetualRank).toMatchObject({
      ordinal: 250,
      rank: 1, // Highest in perpetual
    });
    const agentCPerpetualRank = perpetualRanks.find(
      (r) => r.agentId === agentCId,
    );
    expect(agentCPerpetualRank).toMatchObject({
      ordinal: 150,
      rank: 2, // Second in perpetual
    });
  });

  test("should correctly handle agent with no scores", async () => {
    // Create user
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      walletAddress: generateWalletAddress(),
      name: "Test User",
      status: "active",
    });

    // Create agent with no scores
    const agentId = randomUUID();
    await db.insert(agents).values({
      id: agentId,
      ownerId: userId,
      handle: generateHandle(),
      name: "Agent No Score",
      apiKey: `key-${randomUUID()}`,
      status: "active",
    });

    const result = await repository.getBulkAgentMetrics([agentId]);

    // Agent info should be returned
    expect(result.agentInfo).toHaveLength(1);
    expect(result.agentInfo[0]).toMatchObject({
      agentId,
      name: "Agent No Score",
    });

    // Agent should have no ranks
    expect(result.agentRanks).toHaveLength(0);
  });

  test("should handle mix of agents with different competition type participation", async () => {
    // Create user
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      walletAddress: generateWalletAddress(),
      name: "Test User",
      status: "active",
    });

    // Create agents
    const tradingOnlyId = randomUUID();
    const perpetualOnlyId = randomUUID();
    const bothTypesId = randomUUID();
    const noScoresId = randomUUID();

    await db.insert(agents).values([
      {
        id: tradingOnlyId,
        ownerId: userId,
        handle: generateHandle(),
        name: "Trading Only",
        apiKey: `key-${randomUUID()}`,
        status: "active",
      },
      {
        id: perpetualOnlyId,
        ownerId: userId,
        handle: generateHandle(),
        name: "Perpetual Only",
        apiKey: `key-${randomUUID()}`,
        status: "active",
      },
      {
        id: bothTypesId,
        ownerId: userId,
        handle: generateHandle(),
        name: "Both Types",
        apiKey: `key-${randomUUID()}`,
        status: "active",
      },
      {
        id: noScoresId,
        ownerId: userId,
        handle: generateHandle(),
        name: "No Scores",
        apiKey: `key-${randomUUID()}`,
        status: "active",
      },
    ]);

    // Insert scores
    await db.insert(agentScore).values([
      {
        id: randomUUID(),
        agentId: tradingOnlyId,
        type: "trading",
        mu: 30.0,
        sigma: 5.0,
        ordinal: 300.0,
      },
      {
        id: randomUUID(),
        agentId: perpetualOnlyId,
        type: "perpetual_futures",
        mu: 28.0,
        sigma: 5.5,
        ordinal: 250.0,
      },
      {
        id: randomUUID(),
        agentId: bothTypesId,
        type: "trading",
        mu: 27.0,
        sigma: 6.0,
        ordinal: 200.0,
      },
      {
        id: randomUUID(),
        agentId: bothTypesId,
        type: "perpetual_futures",
        mu: 26.0,
        sigma: 6.5,
        ordinal: 150.0,
      },
    ]);

    const result = await repository.getBulkAgentMetrics([
      tradingOnlyId,
      perpetualOnlyId,
      bothTypesId,
      noScoresId,
    ]);

    // All agent info should be returned
    expect(result.agentInfo).toHaveLength(4);

    // Verify total ranks: trading-only (1) + perpetual-only (1) + both-types (2) = 4
    expect(result.agentRanks).toHaveLength(4);

    // Verify trading-only agent
    const tradingOnlyRanks = result.agentRanks.filter(
      (r) => r.agentId === tradingOnlyId,
    );
    expect(tradingOnlyRanks).toHaveLength(1);
    expect(tradingOnlyRanks[0]).toMatchObject({
      type: "trading",
      ordinal: 300.0,
      rank: 1, // Highest in trading
    });

    // Verify perpetual-only agent
    const perpetualOnlyRanks = result.agentRanks.filter(
      (r) => r.agentId === perpetualOnlyId,
    );
    expect(perpetualOnlyRanks).toHaveLength(1);
    expect(perpetualOnlyRanks[0]).toMatchObject({
      type: "perpetual_futures",
      ordinal: 250.0,
      rank: 1, // Highest in perpetual (only 2 total)
    });

    // Verify both-types agent
    const bothTypesRanks = result.agentRanks.filter(
      (r) => r.agentId === bothTypesId,
    );
    expect(bothTypesRanks).toHaveLength(2);

    const tradingRank = bothTypesRanks.find((r) => r.type === "trading");
    const perpetualRank = bothTypesRanks.find(
      (r) => r.type === "perpetual_futures",
    );

    expect(tradingRank).toMatchObject({
      type: "trading",
      ordinal: 200.0,
      rank: 2, // Second in trading (after agent A)
    });
    expect(perpetualRank).toMatchObject({
      type: "perpetual_futures",
      ordinal: 150.0,
      rank: 2, // Second in perpetual (after perpetual-only agent)
    });

    // Verify no-scores agent
    const noScoresRanks = result.agentRanks.filter(
      (r) => r.agentId === noScoresId,
    );
    expect(noScoresRanks).toHaveLength(0);
  });
});
