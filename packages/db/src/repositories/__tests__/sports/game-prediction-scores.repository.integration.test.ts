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
import { GamePredictionScoresRepository } from "../../game-prediction-scores.js";
import { db } from "../db.js";

const logger = pino({ level: "silent" });

describe("GamePredictionScoresRepository Integration Tests", () => {
  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  let repository: GamePredictionScoresRepository;
  let testCompetitionId: string;
  let testGameId: string;
  let testAgent1Id: string;
  let testUserId: string;

  beforeEach(async () => {
    repository = new GamePredictionScoresRepository(db, logger);

    // Create test user
    testUserId = randomUUID();
    await db.insert(coreSchema.users).values({
      id: testUserId,
      walletAddress: `0x${randomUUID().replace(/-/g, "").substring(0, 40)}`,
      name: "Test User",
      status: "active",
    });

    // Create test agent
    testAgent1Id = randomUUID();
    await db.insert(coreSchema.agents).values({
      id: testAgent1Id,
      ownerId: testUserId,
      handle: `agent-${randomUUID().substring(0, 8)}`,
      name: "Test Agent",
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

    // Create test game
    testGameId = randomUUID();
    await db.insert(sportsSchema.games).values({
      id: testGameId,
      providerGameId: 19068,
      season: 2025,
      week: 1,
      startTime: new Date("2025-09-08T19:15:00Z"),
      homeTeam: "CHI",
      awayTeam: "MIN",
      status: "final",
      winner: "MIN",
      endTime: new Date("2025-09-08T23:00:00Z"),
    });
  });

  afterEach(async () => {
    await db.delete(sportsSchema.gamePredictionScores);
    await db.delete(sportsSchema.games);
    await db.delete(coreSchema.competitions);
    await db.delete(coreSchema.agents);
    await db.delete(coreSchema.users);
  });

  describe("upsert", () => {
    test("should create new prediction score", async () => {
      const scoreData = {
        competitionId: testCompetitionId,
        gameId: testGameId,
        agentId: testAgent1Id,
        timeWeightedBrierScore: "0.850",
        finalPrediction: "MIN" as const,
        finalConfidence: "0.90",
        predictionCount: 3,
      };

      const result = await repository.upsert(scoreData);

      expect(result.id).toBeDefined();
      expect(result.competitionId).toBe(testCompetitionId);
      expect(result.gameId).toBe(testGameId);
      expect(result.agentId).toBe(testAgent1Id);
      expect(result.timeWeightedBrierScore).toBe("0.850");
      expect(result.finalPrediction).toBe("MIN");
      expect(result.finalConfidence).toBe("0.90");
      expect(result.predictionCount).toBe(3);
    });

    test("should update existing score", async () => {
      const scoreData = {
        competitionId: testCompetitionId,
        gameId: testGameId,
        agentId: testAgent1Id,
        timeWeightedBrierScore: "0.850",
        finalPrediction: "MIN" as const,
        finalConfidence: "0.90",
        predictionCount: 3,
      };

      const first = await repository.upsert(scoreData);

      // Update score
      const updated = await repository.upsert({
        ...scoreData,
        timeWeightedBrierScore: "0.900",
        predictionCount: 4,
      });

      expect(updated.id).toBe(first.id);
      expect(updated.timeWeightedBrierScore).toBe("0.900");
      expect(updated.predictionCount).toBe(4);
    });
  });

  describe("findByCompetitionAndGame", () => {
    test("should find all scores for a game sorted by score DESC", async () => {
      const agent2Id = randomUUID();
      await db.insert(coreSchema.agents).values({
        id: agent2Id,
        ownerId: testUserId,
        handle: `agent2-${randomUUID().substring(0, 8)}`,
        name: "Test Agent 2",
        apiKey: `key-${randomUUID()}`,
        status: "active",
      });

      await repository.upsert({
        competitionId: testCompetitionId,
        gameId: testGameId,
        agentId: testAgent1Id,
        timeWeightedBrierScore: "0.700",
        finalPrediction: "CHI",
        finalConfidence: "0.80",
        predictionCount: 2,
      });

      await repository.upsert({
        competitionId: testCompetitionId,
        gameId: testGameId,
        agentId: agent2Id,
        timeWeightedBrierScore: "0.950",
        finalPrediction: "MIN",
        finalConfidence: "0.95",
        predictionCount: 1,
      });

      const scores = await repository.findByCompetitionAndGame(
        testCompetitionId,
        testGameId,
      );

      expect(scores).toHaveLength(2);
      // Higher score first
      expect(scores[0]!.timeWeightedBrierScore).toBe("0.950");
      expect(scores[0]!.agentId).toBe(agent2Id);
      expect(scores[1]!.timeWeightedBrierScore).toBe("0.700");
      expect(scores[1]!.agentId).toBe(testAgent1Id);
    });
  });

  describe("findByCompetitionAndAgent", () => {
    test("should find all scores for agent in competition", async () => {
      const game2Id = randomUUID();
      await db.insert(sportsSchema.games).values({
        id: game2Id,
        providerGameId: 19069,
        season: 2025,
        week: 2,
        startTime: new Date(),
        homeTeam: "GB",
        awayTeam: "DET",
        status: "final",
        winner: "GB",
        endTime: new Date(),
      });

      await repository.upsert({
        competitionId: testCompetitionId,
        gameId: testGameId,
        agentId: testAgent1Id,
        timeWeightedBrierScore: "0.850",
        finalPrediction: "MIN",
        finalConfidence: "0.90",
        predictionCount: 2,
      });

      await repository.upsert({
        competitionId: testCompetitionId,
        gameId: game2Id,
        agentId: testAgent1Id,
        timeWeightedBrierScore: "0.750",
        finalPrediction: "GB",
        finalConfidence: "0.85",
        predictionCount: 1,
      });

      const scores = await repository.findByCompetitionAndAgent(
        testCompetitionId,
        testAgent1Id,
      );

      expect(scores).toHaveLength(2);
      expect(scores.map((s) => s.gameId)).toContain(testGameId);
      expect(scores.map((s) => s.gameId)).toContain(game2Id);
    });
  });

  describe("edge cases", () => {
    test("should handle nullable fields", async () => {
      const result = await repository.upsert({
        competitionId: testCompetitionId,
        gameId: testGameId,
        agentId: testAgent1Id,
        timeWeightedBrierScore: "0.850",
        finalPrediction: null,
        finalConfidence: null,
        predictionCount: 0,
      });

      expect(result.finalPrediction).toBeNull();
      expect(result.finalConfidence).toBeNull();
      expect(result.predictionCount).toBe(0);
    });

    test("should handle perfect score (1.0)", async () => {
      const result = await repository.upsert({
        competitionId: testCompetitionId,
        gameId: testGameId,
        agentId: testAgent1Id,
        timeWeightedBrierScore: "1.000000",
        finalPrediction: "MIN",
        finalConfidence: "1.00",
        predictionCount: 1,
      });

      expect(result.timeWeightedBrierScore).toBe("1.000000");
    });

    test("should handle zero score", async () => {
      const result = await repository.upsert({
        competitionId: testCompetitionId,
        gameId: testGameId,
        agentId: testAgent1Id,
        timeWeightedBrierScore: "0.000000",
        finalPrediction: "CHI",
        finalConfidence: "1.00",
        predictionCount: 1,
      });

      expect(result.timeWeightedBrierScore).toBe("0.000000");
    });
  });
});
