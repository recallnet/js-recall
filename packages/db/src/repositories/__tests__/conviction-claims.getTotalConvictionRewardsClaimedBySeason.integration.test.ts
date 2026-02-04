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

describe("ConvictionClaimsRepository getTotalConvictionRewardsClaimedBySeason Integration Tests", () => {
  let repository: ConvictionClaimsRepository;
  let airdropRepository: AirdropRepository;
  let logger: ReturnType<typeof pino>;

  // Test accounts
  const wallet1 = "0x1111111111111111111111111111111111111111";
  const wallet2 = "0x2222222222222222222222222222222222222222";
  const wallet3 = "0x3333333333333333333333333333333333333333";

  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  beforeEach(async () => {
    logger = pino({ level: "silent" });
    repository = new ConvictionClaimsRepository(db, logger as never);
    airdropRepository = new AirdropRepository(db, logger as never);

    // Create multiple seasons (required for foreign key constraint)
    // Season numbers are startsWithAirdrop + 1, so:
    // startsWithAirdrop=0 -> season number 1
    // startsWithAirdrop=1 -> season number 2
    // etc.
    await airdropRepository.newSeason({
      startsWithAirdrop: 0,
      name: "Season 1",
      startDate: new Date("2025-01-01T00:00:00Z"),
      endDate: new Date("2025-03-31T23:59:59Z"),
    });

    await airdropRepository.newSeason({
      startsWithAirdrop: 1,
      name: "Season 2",
      startDate: new Date("2025-04-01T00:00:00Z"),
      endDate: new Date("2025-06-30T23:59:59Z"),
    });

    await airdropRepository.newSeason({
      startsWithAirdrop: 2,
      name: "Season 3",
      startDate: new Date("2025-07-01T00:00:00Z"),
      endDate: new Date("2025-09-30T23:59:59Z"),
    });

    await airdropRepository.newSeason({
      startsWithAirdrop: 3,
      name: "Season 4",
      startDate: new Date("2025-10-01T00:00:00Z"),
      endDate: new Date("2025-12-31T23:59:59Z"),
    });
  });

  afterEach(async () => {
    // Clean up in reverse dependency order
    await db.delete(convictionClaims);
    await db.delete(seasons);
  });

  /**
   * Helper to create a conviction claim for a specific season.
   */
  async function createClaim(params: {
    account: string;
    claimedAmount: bigint;
    season: number;
    eligibleAmount?: bigint;
  }) {
    return repository.insertClaim({
      account: params.account,
      eligibleAmount: params.eligibleAmount ?? params.claimedAmount,
      claimedAmount: params.claimedAmount,
      season: params.season,
      duration: 86400n, // 1 day default
      blockNumber: 1000000n,
      blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      transactionHash: Buffer.from(
        `tx-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ),
    });
  }

  describe("getTotalConvictionRewardsClaimedBySeason()", () => {
    test("should return 0 when no claims exist", async () => {
      const result = await repository.getTotalConvictionRewardsClaimedBySeason(
        0,
        3,
      );

      expect(result).toBe(0n);
    });

    test("should return claimed amount for single claim in range", async () => {
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        season: 0,
      });

      const result = await repository.getTotalConvictionRewardsClaimedBySeason(
        0,
        0,
      );

      expect(result).toBe(1000n);
    });

    test("should sum claims from same season", async () => {
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        season: 0,
      });

      await createClaim({
        account: wallet2,
        claimedAmount: 2000n,
        season: 0,
      });

      await createClaim({
        account: wallet3,
        claimedAmount: 500n,
        season: 0,
      });

      const result = await repository.getTotalConvictionRewardsClaimedBySeason(
        0,
        0,
      );

      expect(result).toBe(3500n);
    });

    test("should sum claims across multiple seasons in range", async () => {
      // Season 0
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        season: 0,
      });

      // Season 1
      await createClaim({
        account: wallet1,
        claimedAmount: 2000n,
        season: 1,
      });

      // Season 2
      await createClaim({
        account: wallet1,
        claimedAmount: 3000n,
        season: 2,
      });

      const result = await repository.getTotalConvictionRewardsClaimedBySeason(
        0,
        2,
      );

      expect(result).toBe(6000n);
    });

    test("should exclude claims outside the season range (before)", async () => {
      // Season 0 (excluded)
      await createClaim({
        account: wallet1,
        claimedAmount: 5000n,
        season: 0,
      });

      // Season 1 (included)
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        season: 1,
      });

      // Season 2 (included)
      await createClaim({
        account: wallet1,
        claimedAmount: 2000n,
        season: 2,
      });

      const result = await repository.getTotalConvictionRewardsClaimedBySeason(
        1,
        2,
      );

      expect(result).toBe(3000n);
    });

    test("should exclude claims outside the season range (after)", async () => {
      // Season 0 (included)
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        season: 0,
      });

      // Season 1 (included)
      await createClaim({
        account: wallet1,
        claimedAmount: 2000n,
        season: 1,
      });

      // Season 2 (excluded)
      await createClaim({
        account: wallet1,
        claimedAmount: 5000n,
        season: 2,
      });

      const result = await repository.getTotalConvictionRewardsClaimedBySeason(
        0,
        1,
      );

      expect(result).toBe(3000n);
    });

    test("should include claims at exact boundary seasons", async () => {
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        season: 1,
      });

      await createClaim({
        account: wallet2,
        claimedAmount: 2000n,
        season: 2,
      });

      // Query from season 1 to season 2 (both boundaries included)
      const result = await repository.getTotalConvictionRewardsClaimedBySeason(
        1,
        2,
      );

      expect(result).toBe(3000n);
    });

    test("should handle single season query (fromSeason equals toSeason)", async () => {
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        season: 0,
      });

      await createClaim({
        account: wallet2,
        claimedAmount: 2000n,
        season: 1,
      });

      await createClaim({
        account: wallet3,
        claimedAmount: 3000n,
        season: 2,
      });

      // Query only season 1
      const result = await repository.getTotalConvictionRewardsClaimedBySeason(
        1,
        1,
      );

      expect(result).toBe(2000n);
    });

    test("should sum claims from multiple accounts across seasons", async () => {
      // Season 0: multiple accounts
      await createClaim({
        account: wallet1,
        claimedAmount: 100n,
        season: 0,
      });
      await createClaim({
        account: wallet2,
        claimedAmount: 200n,
        season: 0,
      });

      // Season 1: multiple accounts
      await createClaim({
        account: wallet1,
        claimedAmount: 300n,
        season: 1,
      });
      await createClaim({
        account: wallet3,
        claimedAmount: 400n,
        season: 1,
      });

      // Season 2: single account
      await createClaim({
        account: wallet2,
        claimedAmount: 500n,
        season: 2,
      });

      const result = await repository.getTotalConvictionRewardsClaimedBySeason(
        0,
        2,
      );

      expect(result).toBe(1500n); // 100 + 200 + 300 + 400 + 500
    });

    test("should handle large claimed amounts", async () => {
      const largeAmount = BigInt("999999999999999999999999999999");

      await createClaim({
        account: wallet1,
        claimedAmount: largeAmount,
        season: 0,
      });

      const result = await repository.getTotalConvictionRewardsClaimedBySeason(
        0,
        0,
      );

      expect(result).toBe(largeAmount);
    });

    test("should handle summing multiple large amounts", async () => {
      const amount1 = BigInt("500000000000000000000000000000");
      const amount2 = BigInt("400000000000000000000000000000");

      await createClaim({
        account: wallet1,
        claimedAmount: amount1,
        season: 0,
      });

      await createClaim({
        account: wallet2,
        claimedAmount: amount2,
        season: 1,
      });

      const result = await repository.getTotalConvictionRewardsClaimedBySeason(
        0,
        1,
      );

      expect(result).toBe(amount1 + amount2);
    });

    test("should return 0 for empty season range", async () => {
      // Create claims in seasons 0 and 2
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        season: 0,
      });

      await createClaim({
        account: wallet2,
        claimedAmount: 2000n,
        season: 2,
      });

      // Query season 3 only (no claims)
      const result = await repository.getTotalConvictionRewardsClaimedBySeason(
        3,
        3,
      );

      expect(result).toBe(0n);
    });

    test("should handle inverted range (fromSeason > toSeason) returning 0", async () => {
      await createClaim({
        account: wallet1,
        claimedAmount: 1000n,
        season: 1,
      });

      // Inverted range should match nothing
      const result = await repository.getTotalConvictionRewardsClaimedBySeason(
        2,
        0,
      );

      expect(result).toBe(0n);
    });

    test("should only sum claimedAmount, not eligibleAmount", async () => {
      await createClaim({
        account: wallet1,
        claimedAmount: 600n,
        eligibleAmount: 1000n,
        season: 0,
      });

      await createClaim({
        account: wallet2,
        claimedAmount: 800n,
        eligibleAmount: 2000n,
        season: 0,
      });

      const result = await repository.getTotalConvictionRewardsClaimedBySeason(
        0,
        0,
      );

      // Should sum claimed (600 + 800 = 1400), not eligible (1000 + 2000 = 3000)
      expect(result).toBe(1400n);
    });

    test("should handle claims with zero claimed amount", async () => {
      await createClaim({
        account: wallet1,
        claimedAmount: 0n,
        eligibleAmount: 1000n,
        season: 0,
      });

      await createClaim({
        account: wallet2,
        claimedAmount: 500n,
        season: 0,
      });

      const result = await repository.getTotalConvictionRewardsClaimedBySeason(
        0,
        0,
      );

      expect(result).toBe(500n);
    });

    test("should work with wide season range", async () => {
      await createClaim({
        account: wallet1,
        claimedAmount: 100n,
        season: 0,
      });

      await createClaim({
        account: wallet1,
        claimedAmount: 200n,
        season: 1,
      });

      await createClaim({
        account: wallet1,
        claimedAmount: 300n,
        season: 2,
      });

      await createClaim({
        account: wallet1,
        claimedAmount: 400n,
        season: 3,
      });

      // Query all seasons
      const result = await repository.getTotalConvictionRewardsClaimedBySeason(
        0,
        3,
      );

      expect(result).toBe(1000n);
    });
  });
});
