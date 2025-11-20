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

import * as coreSchema from "../../../schema/core/defs.js";
import * as sportsSchema from "../../../schema/sports/defs.js";
import { dropAllSchemas } from "../../../utils/drop-all-schemas.js";
import { pushSchema } from "../../../utils/push-schema.js";
import { CompetitionAggregateScoresRepository } from "../../competition-aggregate-scores.js";
import { db } from "../db.js";

const logger = pino({ level: "silent" });

describe("CompetitionAggregateScoresRepository Integration Tests", () => {
  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  let repository: CompetitionAggregateScoresRepository;
  let testCompetitionId: string;
  let testAgent1Id: string;
  let testAgent2Id: string;
  let testUserId: string;

  beforeEach(async () => {
    repository = new CompetitionAggregateScoresRepository(db, logger);

    // Create test user
    testUserId = randomUUID();
    await db.insert(coreSchema.users).values({
      id: testUserId,
      walletAddress: `0x${randomUUID().replace(/-/g, "").substring(0, 40)}`,
      name: "Test User",
      status: "active",
    });

    // Create test agents
    testAgent1Id = randomUUID();
    await db.insert(coreSchema.agents).values({
      id: testAgent1Id,
      ownerId: testUserId,
      handle: `agent1-${randomUUID().substring(0, 8)}`,
      name: "Test Agent 1",
      apiKey: `key-${randomUUID()}`,
      status: "active",
    });

    testAgent2Id = randomUUID();
    await db.insert(coreSchema.agents).values({
      id: testAgent2Id,
      ownerId: testUserId,
      handle: `agent2-${randomUUID().substring(0, 8)}`,
      name: "Test Agent 2",
      apiKey: `key-${randomUUID()}`,
      status: "active",
    });

    // Create test competition
    testCompetitionId = randomUUID();
    await db.insert(coreSchema.competitions).values({
      id: testCompetitionId,
      name: "Test NFL Competition",
      description: "Test",
      status: "active",
      type: "sports_prediction",
    });
  });

  afterEach(async () => {
    await db.delete(sportsSchema.competitionAggregateScores);
    await db.delete(coreSchema.competitions);
    await db.delete(coreSchema.agents);
    await db.delete(coreSchema.users);
  });

  describe("upsert", () => {
    test("should create new aggregate score", async () => {
      const scoreData = {
        competitionId: testCompetitionId,
        agentId: testAgent1Id,
        averageBrierScore: "0.850",
        gamesScored: 5,
      };

      const result = await repository.upsert(scoreData);

      expect(result.id).toBeDefined();
      expect(result.competitionId).toBe(testCompetitionId);
      expect(result.agentId).toBe(testAgent1Id);
      expect(result.averageBrierScore).toBe("0.850");
      expect(result.gamesScored).toBe(5);
    });

    test("should update existing aggregate score", async () => {
      const scoreData = {
        competitionId: testCompetitionId,
        agentId: testAgent1Id,
        averageBrierScore: "0.850",
        gamesScored: 5,
      };

      const first = await repository.upsert(scoreData);

      // Update with new score
      const updated = await repository.upsert({
        ...scoreData,
        averageBrierScore: "0.900",
        gamesScored: 6,
      });

      expect(updated.id).toBe(first.id);
      expect(updated.averageBrierScore).toBe("0.900");
      expect(updated.gamesScored).toBe(6);
    });

    test("should enforce unique constraint on (competitionId, agentId)", async () => {
      const scoreData = {
        competitionId: testCompetitionId,
        agentId: testAgent1Id,
        averageBrierScore: "0.850",
        gamesScored: 5,
      };

      await repository.upsert(scoreData);

      // Should not throw - upsert handles conflicts
      const result = await repository.upsert(scoreData);
      expect(result).toBeDefined();
    });
  });

  describe("findByCompetition", () => {
    test("should find all scores for competition sorted by averageBrierScore DESC", async () => {
      // Create scores for two agents
      await repository.upsert({
        competitionId: testCompetitionId,
        agentId: testAgent1Id,
        averageBrierScore: "0.850",
        gamesScored: 5,
      });

      await repository.upsert({
        competitionId: testCompetitionId,
        agentId: testAgent2Id,
        averageBrierScore: "0.920",
        gamesScored: 5,
      });

      const scores = await repository.findByCompetition(testCompetitionId);

      expect(scores).toHaveLength(2);
      // Should be sorted by score descending (higher is better)
      expect(scores[0]!.averageBrierScore).toBe("0.920");
      expect(scores[0]!.agentId).toBe(testAgent2Id);
      expect(scores[1]!.averageBrierScore).toBe("0.850");
      expect(scores[1]!.agentId).toBe(testAgent1Id);
    });

    test("should return empty array for competition with no scores", async () => {
      const scores = await repository.findByCompetition(testCompetitionId);

      expect(scores).toEqual([]);
    });
  });

  describe("findByCompetitionAndAgent", () => {
    test("should find score for specific competition and agent", async () => {
      await repository.upsert({
        competitionId: testCompetitionId,
        agentId: testAgent1Id,
        averageBrierScore: "0.850",
        gamesScored: 5,
      });

      await repository.upsert({
        competitionId: testCompetitionId,
        agentId: testAgent2Id,
        averageBrierScore: "0.920",
        gamesScored: 5,
      });

      const score = await repository.findByCompetitionAndAgent(
        testCompetitionId,
        testAgent1Id,
      );

      expect(score).toBeDefined();
      expect(score!.agentId).toBe(testAgent1Id);
      expect(score!.averageBrierScore).toBe("0.850");
    });

    test("should return undefined for non-existent score", async () => {
      const score = await repository.findByCompetitionAndAgent(
        testCompetitionId,
        testAgent1Id,
      );

      expect(score).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    test("should handle scores with zero games", async () => {
      const result = await repository.upsert({
        competitionId: testCompetitionId,
        agentId: testAgent1Id,
        averageBrierScore: "0.000",
        gamesScored: 0,
      });

      expect(result.gamesScored).toBe(0);
      expect(result.averageBrierScore).toBe("0.000");
    });

    test("should handle perfect and zero scores", async () => {
      await repository.upsert({
        competitionId: testCompetitionId,
        agentId: testAgent1Id,
        averageBrierScore: "1.000",
        gamesScored: 5,
      });

      await repository.upsert({
        competitionId: testCompetitionId,
        agentId: testAgent2Id,
        averageBrierScore: "0.000",
        gamesScored: 5,
      });

      const scores = await repository.findByCompetition(testCompetitionId);

      expect(scores).toHaveLength(2);
      expect(scores[0]!.averageBrierScore).toBe("1.000");
      expect(scores[1]!.averageBrierScore).toBe("0.000");
    });
  });
});
