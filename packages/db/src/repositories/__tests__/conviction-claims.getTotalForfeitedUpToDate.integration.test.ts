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

describe("ConvictionClaimsRepository getTotalForfeitedUpToDate Integration Tests", () => {
  let repository: ConvictionClaimsRepository;
  let airdropRepository: AirdropRepository;
  let logger: ReturnType<typeof pino>;

  // Test accounts
  const wallet1 = "0x1111111111111111111111111111111111111111";
  const wallet2 = "0x2222222222222222222222222222222222222222";
  const wallet3 = "0x3333333333333333333333333333333333333333";

  // End date for tests
  const endDate = new Date("2025-03-31T23:59:59Z");

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
   * Helper to create a conviction claim with specific eligible and claimed amounts.
   */
  async function createClaim(params: {
    account: string;
    eligibleAmount: bigint;
    claimedAmount: bigint;
    blockTimestamp: Date;
    duration?: bigint;
    season?: number;
  }) {
    return repository.insertClaim({
      account: params.account,
      eligibleAmount: params.eligibleAmount,
      claimedAmount: params.claimedAmount,
      season: params.season ?? 0,
      duration: params.duration ?? 86400n, // Default 1 day
      blockNumber: 1000000n,
      blockTimestamp: params.blockTimestamp,
      transactionHash: Buffer.from(
        `tx-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ),
    });
  }

  describe("getTotalForfeitedUpToDate()", () => {
    test("should return 0 when no claims exist", async () => {
      const result = await repository.getTotalForfeitedUpToDate(endDate);

      expect(result).toBe(0n);
    });

    test("should return 0 when claimed equals eligible (no forfeit)", async () => {
      await createClaim({
        account: wallet1,
        eligibleAmount: 1000n,
        claimedAmount: 1000n,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      const result = await repository.getTotalForfeitedUpToDate(endDate);

      expect(result).toBe(0n);
    });

    test("should calculate forfeit when claimed is less than eligible", async () => {
      await createClaim({
        account: wallet1,
        eligibleAmount: 1000n,
        claimedAmount: 600n,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      const result = await repository.getTotalForfeitedUpToDate(endDate);

      expect(result).toBe(400n); // 1000 - 600
    });

    test("should sum forfeitures from multiple claims by same account", async () => {
      await createClaim({
        account: wallet1,
        eligibleAmount: 1000n,
        claimedAmount: 800n, // forfeit: 200
        blockTimestamp: new Date("2025-01-15T00:00:00Z"),
      });

      await createClaim({
        account: wallet1,
        eligibleAmount: 2000n,
        claimedAmount: 1500n, // forfeit: 500
        blockTimestamp: new Date("2025-02-15T00:00:00Z"),
      });

      const result = await repository.getTotalForfeitedUpToDate(endDate);

      expect(result).toBe(700n); // 200 + 500
    });

    test("should sum forfeitures across multiple accounts", async () => {
      await createClaim({
        account: wallet1,
        eligibleAmount: 1000n,
        claimedAmount: 700n, // forfeit: 300
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      await createClaim({
        account: wallet2,
        eligibleAmount: 2000n,
        claimedAmount: 1200n, // forfeit: 800
        blockTimestamp: new Date("2025-02-15T00:00:00Z"),
      });

      await createClaim({
        account: wallet3,
        eligibleAmount: 500n,
        claimedAmount: 400n, // forfeit: 100
        blockTimestamp: new Date("2025-03-01T00:00:00Z"),
      });

      const result = await repository.getTotalForfeitedUpToDate(endDate);

      expect(result).toBe(1200n); // 300 + 800 + 100
    });

    test("should exclude claims after the end date", async () => {
      // Claim before end date (included)
      await createClaim({
        account: wallet1,
        eligibleAmount: 1000n,
        claimedAmount: 600n, // forfeit: 400
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      // Claim after end date (excluded)
      await createClaim({
        account: wallet2,
        eligibleAmount: 5000n,
        claimedAmount: 1000n, // forfeit: 4000 (not counted)
        blockTimestamp: new Date("2025-04-01T00:00:00Z"),
      });

      const result = await repository.getTotalForfeitedUpToDate(endDate);

      expect(result).toBe(400n); // Only the first forfeit
    });

    test("should include claims exactly at the end date", async () => {
      await createClaim({
        account: wallet1,
        eligibleAmount: 1000n,
        claimedAmount: 700n, // forfeit: 300
        blockTimestamp: endDate,
      });

      const result = await repository.getTotalForfeitedUpToDate(endDate);

      expect(result).toBe(300n);
    });

    test("should handle mix of full claims and partial claims", async () => {
      // Full claim (no forfeit)
      await createClaim({
        account: wallet1,
        eligibleAmount: 1000n,
        claimedAmount: 1000n, // forfeit: 0
        blockTimestamp: new Date("2025-01-15T00:00:00Z"),
      });

      // Partial claim (has forfeit)
      await createClaim({
        account: wallet2,
        eligibleAmount: 2000n,
        claimedAmount: 1500n, // forfeit: 500
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      // Another full claim (no forfeit)
      await createClaim({
        account: wallet3,
        eligibleAmount: 3000n,
        claimedAmount: 3000n, // forfeit: 0
        blockTimestamp: new Date("2025-02-15T00:00:00Z"),
      });

      const result = await repository.getTotalForfeitedUpToDate(endDate);

      expect(result).toBe(500n); // Only from wallet2
    });

    test("should handle zero claimed amount (full forfeit)", async () => {
      await createClaim({
        account: wallet1,
        eligibleAmount: 1000n,
        claimedAmount: 0n, // forfeit: 1000
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      const result = await repository.getTotalForfeitedUpToDate(endDate);

      expect(result).toBe(1000n);
    });

    test("should handle large amounts", async () => {
      const largeEligible = BigInt("999999999999999999999999999999");
      const largeClaimed = BigInt("500000000000000000000000000000");

      await createClaim({
        account: wallet1,
        eligibleAmount: largeEligible,
        claimedAmount: largeClaimed,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      const result = await repository.getTotalForfeitedUpToDate(endDate);

      expect(result).toBe(largeEligible - largeClaimed);
    });

    test("should handle summing multiple large forfeitures", async () => {
      const eligible1 = BigInt("500000000000000000000000000000");
      const claimed1 = BigInt("300000000000000000000000000000");
      const eligible2 = BigInt("400000000000000000000000000000");
      const claimed2 = BigInt("100000000000000000000000000000");

      await createClaim({
        account: wallet1,
        eligibleAmount: eligible1,
        claimedAmount: claimed1,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      await createClaim({
        account: wallet2,
        eligibleAmount: eligible2,
        claimedAmount: claimed2,
        blockTimestamp: new Date("2025-02-15T00:00:00Z"),
      });

      const result = await repository.getTotalForfeitedUpToDate(endDate);

      const expectedForfeit = eligible1 - claimed1 + (eligible2 - claimed2);
      expect(result).toBe(expectedForfeit);
    });

    test("should work with different end dates", async () => {
      // Claim on Jan 15
      await createClaim({
        account: wallet1,
        eligibleAmount: 1000n,
        claimedAmount: 700n, // forfeit: 300
        blockTimestamp: new Date("2025-01-15T00:00:00Z"),
      });

      // Claim on Feb 15
      await createClaim({
        account: wallet2,
        eligibleAmount: 2000n,
        claimedAmount: 1500n, // forfeit: 500
        blockTimestamp: new Date("2025-02-15T00:00:00Z"),
      });

      // Claim on Mar 15
      await createClaim({
        account: wallet3,
        eligibleAmount: 3000n,
        claimedAmount: 2000n, // forfeit: 1000
        blockTimestamp: new Date("2025-03-15T00:00:00Z"),
      });

      // Check at end of January (only first claim)
      const janResult = await repository.getTotalForfeitedUpToDate(
        new Date("2025-01-31T23:59:59Z"),
      );
      expect(janResult).toBe(300n);

      // Check at end of February (first two claims)
      const febResult = await repository.getTotalForfeitedUpToDate(
        new Date("2025-02-28T23:59:59Z"),
      );
      expect(febResult).toBe(800n); // 300 + 500

      // Check at end of March (all three claims)
      const marResult = await repository.getTotalForfeitedUpToDate(
        new Date("2025-03-31T23:59:59Z"),
      );
      expect(marResult).toBe(1800n); // 300 + 500 + 1000
    });

    test("should handle claims with duration 0 (claims without staking)", async () => {
      await createClaim({
        account: wallet1,
        eligibleAmount: 1000n,
        claimedAmount: 800n, // forfeit: 200
        duration: 0n,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      const result = await repository.getTotalForfeitedUpToDate(endDate);

      // Duration doesn't affect forfeit calculation
      expect(result).toBe(200n);
    });

    test("should handle very early end date with no claims", async () => {
      await createClaim({
        account: wallet1,
        eligibleAmount: 1000n,
        claimedAmount: 600n,
        blockTimestamp: new Date("2025-02-01T00:00:00Z"),
      });

      // End date before any claims
      const result = await repository.getTotalForfeitedUpToDate(
        new Date("2025-01-01T00:00:00Z"),
      );

      expect(result).toBe(0n);
    });

    test("should include claim exactly at end date boundary", async () => {
      const exactDate = new Date("2025-02-15T12:00:00Z");

      await createClaim({
        account: wallet1,
        eligibleAmount: 1000n,
        claimedAmount: 700n, // forfeit: 300
        blockTimestamp: exactDate,
      });

      // End date at exact same timestamp (should include)
      const result = await repository.getTotalForfeitedUpToDate(exactDate);

      expect(result).toBe(300n);
    });

    test("should not include claim 1ms after end date", async () => {
      const claimDate = new Date("2025-02-15T12:00:00.001Z");
      const endDateMs = new Date("2025-02-15T12:00:00.000Z");

      await createClaim({
        account: wallet1,
        eligibleAmount: 1000n,
        claimedAmount: 700n, // forfeit: 300
        blockTimestamp: claimDate,
      });

      const result = await repository.getTotalForfeitedUpToDate(endDateMs);

      expect(result).toBe(0n);
    });
  });
});
