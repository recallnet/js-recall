import { pino } from "pino";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import { seasons } from "../../schema/airdrop/defs.js";
import { dropAllSchemas } from "../../utils/drop-all-schemas.js";
import { pushSchema } from "../../utils/push-schema.js";
import { AirdropRepository } from "../airdrop.js";
import { db } from "./db.js";

describe("AirdropRepository getSeasonStartingWithAirdrop Integration Tests", () => {
  let repository: AirdropRepository;
  let logger: ReturnType<typeof pino>;

  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  beforeEach(async () => {
    logger = pino({ level: "silent" });
    repository = new AirdropRepository(db, logger as never);
  });

  afterEach(async () => {
    // Clean up all seasons
    await db.delete(seasons);
  });

  describe("getSeasonStartingWithAirdrop()", () => {
    test("should return null when no seasons exist", async () => {
      const result = await repository.getSeasonStartingWithAirdrop(0);

      expect(result).toBeNull();
    });

    test("should return null when airdrop number does not match any season", async () => {
      // Create a season starting with airdrop 0
      await repository.newSeason({
        startsWithAirdrop: 0,
        name: "Season 1",
        startDate: new Date("2025-01-01T00:00:00Z"),
        endDate: new Date("2025-03-31T23:59:59Z"),
      });

      // Look for a non-existent airdrop number
      const result = await repository.getSeasonStartingWithAirdrop(5);

      expect(result).toBeNull();
    });

    test("should return the correct season for a given airdrop number", async () => {
      await repository.newSeason({
        startsWithAirdrop: 0,
        name: "Season 1",
        startDate: new Date("2025-01-01T00:00:00Z"),
        endDate: new Date("2025-03-31T23:59:59Z"),
      });

      const result = await repository.getSeasonStartingWithAirdrop(0);

      expect(result).not.toBeNull();
      expect(result!.startsWithAirdrop).toBe(0);
      expect(result!.name).toBe("Season 1");
      expect(result!.number).toBe(1); // Generated as startsWithAirdrop + 1
      expect(result!.startDate).toEqual(new Date("2025-01-01T00:00:00Z"));
      expect(result!.endDate).toEqual(new Date("2025-03-31T23:59:59Z"));
    });

    test("should find the correct season among multiple seasons", async () => {
      // Create multiple seasons
      await repository.newSeason({
        startsWithAirdrop: 0,
        name: "Season 1",
        startDate: new Date("2025-01-01T00:00:00Z"),
        endDate: new Date("2025-03-31T23:59:59Z"),
      });

      await repository.newSeason({
        startsWithAirdrop: 3,
        name: "Season 2",
        startDate: new Date("2025-04-01T00:00:00Z"),
        endDate: new Date("2025-06-30T23:59:59Z"),
      });

      await repository.newSeason({
        startsWithAirdrop: 6,
        name: "Season 3",
        startDate: new Date("2025-07-01T00:00:00Z"),
        endDate: new Date("2025-09-30T23:59:59Z"),
      });

      // Look for season 2
      const result = await repository.getSeasonStartingWithAirdrop(3);

      expect(result).not.toBeNull();
      expect(result!.startsWithAirdrop).toBe(3);
      expect(result!.name).toBe("Season 2");
      expect(result!.number).toBe(4); // 3 + 1
    });

    test("should return correct season number (startsWithAirdrop + 1)", async () => {
      await repository.newSeason({
        startsWithAirdrop: 5,
        name: "Season Starting at Airdrop 5",
        startDate: new Date("2025-01-01T00:00:00Z"),
        endDate: new Date("2025-03-31T23:59:59Z"),
      });

      const result = await repository.getSeasonStartingWithAirdrop(5);

      expect(result).not.toBeNull();
      expect(result!.startsWithAirdrop).toBe(5);
      expect(result!.number).toBe(6); // Generated column: startsWithAirdrop + 1
    });

    test("should handle airdrop number 0 (first season)", async () => {
      await repository.newSeason({
        startsWithAirdrop: 0,
        name: "First Season",
        startDate: new Date("2025-01-01T00:00:00Z"),
        endDate: new Date("2025-12-31T23:59:59Z"),
      });

      const result = await repository.getSeasonStartingWithAirdrop(0);

      expect(result).not.toBeNull();
      expect(result!.startsWithAirdrop).toBe(0);
      expect(result!.number).toBe(1);
      expect(result!.name).toBe("First Season");
    });

    test("should handle large airdrop numbers", async () => {
      await repository.newSeason({
        startsWithAirdrop: 999,
        name: "Season 1000",
        startDate: new Date("2030-01-01T00:00:00Z"),
        endDate: new Date("2030-12-31T23:59:59Z"),
      });

      const result = await repository.getSeasonStartingWithAirdrop(999);

      expect(result).not.toBeNull();
      expect(result!.startsWithAirdrop).toBe(999);
      expect(result!.number).toBe(1000);
    });

    test("should return full season object with all fields", async () => {
      const startDate = new Date("2025-06-15T10:30:00Z");
      const endDate = new Date("2025-09-15T18:45:00Z");

      await repository.newSeason({
        startsWithAirdrop: 10,
        name: "Q3 2025",
        startDate,
        endDate,
      });

      const result = await repository.getSeasonStartingWithAirdrop(10);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty("startsWithAirdrop", 10);
      expect(result).toHaveProperty("number", 11);
      expect(result).toHaveProperty("name", "Q3 2025");
      expect(result).toHaveProperty("startDate");
      expect(result).toHaveProperty("endDate");
      expect(result!.startDate).toEqual(startDate);
      expect(result!.endDate).toEqual(endDate);
    });

    test("should not find season when looking for adjacent airdrop numbers", async () => {
      await repository.newSeason({
        startsWithAirdrop: 5,
        name: "Season 6",
        startDate: new Date("2025-01-01T00:00:00Z"),
        endDate: new Date("2025-03-31T23:59:59Z"),
      });

      // Look for adjacent numbers that don't have seasons
      const result4 = await repository.getSeasonStartingWithAirdrop(4);
      const result6 = await repository.getSeasonStartingWithAirdrop(6);

      expect(result4).toBeNull();
      expect(result6).toBeNull();
    });

    test("should handle negative airdrop numbers gracefully", async () => {
      // This tests that the function handles edge cases
      // Negative numbers shouldn't match any season
      const result = await repository.getSeasonStartingWithAirdrop(-1);

      expect(result).toBeNull();
    });
  });
});
