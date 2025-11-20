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
import { CompetitionGamesRepository } from "../../competition-games.js";
import { db } from "../db.js";

const logger = pino({ level: "silent" });

describe("CompetitionGamesRepository Integration Tests", () => {
  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  let repository: CompetitionGamesRepository;
  let testCompetitionId: string;
  let testGame1Id: string;
  let testGame2Id: string;

  beforeEach(async () => {
    repository = new CompetitionGamesRepository(db, logger);

    // Create test competition
    testCompetitionId = randomUUID();
    await db.insert(coreSchema.competitions).values({
      id: testCompetitionId,
      name: "Test NFL Competition",
      description: "Test",
      status: "active",
      type: "sports_prediction",
    });

    // Create test games
    testGame1Id = randomUUID();
    await db.insert(sportsSchema.games).values({
      id: testGame1Id,
      providerGameId: 19068,
      season: 2025,
      week: 1,
      startTime: new Date(),
      homeTeam: "CHI",
      awayTeam: "MIN",
      status: "scheduled",
    });

    testGame2Id = randomUUID();
    await db.insert(sportsSchema.games).values({
      id: testGame2Id,
      providerGameId: 19069,
      season: 2025,
      week: 1,
      startTime: new Date(),
      homeTeam: "GB",
      awayTeam: "DET",
      status: "scheduled",
    });
  });

  afterEach(async () => {
    await db.delete(sportsSchema.competitionGames);
    await db.delete(sportsSchema.games);
    await db.delete(coreSchema.competitions);
  });

  describe("create", () => {
    test("should link game to competition", async () => {
      const result = await repository.create({
        competitionId: testCompetitionId,
        gameId: testGame1Id,
      });

      expect(result.id).toBeDefined();
      expect(result.competitionId).toBe(testCompetitionId);
      expect(result.gameId).toBe(testGame1Id);
      expect(result.createdAt).toBeDefined();
    });

    test("should enforce unique constraint on (competitionId, gameId)", async () => {
      await repository.create({
        competitionId: testCompetitionId,
        gameId: testGame1Id,
      });

      // Should throw due to unique constraint
      await expect(
        repository.create({
          competitionId: testCompetitionId,
          gameId: testGame1Id,
        }),
      ).rejects.toThrow();
    });
  });

  describe("findGameIdsByCompetitionId", () => {
    test("should return all game IDs for competition", async () => {
      await repository.create({
        competitionId: testCompetitionId,
        gameId: testGame1Id,
      });

      await repository.create({
        competitionId: testCompetitionId,
        gameId: testGame2Id,
      });

      const gameIds =
        await repository.findGameIdsByCompetitionId(testCompetitionId);

      expect(gameIds).toHaveLength(2);
      expect(gameIds).toContain(testGame1Id);
      expect(gameIds).toContain(testGame2Id);
    });

    test("should return empty array for competition with no games", async () => {
      const gameIds =
        await repository.findGameIdsByCompetitionId(testCompetitionId);

      expect(gameIds).toEqual([]);
    });
  });

  describe("edge cases", () => {
    test("should handle multiple competitions linking to same game", async () => {
      const competition2Id = randomUUID();
      await db.insert(coreSchema.competitions).values({
        id: competition2Id,
        name: "Test NFL Competition 2",
        description: "Test",
        status: "active",
        type: "sports_prediction",
      });

      // Same game in two competitions
      await repository.create({
        competitionId: testCompetitionId,
        gameId: testGame1Id,
      });

      await repository.create({
        competitionId: competition2Id,
        gameId: testGame1Id,
      });

      const comp1Games =
        await repository.findGameIdsByCompetitionId(testCompetitionId);
      const comp2Games =
        await repository.findGameIdsByCompetitionId(competition2Id);

      expect(comp1Games).toHaveLength(1);
      expect(comp2Games).toHaveLength(1);
      expect(comp1Games[0]).toBe(testGame1Id);
      expect(comp2Games[0]).toBe(testGame1Id);
    });
  });
});
