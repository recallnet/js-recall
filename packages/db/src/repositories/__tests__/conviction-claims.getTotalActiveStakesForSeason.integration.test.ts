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
import { convictionClaims } from "../../schema/conviction-claims/defs.js";
import { dropAllSchemas } from "../../utils/drop-all-schemas.js";
import { pushSchema } from "../../utils/push-schema.js";
import { AirdropRepository } from "../airdrop.js";
import { ConvictionClaimsRepository } from "../conviction-claims.js";
import { db } from "./db.js";

describe("ConvictionClaimsRepository getTotalActiveStakesForSeason Integration Tests", () => {
  let repository: ConvictionClaimsRepository;
  let airdropRepository: AirdropRepository;
  let logger: ReturnType<typeof pino>;

  // Test accounts
  const wallet1 = "0x1111111111111111111111111111111111111111";
  const wallet2 = "0x2222222222222222222222222222222222222222";
  const wallet3 = "0x3333333333333333333333333333333333333333";

  // Season end date for tests
  const seasonEndDate = new Date("2025-03-31T23:59:59Z");

  // Helper constants
  const ONE_DAY_SECONDS = 86400n;
  const ONE_WEEK_SECONDS = 604800n;

  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  beforeEach(async () => {
    logger = pino({ level: "silent" });
    repository = new ConvictionClaimsRepository(db, logger as never);
    airdropRepository = new AirdropRepository(db, logger as never);

    // Create a season (required for foreign key constraint)
    await airdropRepository.newSeason({
      startsWithAirdrop: 0,
      name: "Season 1",
      startDate: new Date("2025-01-01T00:00:00Z"),
      endDate: new Date("2025-03-31T23:59:59Z"),
    });
  });

  afterEach(async () => {
    // Clean up in reverse dependency order
    await db.delete(convictionClaims);
    await db.delete(seasons);
  });

  /**
   * Helper to create a conviction claim (stake).
   */
  async function createClaim(params: {
    account: string;
    claimedAmount: bigint;
    duration: bigint;
    blockTimestamp: Date;
    season?: number;
  }) {
    return repository.insertClaim({
      account: params.account,
      eligibleAmount: params.claimedAmount,
      claimedAmount: params.claimedAmount,
      season: params.season ?? 0,
      duration: params.duration,
      blockNumber: 1000000n,
      blockTimestamp: params.blockTimestamp,
      transactionHash: Buffer.from(
        `tx-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ),
    });
  }

  describe("getTotalActiveStakesForSeason()", () => {
    test("should return 0 when no stakes exist", async () => {
      const result =
        await repository.getTotalActiveStakesForSeason(seasonEndDate);

      expect(result).toBe(0n);
    });

    test("should return 0 when stakes have duration 0 (claims only)", async () => {
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: 0n,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      const result =
        await repository.getTotalActiveStakesForSeason(seasonEndDate);

      expect(result).toBe(0n);
    });

    test("should return stake amount that extends past season end", async () => {
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: 90n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      const result =
        await repository.getTotalActiveStakesForSeason(seasonEndDate);

      expect(result).toBe(1000n);
    });

    test("should return 0 when stake expires before season end", async () => {
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: 30n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-01-01T00:00:00Z"),
      });

      const result =
        await repository.getTotalActiveStakesForSeason(seasonEndDate);

      expect(result).toBe(0n);
    });

    test("should return 0 when stake expires exactly at season end", async () => {
      const stakeStart = new Date("2025-02-01T00:00:00Z");
      const durationMs = seasonEndDate.getTime() - stakeStart.getTime();
      const durationSeconds = BigInt(Math.floor(durationMs / 1000));

      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: durationSeconds,
        blockTimestamp: stakeStart,
      });

      const result =
        await repository.getTotalActiveStakesForSeason(seasonEndDate);

      expect(result).toBe(0n);
    });

    test("should include stake that extends 1 second past season end", async () => {
      const stakeStart = new Date("2025-02-01T00:00:00Z");
      const durationMs = seasonEndDate.getTime() - stakeStart.getTime();
      const durationSeconds = BigInt(Math.floor(durationMs / 1000)) + 1n;

      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: durationSeconds,
        blockTimestamp: stakeStart,
      });

      const result =
        await repository.getTotalActiveStakesForSeason(seasonEndDate);

      expect(result).toBe(1000n);
    });

    test("should return 0 when stake created after season end", async () => {
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: 90n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-04-01T00:00:00Z"),
      });

      const result =
        await repository.getTotalActiveStakesForSeason(seasonEndDate);

      expect(result).toBe(0n);
    });

    test("should sum multiple stakes from the same account", async () => {
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: 90n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-01-15T00:00:00Z"),
      });

      await createClaim({
        account: wallet1,
        claimedAmount: 2000n,
        duration: 120n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      await createClaim({
        account: wallet1,
        claimedAmount: 500n,
        duration: 60n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-03-01T00:00:00Z"),
      });

      const result =
        await repository.getTotalActiveStakesForSeason(seasonEndDate);

      expect(result).toBe(3500n);
    });

    test("should sum stakes from multiple accounts", async () => {
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: 90n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      await createClaim({
        account: wallet2,
        claimedAmount: 2000n,
        duration: 120n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-01-15T00:00:00Z"),
      });

      await createClaim({
        account: wallet3,
        claimedAmount: 3000n,
        duration: 100n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-02-15T00:00:00Z"),
      });

      const result =
        await repository.getTotalActiveStakesForSeason(seasonEndDate);

      expect(result).toBe(6000n);
    });

    test("should only sum active stakes, excluding expired ones", async () => {
      // Active stake
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: 90n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      // Expired stake (should not be counted)
      await createClaim({
        account: wallet1,
        claimedAmount: 5000n,
        duration: ONE_WEEK_SECONDS,
        blockTimestamp: new Date("2025-01-01T00:00:00Z"),
      });

      const result =
        await repository.getTotalActiveStakesForSeason(seasonEndDate);

      expect(result).toBe(1000n);
    });

    test("should handle mixed active and expired stakes across accounts", async () => {
      // Wallet 1: active stake (1000)
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: 90n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      // Wallet 2: expired stake (not counted)
      await createClaim({
        account: wallet2,
        claimedAmount: 2000n,
        duration: ONE_WEEK_SECONDS,
        blockTimestamp: new Date("2025-01-01T00:00:00Z"),
      });

      // Wallet 3: one active (500), one expired (not counted)
      await createClaim({
        account: wallet3,
        claimedAmount: 500n,
        duration: 100n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-02-15T00:00:00Z"),
      });

      await createClaim({
        account: wallet3,
        claimedAmount: 1500n,
        duration: 10n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-01-01T00:00:00Z"),
      });

      const result =
        await repository.getTotalActiveStakesForSeason(seasonEndDate);

      expect(result).toBe(1500n); // 1000 + 500
    });

    test("should handle large stake amounts", async () => {
      const largeAmount = BigInt("999999999999999999999999999999");

      await createClaim({
        account: wallet1,
        claimedAmount: largeAmount,
        duration: 90n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      const result =
        await repository.getTotalActiveStakesForSeason(seasonEndDate);

      expect(result).toBe(largeAmount);
    });

    test("should handle summing multiple large amounts", async () => {
      const largeAmount1 = BigInt("500000000000000000000000000000");
      const largeAmount2 = BigInt("400000000000000000000000000000");

      await createClaim({
        account: wallet1,
        claimedAmount: largeAmount1,
        duration: 90n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      await createClaim({
        account: wallet2,
        claimedAmount: largeAmount2,
        duration: 90n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      const result =
        await repository.getTotalActiveStakesForSeason(seasonEndDate);

      expect(result).toBe(largeAmount1 + largeAmount2);
    });

    test("should work with different season end dates", async () => {
      // Stake that's active for a shorter season but not for a longer one
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: 30n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      // Check for end of February (stake should be active)
      const febEndResult = await repository.getTotalActiveStakesForSeason(
        new Date("2025-02-28T23:59:59Z"),
      );
      expect(febEndResult).toBe(1000n);

      // Check for end of March (stake should be expired)
      const marchEndResult = await repository.getTotalActiveStakesForSeason(
        new Date("2025-03-31T23:59:59Z"),
      );
      expect(marchEndResult).toBe(0n);
    });

    test("should be consistent with getActiveStakesForSeason", async () => {
      // Create multiple stakes across accounts
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: 90n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      await createClaim({
        account: wallet2,
        claimedAmount: 2000n,
        duration: 120n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-01-15T00:00:00Z"),
      });

      await createClaim({
        account: wallet3,
        claimedAmount: 3000n,
        duration: 100n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-02-15T00:00:00Z"),
      });

      // Expired stake (shouldn't be included in either)
      await createClaim({
        account: wallet1,
        claimedAmount: 5000n,
        duration: ONE_WEEK_SECONDS,
        blockTimestamp: new Date("2025-01-01T00:00:00Z"),
      });

      const totalResult =
        await repository.getTotalActiveStakesForSeason(seasonEndDate);
      const mapResult =
        await repository.getActiveStakesForSeason(seasonEndDate);

      // Sum the map values and compare to total
      let mapTotal = 0n;
      for (const amount of mapResult.values()) {
        mapTotal += amount;
      }

      expect(totalResult).toBe(mapTotal);
      expect(totalResult).toBe(6000n);
    });

    test("should handle minimum duration of 1 second", async () => {
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: 1n,
        blockTimestamp: seasonEndDate,
      });

      const result =
        await repository.getTotalActiveStakesForSeason(seasonEndDate);

      expect(result).toBe(1000n);
    });
  });
});
