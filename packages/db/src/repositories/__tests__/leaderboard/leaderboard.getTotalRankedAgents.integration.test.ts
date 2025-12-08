import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
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

describe("LeaderboardRepository.getTotalRankedAgents() Integration Tests", () => {
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

  test("should return 0 when no agent scores exist", async () => {
    const count = await repository.getTotalRankedAgents();

    expect(count).toBe(0);
  });

  test("should return 1 when one agent has a score", async () => {
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      walletAddress: `0x${randomUUID().replace(/-/g, "").substring(0, 40)}`,
      name: "Test User",
      status: "active",
    });

    const agentId = randomUUID();
    await db.insert(agents).values({
      id: agentId,
      ownerId: userId,
      handle: `agent-${randomUUID().substring(0, 8)}`,
      name: "Test Agent",
      apiKey: `key-${randomUUID()}`,
      status: "active",
    });
    await db.insert(agentScore).values({
      id: randomUUID(),
      agentId,
      type: "trading",
      mu: 25.0,
      sigma: 8.333,
      ordinal: 0.0,
    });

    const count = await repository.getTotalRankedAgents();
    expect(count).toBe(1);
  });

  test("should return correct count with multiple distinct agents", async () => {
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      walletAddress: `0x${randomUUID().replace(/-/g, "").substring(0, 40)}`,
      name: "Test User",
      status: "active",
    });

    const agentCount = 5;
    for (let i = 0; i < agentCount; i++) {
      const agentId = randomUUID();
      await db.insert(agents).values({
        id: agentId,
        ownerId: userId,
        handle: `agent-${randomUUID().substring(0, 8)}`,
        name: `Test Agent ${i + 1}`,
        apiKey: `key-${randomUUID()}`,
        status: "active",
      });

      await db.insert(agentScore).values({
        id: randomUUID(),
        agentId,
        type: "trading",
        mu: 25.0 + i,
        sigma: 8.333,
        ordinal: i * 10.0,
      });
    }

    const count = await repository.getTotalRankedAgents();
    expect(count).toBe(agentCount);
  });

  test("should count each agent only once when agent has score in single competition type", async () => {
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      walletAddress: `0x${randomUUID().replace(/-/g, "").substring(0, 40)}`,
      name: "Test User",
      status: "active",
    });

    const agent1Id = randomUUID();
    const agent2Id = randomUUID();
    const agent3Id = randomUUID();

    await db.insert(agents).values([
      {
        id: agent1Id,
        ownerId: userId,
        handle: `agent-${randomUUID().substring(0, 8)}`,
        name: "Agent 1",
        apiKey: `key-${randomUUID()}`,
        status: "active",
      },
      {
        id: agent2Id,
        ownerId: userId,
        handle: `agent-${randomUUID().substring(0, 8)}`,
        name: "Agent 2",
        apiKey: `key-${randomUUID()}`,
        status: "active",
      },
      {
        id: agent3Id,
        ownerId: userId,
        handle: `agent-${randomUUID().substring(0, 8)}`,
        name: "Agent 3",
        apiKey: `key-${randomUUID()}`,
        status: "active",
      },
    ]);

    await db.insert(agentScore).values([
      {
        id: randomUUID(),
        agentId: agent1Id,
        type: "trading",
        mu: 25.0,
        sigma: 8.333,
        ordinal: 0.0,
      },
      {
        id: randomUUID(),
        agentId: agent2Id,
        type: "trading",
        mu: 26.0,
        sigma: 8.0,
        ordinal: 5.0,
      },
      {
        id: randomUUID(),
        agentId: agent3Id,
        type: "trading",
        mu: 27.0,
        sigma: 7.5,
        ordinal: 10.0,
      },
    ]);

    const count = await repository.getTotalRankedAgents();
    expect(count).toBe(3);
  });

  test("should return correct count after agents are removed", async () => {
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      walletAddress: `0x${randomUUID().replace(/-/g, "").substring(0, 40)}`,
      name: "Test User",
      status: "active",
    });

    const agentIds = [];
    for (let i = 0; i < 3; i++) {
      const agentId = randomUUID();
      agentIds.push(agentId);

      await db.insert(agents).values({
        id: agentId,
        ownerId: userId,
        handle: `agent-${randomUUID().substring(0, 8)}`,
        name: `Test Agent ${i + 1}`,
        apiKey: `key-${randomUUID()}`,
        status: "active",
      });

      await db.insert(agentScore).values({
        id: randomUUID(),
        agentId,
        type: "trading",
        mu: 25.0 + i,
        sigma: 8.333,
        ordinal: i * 10.0,
      });
    }

    let count = await repository.getTotalRankedAgents();
    expect(count).toBe(3);

    await db.delete(agents).where(eq(agents.id, agentIds[0]!));

    // Verify count decreased
    count = await repository.getTotalRankedAgents();
    expect(count).toBe(2);
    await db.delete(agents).where(eq(agents.id, agentIds[1]!));
    count = await repository.getTotalRankedAgents();
    expect(count).toBe(1);
  });

  test("should handle large number of agents efficiently", async () => {
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      walletAddress: `0x${randomUUID().replace(/-/g, "").substring(0, 40)}`,
      name: "Test User",
      status: "active",
    });

    const agentCount = 100;
    const batchSize = 10;
    for (let batch = 0; batch < agentCount / batchSize; batch++) {
      const agentBatch = [];
      const scoreBatch = [];

      for (let i = 0; i < batchSize; i++) {
        const agentId = randomUUID();
        agentBatch.push({
          id: agentId,
          ownerId: userId,
          handle: `agent-${randomUUID().substring(0, 8)}`,
          name: `Test Agent ${batch * batchSize + i + 1}`,
          apiKey: `key-${randomUUID()}`,
          status: "active" as const,
        });
        scoreBatch.push({
          id: randomUUID(),
          agentId,
          type: "trading" as const,
          mu: 25.0 + (batch * batchSize + i),
          sigma: 8.333,
          ordinal: (batch * batchSize + i) * 10.0,
        });
      }

      await db.insert(agents).values(agentBatch);
      await db.insert(agentScore).values(scoreBatch);
    }

    const count = await repository.getTotalRankedAgents();

    expect(count).toBe(agentCount);
  });
});
