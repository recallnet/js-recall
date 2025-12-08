import { eq } from "drizzle-orm";
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
import { GamesRepository } from "../../games.js";
import { db } from "../db.js";

const logger = pino({ level: "silent" });

describe("GamesRepository Integration Tests", () => {
  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  let repository: GamesRepository;

  beforeEach(() => {
    repository = new GamesRepository(db, logger);
  });

  afterEach(async () => {
    await db.delete(sportsSchema.games);
  });

  describe("upsert", () => {
    test("should create new game", async () => {
      const gameData = {
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: new Date("2025-09-08T19:15:00Z"),
        homeTeam: "CHI" as const,
        awayTeam: "MIN" as const,
        venue: "Soldier Field",
        status: "scheduled" as const,
        spread: 1.5,
        overUnder: 43.5,
      };

      const result = await repository.upsert(gameData);

      expect(result.id).toBeDefined();
      expect(result.providerGameId).toBe(19068);
      expect(result.season).toBe(2025);
      expect(result.week).toBe(1);
      expect(result.homeTeam).toBe("CHI");
      expect(result.awayTeam).toBe("MIN");
      expect(result.venue).toBe("Soldier Field");
      expect(result.status).toBe("scheduled");
      expect(result.spread).toBe(1.5);
      expect(result.overUnder).toBe(43.5);
      expect(result.endTime).toBeNull();
      expect(result.winner).toBeNull();
    });

    test("should update existing game by providerGameId", async () => {
      const gameData = {
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: new Date("2025-09-08T19:15:00Z"),
        homeTeam: "CHI" as const,
        awayTeam: "MIN" as const,
        venue: "Soldier Field",
        status: "scheduled" as const,
      };

      const first = await repository.upsert(gameData);
      expect(first.status).toBe("scheduled");

      // Upsert again with different status
      const updated = await repository.upsert({
        ...gameData,
        status: "in_progress" as const,
      });

      expect(updated.id).toBe(first.id);
      expect(updated.status).toBe("in_progress");

      // Verify only one record exists
      const all = await db
        .select()
        .from(sportsSchema.games)
        .where(eq(sportsSchema.games.providerGameId, 19068));
      expect(all).toHaveLength(1);
    });

    test("should enforce unique constraint on providerGameId", async () => {
      const gameData = {
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: new Date("2025-09-08T19:15:00Z"),
        homeTeam: "CHI" as const,
        awayTeam: "MIN" as const,
        status: "scheduled" as const,
      };

      await repository.upsert(gameData);

      // Should not throw - upsert handles conflicts
      const result = await repository.upsert(gameData);
      expect(result).toBeDefined();
    });

    test("should persist winner and endTime when provided", async () => {
      const baseData = {
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: new Date("2025-09-08T19:15:00Z"),
        homeTeam: "CHI" as const,
        awayTeam: "MIN" as const,
        status: "in_progress" as const,
      };

      await repository.upsert(baseData);

      const endTime = new Date("2025-09-08T22:30:00Z");
      const result = await repository.upsert({
        ...baseData,
        status: "final" as const,
        winner: "MIN" as const,
        endTime,
      });

      expect(result.status).toBe("final");
      expect(result.winner).toBe("MIN");
      expect(result.endTime).not.toBeNull();
      expect(result.endTime?.getTime()).toBe(endTime.getTime());
    });
  });

  describe("findById", () => {
    test("should find game by ID", async () => {
      const game = await repository.upsert({
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: new Date(),
        homeTeam: "CHI",
        awayTeam: "MIN",
        status: "scheduled",
      });

      const found = await repository.findById(game.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(game.id);
      expect(found!.providerGameId).toBe(19068);
    });

    test("should return undefined for non-existent ID", async () => {
      const found = await repository.findById(randomUUID());

      expect(found).toBeUndefined();
    });
  });

  describe("findByProviderGameId", () => {
    test("should find game by provider game ID", async () => {
      await repository.upsert({
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: new Date(),
        homeTeam: "CHI",
        awayTeam: "MIN",
        status: "scheduled",
      });

      const found = await repository.findByProviderGameId(19068);

      expect(found).toBeDefined();
      expect(found!.providerGameId).toBe(19068);
    });

    test("should return undefined for non-existent provider game ID", async () => {
      const found = await repository.findByProviderGameId(99999);

      expect(found).toBeUndefined();
    });
  });

  describe("findByIds", () => {
    test("should find multiple games by IDs", async () => {
      const game1 = await repository.upsert({
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: new Date(),
        homeTeam: "CHI",
        awayTeam: "MIN",
        status: "scheduled",
      });

      const game2 = await repository.upsert({
        providerGameId: 19069,
        season: 2025,
        week: 1,
        startTime: new Date(),
        homeTeam: "GB",
        awayTeam: "DET",
        status: "scheduled",
      });

      const found = await repository.findByIds([game1.id, game2.id]);

      expect(found).toHaveLength(2);
      expect(found.map((g) => g.id)).toContain(game1.id);
      expect(found.map((g) => g.id)).toContain(game2.id);
    });

    test("should return empty array for empty input", async () => {
      const found = await repository.findByIds([]);

      expect(found).toEqual([]);
    });

    test("should return only existing games", async () => {
      const game = await repository.upsert({
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: new Date(),
        homeTeam: "CHI",
        awayTeam: "MIN",
        status: "scheduled",
      });

      const found = await repository.findByIds([game.id, randomUUID()]);

      expect(found).toHaveLength(1);
      expect(found[0]!.id).toBe(game.id);
    });
  });

  describe("updateStatus", () => {
    test("should update game status", async () => {
      const game = await repository.upsert({
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: new Date(),
        homeTeam: "CHI",
        awayTeam: "MIN",
        status: "scheduled",
      });

      const updated = await repository.updateStatus(game.id, "in_progress");

      expect(updated.status).toBe("in_progress");
      expect(updated.id).toBe(game.id);
    });

    test("should throw error for non-existent game", async () => {
      await expect(
        repository.updateStatus(randomUUID(), "in_progress"),
      ).rejects.toThrow("Game not found");
    });
  });

  describe("finalizeGame", () => {
    test("should set end time and winner", async () => {
      const game = await repository.upsert({
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: new Date(),
        homeTeam: "CHI",
        awayTeam: "MIN",
        status: "in_progress",
      });

      const endTime = new Date();
      const finalized = await repository.finalizeGame(game.id, endTime, "MIN");

      expect(finalized.status).toBe("final");
      expect(finalized.winner).toBe("MIN");
      expect(finalized.endTime).toBeDefined();
      expect(finalized.endTime!.getTime()).toBe(endTime.getTime());
    });

    test("should throw error for non-existent game", async () => {
      await expect(
        repository.finalizeGame(randomUUID(), new Date(), "CHI"),
      ).rejects.toThrow("Game not found");
    });
  });

  describe("edge cases", () => {
    test("should handle nullable fields", async () => {
      const game = await repository.upsert({
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: new Date(),
        homeTeam: "CHI",
        awayTeam: "MIN",
        status: "scheduled",
        venue: null,
        spread: null,
        overUnder: null,
      });

      expect(game.venue).toBeNull();
      expect(game.spread).toBeNull();
      expect(game.overUnder).toBeNull();
    });

    test("should handle numeric spreads and over/unders", async () => {
      const game = await repository.upsert({
        providerGameId: 19068,
        season: 2025,
        week: 1,
        startTime: new Date(),
        homeTeam: "CHI",
        awayTeam: "MIN",
        status: "scheduled",
        spread: -3.5,
        overUnder: 47.5,
      });

      expect(game.spread).toBe(-3.5);
      expect(game.overUnder).toBe(47.5);
    });
  });
});
