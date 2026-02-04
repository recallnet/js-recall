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

describe("ConvictionClaimsRepository getActiveStakesForSeason Integration Tests", () => {
  let repository: ConvictionClaimsRepository;
  let airdropRepository: AirdropRepository;
  let logger: ReturnType<typeof pino>;

  // Test accounts
  const wallet1 = "0x1111111111111111111111111111111111111111";
  const wallet2 = "0x2222222222222222222222222222222222222222";
  const wallet3 = "0x3333333333333333333333333333333333333333";

  // Season end date for tests
  const seasonEndDate = new Date("2025-03-31T23:59:59Z");

  // Helper to compute stake end time
  const ONE_DAY_SECONDS = 86400n;
  const ONE_WEEK_SECONDS = 604800n;
  const ONE_MONTH_SECONDS = 2592000n; // 30 days

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

  describe("getActiveStakesForSeason()", () => {
    test("should return empty map when no stakes exist", async () => {
      const result = await repository.getActiveStakesForSeason(seasonEndDate);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    test("should return empty map when stakes have duration 0 (claims only)", async () => {
      // Duration 0 means it's just a claim, not a stake
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: 0n,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      const result = await repository.getActiveStakesForSeason(seasonEndDate);

      expect(result.size).toBe(0);
    });

    test("should return stake that extends past season end", async () => {
      // Stake created Feb 1, duration 90 days (extends past March 31)
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: 90n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      const result = await repository.getActiveStakesForSeason(seasonEndDate);

      expect(result.size).toBe(1);
      expect(result.get(wallet1)).toBe(1000n);
    });

    test("should exclude stake that expires before season end", async () => {
      // Stake created Jan 1, duration 30 days (ends Jan 31, before season end)
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: 30n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-01-01T00:00:00Z"),
      });

      const result = await repository.getActiveStakesForSeason(seasonEndDate);

      expect(result.size).toBe(0);
    });

    test("should exclude stake that expires exactly at season end", async () => {
      // Calculate duration so stake ends exactly at season end
      // From Feb 1 to March 31 23:59:59 is approximately 59 days
      const stakeStart = new Date("2025-02-01T00:00:00Z");
      const durationMs = seasonEndDate.getTime() - stakeStart.getTime();
      const durationSeconds = BigInt(Math.floor(durationMs / 1000));

      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: durationSeconds,
        blockTimestamp: stakeStart,
      });

      const result = await repository.getActiveStakesForSeason(seasonEndDate);

      // Should be excluded because condition is > (not >=)
      expect(result.size).toBe(0);
    });

    test("should include stake that extends 1 second past season end", async () => {
      // Calculate duration so stake ends 1 second after season end
      const stakeStart = new Date("2025-02-01T00:00:00Z");
      const durationMs = seasonEndDate.getTime() - stakeStart.getTime();
      const durationSeconds = BigInt(Math.floor(durationMs / 1000)) + 1n;

      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: durationSeconds,
        blockTimestamp: stakeStart,
      });

      const result = await repository.getActiveStakesForSeason(seasonEndDate);

      expect(result.size).toBe(1);
      expect(result.get(wallet1)).toBe(1000n);
    });

    test("should exclude stake created after season end", async () => {
      // Stake created after season end
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: ONE_MONTH_SECONDS,
        blockTimestamp: new Date("2025-04-01T00:00:00Z"),
      });

      const result = await repository.getActiveStakesForSeason(seasonEndDate);

      expect(result.size).toBe(0);
    });

    test("should include stake created exactly at season end with valid duration", async () => {
      // Stake created at exact season end time with long duration
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: ONE_DAY_SECONDS, // extends 1 day past season end
        blockTimestamp: seasonEndDate,
      });

      const result = await repository.getActiveStakesForSeason(seasonEndDate);

      expect(result.size).toBe(1);
      expect(result.get(wallet1)).toBe(1000n);
    });

    test("should aggregate multiple stakes for the same account", async () => {
      // Multiple stakes for wallet1
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

      const result = await repository.getActiveStakesForSeason(seasonEndDate);

      expect(result.size).toBe(1);
      expect(result.get(wallet1)).toBe(3500n); // 1000 + 2000 + 500
    });

    test("should only aggregate active stakes, not expired ones", async () => {
      // Active stake (extends past season end)
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: 90n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      // Expired stake (ends before season end)
      await createClaim({
        account: wallet1,
        claimedAmount: 5000n,
        duration: ONE_WEEK_SECONDS, // Only 1 week
        blockTimestamp: new Date("2025-01-01T00:00:00Z"),
      });

      const result = await repository.getActiveStakesForSeason(seasonEndDate);

      expect(result.size).toBe(1);
      expect(result.get(wallet1)).toBe(1000n); // Only the active stake
    });

    test("should return data for multiple accounts", async () => {
      // Wallet 1: 1000
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: 90n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      // Wallet 2: 2000
      await createClaim({
        account: wallet2,
        claimedAmount: 2000n,
        duration: 120n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-01-15T00:00:00Z"),
      });

      // Wallet 3: 3000
      await createClaim({
        account: wallet3,
        claimedAmount: 3000n,
        duration: 100n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-02-15T00:00:00Z"),
      });

      const result = await repository.getActiveStakesForSeason(seasonEndDate);

      expect(result.size).toBe(3);
      expect(result.get(wallet1)).toBe(1000n);
      expect(result.get(wallet2)).toBe(2000n);
      expect(result.get(wallet3)).toBe(3000n);
    });

    test("should handle mixed active and expired stakes across accounts", async () => {
      // Wallet 1: active stake
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: 90n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      // Wallet 2: expired stake (not included)
      await createClaim({
        account: wallet2,
        claimedAmount: 2000n,
        duration: ONE_WEEK_SECONDS,
        blockTimestamp: new Date("2025-01-01T00:00:00Z"),
      });

      // Wallet 3: one active, one expired
      await createClaim({
        account: wallet3,
        claimedAmount: 500n,
        duration: 100n * ONE_DAY_SECONDS, // active
        blockTimestamp: new Date("2025-02-15T00:00:00Z"),
      });
      await createClaim({
        account: wallet3,
        claimedAmount: 1500n,
        duration: 10n * ONE_DAY_SECONDS, // expired
        blockTimestamp: new Date("2025-01-01T00:00:00Z"),
      });

      const result = await repository.getActiveStakesForSeason(seasonEndDate);

      expect(result.size).toBe(2); // wallet1 and wallet3
      expect(result.get(wallet1)).toBe(1000n);
      expect(result.has(wallet2)).toBe(false);
      expect(result.get(wallet3)).toBe(500n); // only the active one
    });

    test("should handle large stake amounts", async () => {
      const largeAmount = BigInt("999999999999999999999999999999");

      await createClaim({
        account: wallet1,
        claimedAmount: largeAmount,
        duration: 90n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      const result = await repository.getActiveStakesForSeason(seasonEndDate);

      expect(result.size).toBe(1);
      expect(result.get(wallet1)).toBe(largeAmount);
    });

    test("should handle very long stake durations", async () => {
      const oneYearSeconds = 365n * 24n * 60n * 60n;

      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: oneYearSeconds * 10n, // 10 years
        blockTimestamp: new Date("2025-01-01T00:00:00Z"),
      });

      const result = await repository.getActiveStakesForSeason(seasonEndDate);

      expect(result.size).toBe(1);
      expect(result.get(wallet1)).toBe(1000n);
    });

    test("should handle accounts with lowercase addresses", async () => {
      const upperCaseWallet = "0xABCDEF1234567890123456789012345678901234";

      await createClaim({
        account: upperCaseWallet,
        claimedAmount: 1000n,
        duration: 90n * ONE_DAY_SECONDS,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      const result = await repository.getActiveStakesForSeason(seasonEndDate);

      // The repository normalizes to lowercase on insert
      expect(result.size).toBe(1);
      expect(result.get(upperCaseWallet.toLowerCase())).toBe(1000n);
    });

    test("should work with different season end dates", async () => {
      // Create a stake that's active for a shorter season but not for a longer one
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: 30n * ONE_DAY_SECONDS, // 30 days
        blockTimestamp: new Date("2025-02-01T00:00:00Z"), // Ends around March 3
      });

      // Check for end of February (stake should be active)
      const febEndResult = await repository.getActiveStakesForSeason(
        new Date("2025-02-28T23:59:59Z"),
      );
      expect(febEndResult.size).toBe(1);
      expect(febEndResult.get(wallet1)).toBe(1000n);

      // Check for end of March (stake should be expired)
      const marchEndResult = await repository.getActiveStakesForSeason(
        new Date("2025-03-31T23:59:59Z"),
      );
      expect(marchEndResult.size).toBe(0);
    });

    test("should handle minimum duration of 1 second", async () => {
      // Duration of exactly 1 second
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        duration: 1n,
        blockTimestamp: seasonEndDate, // Created at season end
      });

      const result = await repository.getActiveStakesForSeason(seasonEndDate);

      // Stake extends 1 second past season end, should be included
      expect(result.size).toBe(1);
      expect(result.get(wallet1)).toBe(1000n);
    });
  });
});
