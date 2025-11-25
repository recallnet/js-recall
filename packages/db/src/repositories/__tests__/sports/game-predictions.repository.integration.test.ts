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
import { GamePredictionsRepository } from "../../game-predictions.js";
import { db } from "../db.js";

const logger = pino({ level: "silent" });

describe("GamePredictionsRepository Integration Tests", () => {
  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  let repository: GamePredictionsRepository;
  let testCompetitionId: string;
  let testGameId: string;
  let testAgentId: string;
  let testUserId: string;

  beforeEach(async () => {
    repository = new GamePredictionsRepository(db, logger);

    // Create test user
    testUserId = randomUUID();
    await db.insert(coreSchema.users).values({
      id: testUserId,
      walletAddress: `0x${randomUUID().replace(/-/g, "").substring(0, 40)}`,
      name: "Test User",
      status: "active",
    });

    // Create test agent
    testAgentId = randomUUID();
    await db.insert(coreSchema.agents).values({
      id: testAgentId,
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
      status: "scheduled",
    });
  });

  afterEach(async () => {
    // Clean up in reverse order of creation
    await db.delete(sportsSchema.gamePredictions);
    await db.delete(sportsSchema.games);
    await db.delete(coreSchema.competitions);
    await db.delete(coreSchema.agents);
    await db.delete(coreSchema.users);
  });

  describe("create", () => {
    test("should create new prediction", async () => {
      const predictionData = {
        competitionId: testCompetitionId,
        gameId: testGameId,
        agentId: testAgentId,
        predictedWinner: "MIN" as const,
        confidence: 0.85,
        reason: "Strong offensive line",
      };

      const result = await repository.create(predictionData);

      expect(result.id).toBeDefined();
      expect(result.competitionId).toBe(testCompetitionId);
      expect(result.gameId).toBe(testGameId);
      expect(result.agentId).toBe(testAgentId);
      expect(result.predictedWinner).toBe("MIN");
      expect(result.confidence).toBeCloseTo(0.85, 5);
      expect(result.reason).toBe("Strong offensive line");
      expect(result.createdAt).toBeDefined();
    });

    test("should allow multiple predictions from same agent", async () => {
      const baseData = {
        competitionId: testCompetitionId,
        gameId: testGameId,
        agentId: testAgentId,
        confidence: 0.85,
        reason: "Test",
      };

      await repository.create({
        ...baseData,
        predictedWinner: "CHI",
      });

      await repository.create({
        ...baseData,
        predictedWinner: "MIN",
        confidence: 0.9,
      });

      const history = await repository.findByGameAndAgent(
        testGameId,
        testAgentId,
        testCompetitionId,
      );

      expect(history).toHaveLength(2);
    });
  });

  describe("findByGame", () => {
    test("should find all predictions for a game", async () => {
      // Create second agent
      const agent2Id = randomUUID();
      await db.insert(coreSchema.agents).values({
        id: agent2Id,
        ownerId: testUserId,
        handle: `agent2-${randomUUID().substring(0, 8)}`,
        name: "Test Agent 2",
        apiKey: `key-${randomUUID()}`,
        status: "active",
      });

      // Create predictions from both agents
      await repository.create({
        competitionId: testCompetitionId,
        gameId: testGameId,
        agentId: testAgentId,
        predictedWinner: "CHI",
        confidence: 0.7,
        reason: "Test 1",
      });

      await repository.create({
        competitionId: testCompetitionId,
        gameId: testGameId,
        agentId: agent2Id,
        predictedWinner: "MIN",
        confidence: 0.8,
        reason: "Test 2",
      });

      const predictions = await repository.findByGame(
        testGameId,
        testCompetitionId,
      );

      expect(predictions).toHaveLength(2);
      expect(predictions.map((p) => p.agentId)).toContain(testAgentId);
      expect(predictions.map((p) => p.agentId)).toContain(agent2Id);
    });

    test("should return empty array for game with no predictions", async () => {
      const predictions = await repository.findByGame(
        testGameId,
        testCompetitionId,
      );

      expect(predictions).toEqual([]);
    });
  });

  describe("findByGameAndAgent (sorted history)", () => {
    test("should return predictions sorted by createdAt DESC", async () => {
      // Create predictions with slight delay
      const pred1 = await repository.create({
        competitionId: testCompetitionId,
        gameId: testGameId,
        agentId: testAgentId,
        predictedWinner: "CHI",
        confidence: 0.7,
        reason: "First",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const pred2 = await repository.create({
        competitionId: testCompetitionId,
        gameId: testGameId,
        agentId: testAgentId,
        predictedWinner: "MIN",
        confidence: 0.8,
        reason: "Second",
      });

      const history = await repository.findByGameAndAgent(
        testGameId,
        testAgentId,
        testCompetitionId,
      );

      expect(history).toHaveLength(2);
      // Most recent first
      expect(history[0]!.id).toBe(pred2.id);
      expect(history[1]!.id).toBe(pred1.id);
    });
  });

  describe("findLatestByGameAndAgent", () => {
    test("should return most recent prediction", async () => {
      await repository.create({
        competitionId: testCompetitionId,
        gameId: testGameId,
        agentId: testAgentId,
        predictedWinner: "CHI",
        confidence: 0.7,
        reason: "First",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const latest = await repository.create({
        competitionId: testCompetitionId,
        gameId: testGameId,
        agentId: testAgentId,
        predictedWinner: "MIN",
        confidence: 0.9,
        reason: "Updated",
      });

      const found = await repository.findLatestByGameAndAgent(
        testGameId,
        testAgentId,
        testCompetitionId,
      );

      expect(found).toBeDefined();
      expect(found!.id).toBe(latest.id);
      expect(found!.predictedWinner).toBe("MIN");
      expect(found!.confidence).toBeCloseTo(0.9, 5);
    });

    test("should return undefined for agent with no predictions", async () => {
      const found = await repository.findLatestByGameAndAgent(
        testGameId,
        testAgentId,
        testCompetitionId,
      );

      expect(found).toBeUndefined();
    });
  });

  describe("findByGameAndAgent", () => {
    test("should find all predictions for specific game and agent", async () => {
      // Create another agent
      const agent2Id = randomUUID();
      await db.insert(coreSchema.agents).values({
        id: agent2Id,
        ownerId: testUserId,
        handle: `agent2-${randomUUID().substring(0, 8)}`,
        name: "Test Agent 2",
        apiKey: `key-${randomUUID()}`,
        status: "active",
      });

      // Create predictions from both agents
      await repository.create({
        competitionId: testCompetitionId,
        gameId: testGameId,
        agentId: testAgentId,
        predictedWinner: "CHI",
        confidence: 0.7,
        reason: "Test",
      });

      await repository.create({
        competitionId: testCompetitionId,
        gameId: testGameId,
        agentId: agent2Id,
        predictedWinner: "MIN",
        confidence: 0.8,
        reason: "Test",
      });

      const predictions = await repository.findByGameAndAgent(
        testGameId,
        testAgentId,
        testCompetitionId,
      );

      expect(predictions).toHaveLength(1);
      expect(predictions[0]!.agentId).toBe(testAgentId);
    });
  });
});
