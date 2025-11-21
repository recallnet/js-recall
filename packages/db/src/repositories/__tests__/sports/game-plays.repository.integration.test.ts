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

import * as sportsSchema from "../../../schema/sports/defs.js";
import { dropAllSchemas } from "../../../utils/drop-all-schemas.js";
import { pushSchema } from "../../../utils/push-schema.js";
import { GamePlaysRepository } from "../../game-plays.js";
import { db } from "../db.js";

const logger = pino({ level: "silent" });

describe("GamePlaysRepository Integration Tests", () => {
  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  let repository: GamePlaysRepository;
  let testGameId: string;

  beforeEach(async () => {
    repository = new GamePlaysRepository(db, logger);

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
      status: "in_progress",
    });
  });

  afterEach(async () => {
    await db.delete(sportsSchema.gamePlays);
    await db.delete(sportsSchema.games);
  });

  describe("upsert", () => {
    test("should create new play", async () => {
      const playData = {
        gameId: testGameId,
        providerPlayId: "12345",
        sequence: 1,
        quarterName: "1",
        timeRemainingMinutes: 15,
        timeRemainingSeconds: 0,
        playTime: new Date("2025-09-08T19:20:00Z"),
        down: 1,
        distance: 10,
        yardLine: 25,
        yardLineTerritory: "CHI",
        yardsToEndZone: 75,
        playType: "Pass",
        team: "MIN" as const,
        opponent: "CHI" as const,
        description: "Pass complete for 8 yards",
      };

      const result = await repository.upsert(playData);

      expect(result.id).toBeDefined();
      expect(result.gameId).toBe(testGameId);
      expect(result.sequence).toBe(1);
      expect(result.playType).toBe("Pass");
    });

    test("should update existing play by gameId and sequence", async () => {
      const playData = {
        gameId: testGameId,
        providerPlayId: "12345",
        sequence: 1,
        quarterName: "1",
        team: "MIN" as const,
        opponent: "CHI" as const,
        description: "Original description",
        playType: "Pass",
      };

      const first = await repository.upsert(playData);

      // Upsert with same sequence but different description
      const updated = await repository.upsert({
        ...playData,
        description: "Updated description",
      });

      expect(updated.id).toBe(first.id);
      expect(updated.description).toBe("Updated description");
    });
  });

  describe("findByGameId", () => {
    test("should find plays with pagination", async () => {
      // Create multiple plays
      for (let i = 1; i <= 5; i++) {
        await repository.upsert({
          gameId: testGameId,
          sequence: i,
          quarterName: "1",
          team: "MIN",
          opponent: "CHI",
          playType: "Pass",
        });
      }

      const plays = await repository.findByGameId(testGameId, {
        limit: 3,
        offset: 0,
        sort: "",
      });

      expect(plays).toHaveLength(3);
    });

    test("should handle empty results", async () => {
      const plays = await repository.findByGameId(testGameId, {
        limit: 10,
        offset: 0,
        sort: "",
      });

      expect(plays).toEqual([]);
    });
  });

  describe("findById", () => {
    test("should find play by ID", async () => {
      const play = await repository.upsert({
        gameId: testGameId,
        sequence: 1,
        quarterName: "1",
        team: "MIN",
        opponent: "CHI",
        playType: "Pass",
      });

      const found = await repository.findById(play.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(play.id);
    });

    test("should return undefined for non-existent ID", async () => {
      const found = await repository.findById(randomUUID());

      expect(found).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    test("should handle nullable fields", async () => {
      const play = await repository.upsert({
        gameId: testGameId,
        sequence: 1,
        quarterName: "1",
        team: "MIN",
        opponent: "CHI",
        playType: "Kickoff",
        down: null,
        distance: null,
        yardLine: null,
        description: null,
      });

      expect(play.down).toBeNull();
      expect(play.distance).toBeNull();
      expect(play.yardLine).toBeNull();
      expect(play.description).toBeNull();
    });
  });
});
