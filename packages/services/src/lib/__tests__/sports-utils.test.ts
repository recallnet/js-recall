import { describe, expect, it } from "vitest";

import { convertLocalToUtc, parseUtcTimestamp } from "../sports-utils.js";

describe("Timestamp Conversion Utilities", () => {
  describe("parseUtcTimestamp", () => {
    it("should parse UTC timestamp by appending Z suffix", () => {
      // DateTimeUTC from API: "2025-11-27T18:00:00"
      const result = parseUtcTimestamp("2025-11-27T18:00:00");

      // Should be interpreted as UTC (18:00 UTC)
      expect(result.toISOString()).toBe("2025-11-27T18:00:00.000Z");
    });

    it("should handle game time during EDT (UTC-4)", () => {
      // September game: DateTimeUTC is 4 hours ahead of Date (EDT)
      const result = parseUtcTimestamp("2025-09-09T00:15:00");

      expect(result.toISOString()).toBe("2025-09-09T00:15:00.000Z");
    });

    it("should handle game time during EST (UTC-5)", () => {
      // November game: DateTimeUTC is 5 hours ahead of Date (EST)
      const result = parseUtcTimestamp("2025-11-27T18:00:00");

      expect(result.toISOString()).toBe("2025-11-27T18:00:00.000Z");
    });
  });

  describe("convertLocalToUtc", () => {
    it("should convert Eastern Time to UTC using EDT offset (UTC-4)", () => {
      // September 8, 2025: Game at 8:15 PM Eastern (EDT)
      // Date: "2025-09-08T20:15:00" (Eastern)
      // DateTimeUTC: "2025-09-09T00:15:00" (UTC)
      // PlayTime: "2025-09-08T20:16:03" (Eastern, 1 min after game start)

      const result = convertLocalToUtc(
        "2025-09-08T20:16:03",
        "2025-09-08T20:15:00",
        "2025-09-09T00:15:00",
      );

      // Should be 2025-09-09T00:16:03 UTC (4 hours later)
      expect(result.toISOString()).toBe("2025-09-09T00:16:03.000Z");
    });

    it("should convert Eastern Time to UTC using EST offset (UTC-5)", () => {
      // November 27, 2025: Game at 1:00 PM Eastern (EST)
      // Date: "2025-11-27T13:00:00" (Eastern)
      // DateTimeUTC: "2025-11-27T18:00:00" (UTC)
      // PlayTime: "2025-11-27T13:05:00" (Eastern, 5 min after game start)

      const result = convertLocalToUtc(
        "2025-11-27T13:05:00",
        "2025-11-27T13:00:00",
        "2025-11-27T18:00:00",
      );

      // Should be 2025-11-27T18:05:00 UTC (5 hours later)
      expect(result.toISOString()).toBe("2025-11-27T18:05:00.000Z");
    });

    it("should convert GameEndDateTime correctly during EDT", () => {
      // September 8, 2025: Game ended at 11:33:59 PM Eastern (EDT)
      // Date: "2025-09-08T20:15:00" (Eastern)
      // DateTimeUTC: "2025-09-09T00:15:00" (UTC)
      // GameEndDateTime: "2025-09-08T23:33:59" (Eastern)

      const result = convertLocalToUtc(
        "2025-09-08T23:33:59",
        "2025-09-08T20:15:00",
        "2025-09-09T00:15:00",
      );

      // Should be 2025-09-09T03:33:59 UTC (4 hours later)
      expect(result.toISOString()).toBe("2025-09-09T03:33:59.000Z");
    });

    it("should handle timestamps that cross midnight when converted", () => {
      // Hypothetical late game ending after midnight Eastern
      // Date: "2025-09-08T20:30:00" (Eastern)
      // DateTimeUTC: "2025-09-09T00:30:00" (UTC)
      // GameEndDateTime: "2025-09-09T00:05:00" (Eastern, after midnight)

      const result = convertLocalToUtc(
        "2025-09-09T00:05:00",
        "2025-09-08T20:30:00",
        "2025-09-09T00:30:00",
      );

      // Should be 2025-09-09T04:05:00 UTC
      expect(result.toISOString()).toBe("2025-09-09T04:05:00.000Z");
    });
  });
});
