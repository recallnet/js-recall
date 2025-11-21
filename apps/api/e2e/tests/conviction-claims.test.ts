import { beforeEach, describe, expect, test } from "vitest";

import { seasons } from "@recallnet/db/schema/airdrop/defs";
import { convictionClaims } from "@recallnet/db/schema/conviction-claims/defs";
import { ConvictionClaimsRepository } from "@recallnet/services/indexing";

import { db } from "@/database/db.js";

describe("ConvictionClaimsRepository", () => {
  let convictionClaimsRepository: ConvictionClaimsRepository;
  let testAccount1: string;
  let testAccount2: string;
  let testTxHash1: string;
  let testTxHash2: string;

  beforeEach(async () => {
    // Clean up existing data
    await db.delete(convictionClaims);

    // Ensure Genesis season exists (in case it was deleted by resetDatabase)
    await db
      .insert(seasons)
      .values({
        id: 0,
        number: 0,
        name: "Genesis",
        startDate: new Date("2025-10-13T00:00:00Z"),
      })
      .onConflictDoNothing();

    // Initialize repository
    convictionClaimsRepository = new ConvictionClaimsRepository(db);

    // Setup test data
    testAccount1 = "0x686bab3F162e72F903fA9DA42D1726e5D01BB46A";
    testAccount2 = "0x1234567890123456789012345678901234567890";
    testTxHash1 =
      "0xca9ffc8333904b0844df3e953057535185e96e89a5e28874cf17c5f76f9560d7";
    testTxHash2 =
      "0xda9ffc8333904b0844df3e953057535185e96e89a5e28874cf17c5f76f9560d8";
  });

  test("saveConvictionClaim should save a new conviction claim", async () => {
    const claimData = {
      account: testAccount1,
      eligibleAmount: BigInt("1000000000000000000"), // 1 token
      claimedAmount: BigInt("1000000000000000000"),
      season: 0,
      duration: BigInt(31536000), // 1 year in seconds
      blockNumber: BigInt(36891706),
      blockTimestamp: new Date("2025-10-15T23:59:19Z"),
      transactionHash: testTxHash1,
    };

    const result =
      await convictionClaimsRepository.saveConvictionClaim(claimData);
    expect(result).toBe(true);

    // Verify the claim was saved
    const savedClaims =
      await convictionClaimsRepository.getConvictionClaimsByAccount(
        testAccount1,
      );
    expect(savedClaims).toHaveLength(1);
    expect(savedClaims[0]!.account).toBe(testAccount1.toLowerCase());
    expect(savedClaims[0]!.eligibleAmount).toBe(claimData.eligibleAmount);
    expect(savedClaims[0]!.claimedAmount).toBe(claimData.claimedAmount);
    expect(savedClaims[0]!.season).toBe(claimData.season);
    expect(savedClaims[0]!.duration).toBe(claimData.duration);
  });

  test("saveConvictionClaim should handle duplicates gracefully", async () => {
    const claimData = {
      account: testAccount1,
      eligibleAmount: BigInt("1000000000000000000"),
      claimedAmount: BigInt("1000000000000000000"),
      season: 0,
      duration: BigInt(31536000),
      blockNumber: BigInt(36891706),
      blockTimestamp: new Date("2025-10-15T23:59:19Z"),
      transactionHash: testTxHash1,
    };

    // Save the first time
    const result1 =
      await convictionClaimsRepository.saveConvictionClaim(claimData);
    expect(result1).toBe(true);

    // Try to save again (should be ignored due to unique constraint)
    const result2 =
      await convictionClaimsRepository.saveConvictionClaim(claimData);
    expect(result2).toBe(false);

    // Verify only one claim exists
    const savedClaims =
      await convictionClaimsRepository.getConvictionClaimsByAccount(
        testAccount1,
      );
    expect(savedClaims).toHaveLength(1);
  });

  test("isConvictionClaimPresent should detect existing conviction claims", async () => {
    const claimData = {
      account: testAccount1,
      eligibleAmount: BigInt("1000000000000000000"),
      claimedAmount: BigInt("1000000000000000000"),
      season: 0,
      duration: BigInt(31536000), // 365 days in seconds
      blockNumber: BigInt(36891706),
      blockTimestamp: new Date("2025-10-15T23:59:19Z"),
      transactionHash: testTxHash1,
    };

    // Initially should not be present
    const isPresent1 =
      await convictionClaimsRepository.isConvictionClaimPresent(testTxHash1);
    expect(isPresent1).toBe(false);

    // Save the claim
    await convictionClaimsRepository.saveConvictionClaim(claimData);

    // Now should be present
    const isPresent2 =
      await convictionClaimsRepository.isConvictionClaimPresent(testTxHash1);
    expect(isPresent2).toBe(true);
  });

  test("getConvictionClaimsByAccount should return conviction claims for specific account", async () => {
    // Save claims for two different accounts
    await convictionClaimsRepository.saveConvictionClaim({
      account: testAccount1,
      eligibleAmount: BigInt("1000000000000000000"),
      claimedAmount: BigInt("1000000000000000000"),
      season: 0,
      duration: BigInt(31536000),
      blockNumber: BigInt(36891706),
      blockTimestamp: new Date("2025-10-15T23:59:19Z"),
      transactionHash: testTxHash1,
    });

    await convictionClaimsRepository.saveConvictionClaim({
      account: testAccount2,
      eligibleAmount: BigInt("2000000000000000000"),
      claimedAmount: BigInt("2000000000000000000"),
      season: 0,
      duration: BigInt(31536000),
      blockNumber: BigInt(36891707),
      blockTimestamp: new Date("2025-10-16T00:00:00Z"),
      transactionHash: testTxHash2,
    });

    // Get claims for account 1
    const account1Claims =
      await convictionClaimsRepository.getConvictionClaimsByAccount(
        testAccount1,
      );
    expect(account1Claims).toHaveLength(1);
    expect(account1Claims[0]!.eligibleAmount).toBe(
      BigInt("1000000000000000000"),
    );

    // Get claims for account 2
    const account2Claims =
      await convictionClaimsRepository.getConvictionClaimsByAccount(
        testAccount2,
      );
    expect(account2Claims).toHaveLength(1);
    expect(account2Claims[0]!.eligibleAmount).toBe(
      BigInt("2000000000000000000"),
    );
  });

  test("getConvictionClaimsByAccount with season filter", async () => {
    // Save multiple claims for the same season
    await convictionClaimsRepository.saveConvictionClaim({
      account: testAccount1,
      eligibleAmount: BigInt("1000000000000000000"),
      claimedAmount: BigInt("1000000000000000000"),
      season: 0,
      duration: BigInt(31536000),
      blockNumber: BigInt(36891706),
      blockTimestamp: new Date("2025-10-15T23:59:19Z"),
      transactionHash: testTxHash1,
    });

    await convictionClaimsRepository.saveConvictionClaim({
      account: testAccount1,
      eligibleAmount: BigInt("2000000000000000000"),
      claimedAmount: BigInt("2000000000000000000"),
      season: 0,
      duration: BigInt(31536000),
      blockNumber: BigInt(36891707),
      blockTimestamp: new Date("2025-10-16T00:00:00Z"),
      transactionHash: testTxHash2,
    });

    // Get all claims
    const allClaims =
      await convictionClaimsRepository.getConvictionClaimsByAccount(
        testAccount1,
      );
    expect(allClaims).toHaveLength(2);

    // Get claims for season 0
    const season0Claims =
      await convictionClaimsRepository.getConvictionClaimsByAccount(
        testAccount1,
        0,
      );
    expect(season0Claims).toHaveLength(2);
    expect(season0Claims[0]!.season).toBe(0);
    expect(season0Claims[1]!.season).toBe(0);

    // Get claims for non-existent season
    const noSeasonClaims =
      await convictionClaimsRepository.getConvictionClaimsByAccount(
        testAccount1,
        99,
      );
    expect(noSeasonClaims).toHaveLength(0);
  });

  test("getTotalConvictionClaimedByAccount should sum claimed amounts", async () => {
    // Save multiple claims for the same season
    await convictionClaimsRepository.saveConvictionClaim({
      account: testAccount1,
      eligibleAmount: BigInt("1000000000000000000"),
      claimedAmount: BigInt("600000000000000000"),
      season: 0,
      duration: BigInt(15552000),
      blockNumber: BigInt(36891706),
      blockTimestamp: new Date("2025-10-15T23:59:19Z"),
      transactionHash: testTxHash1,
    });

    await convictionClaimsRepository.saveConvictionClaim({
      account: testAccount1,
      eligibleAmount: BigInt("3000000000000000000"),
      claimedAmount: BigInt("1800000000000000000"),
      season: 0,
      duration: BigInt(15552000),
      blockNumber: BigInt(36891707),
      blockTimestamp: new Date("2025-10-16T00:00:00Z"),
      transactionHash: testTxHash2,
    });

    // Get total claimed across all seasons
    const totalClaimed =
      await convictionClaimsRepository.getTotalConvictionClaimedByAccount(
        testAccount1,
      );
    expect(totalClaimed).toBe(BigInt("2400000000000000000"));

    // Get total for specific season
    const totalSeason0 =
      await convictionClaimsRepository.getTotalConvictionClaimedByAccount(
        testAccount1,
        0,
      );
    expect(totalSeason0).toBe(BigInt("2400000000000000000"));

    // Get total for non-existent season
    const totalSeason99 =
      await convictionClaimsRepository.getTotalConvictionClaimedByAccount(
        testAccount1,
        99,
      );
    expect(totalSeason99).toBe(BigInt(0));

    // Get total for non-existent account
    const totalNonExistent =
      await convictionClaimsRepository.getTotalConvictionClaimedByAccount(
        "0x0000000000000000000000000000000000000000",
      );
    expect(totalNonExistent).toBe(BigInt(0));
  });

  test("getConvictionClaimsBySeason should return conviction claims for specific season", async () => {
    // Save claims for different seasons
    await convictionClaimsRepository.saveConvictionClaim({
      account: testAccount1,
      eligibleAmount: BigInt("1000000000000000000"),
      claimedAmount: BigInt("1000000000000000000"),
      season: 0,
      duration: BigInt(31536000),
      blockNumber: BigInt(36891706),
      blockTimestamp: new Date("2025-10-15T23:59:19Z"),
      transactionHash: testTxHash1,
    });

    await convictionClaimsRepository.saveConvictionClaim({
      account: testAccount2,
      eligibleAmount: BigInt("2000000000000000000"),
      claimedAmount: BigInt("2000000000000000000"),
      season: 0,
      duration: BigInt(31536000),
      blockNumber: BigInt(36891707),
      blockTimestamp: new Date("2025-10-16T00:00:00Z"),
      transactionHash: testTxHash2,
    });

    // Get claims for season 0
    const season0Claims =
      await convictionClaimsRepository.getConvictionClaimsBySeason(0);
    expect(season0Claims).toHaveLength(2);

    // Get claims for season 1 (should be empty)
    const season1Claims =
      await convictionClaimsRepository.getConvictionClaimsBySeason(1);
    expect(season1Claims).toHaveLength(0);
  });

  test("getConvictionClaimsBySeason with pagination", async () => {
    // Save multiple claims for the same season
    for (let i = 0; i < 5; i++) {
      await convictionClaimsRepository.saveConvictionClaim({
        account: testAccount1,
        eligibleAmount: BigInt((i + 1) * 1000000000000000000),
        claimedAmount: BigInt((i + 1) * 1000000000000000000),
        season: 0,
        duration: BigInt(31536000),
        blockNumber: BigInt(36891706 + i),
        blockTimestamp: new Date(`2025-10-1${5 + i}T00:00:00Z`),
        transactionHash: `0x${i}a9ffc8333904b0844df3e953057535185e96e89a5e28874cf17c5f76f9560d7`,
      });
    }

    // Get first page
    const page1 = await convictionClaimsRepository.getConvictionClaimsBySeason(
      0,
      2,
      0,
    );
    expect(page1).toHaveLength(2);

    // Get second page
    const page2 = await convictionClaimsRepository.getConvictionClaimsBySeason(
      0,
      2,
      2,
    );
    expect(page2).toHaveLength(2);

    // Get third page
    const page3 = await convictionClaimsRepository.getConvictionClaimsBySeason(
      0,
      2,
      4,
    );
    expect(page3).toHaveLength(1);
  });

  test("getLatestConvictionClaim should return most recent conviction claim", async () => {
    // Save multiple claims with different block numbers for same season
    await convictionClaimsRepository.saveConvictionClaim({
      account: testAccount1,
      eligibleAmount: BigInt("1000000000000000000"),
      claimedAmount: BigInt("600000000000000000"),
      season: 0,
      duration: BigInt(15552000),
      blockNumber: BigInt(36891706),
      blockTimestamp: new Date("2025-10-15T23:59:19Z"),
      transactionHash: testTxHash1,
    });

    await convictionClaimsRepository.saveConvictionClaim({
      account: testAccount1,
      eligibleAmount: BigInt("2000000000000000000"),
      claimedAmount: BigInt("1200000000000000000"),
      season: 0,
      duration: BigInt(15552000),
      blockNumber: BigInt(36891708), // Higher block number
      blockTimestamp: new Date("2025-10-16T00:00:00Z"),
      transactionHash: testTxHash2,
    });

    // Get latest claim for season 0
    const latestClaim =
      await convictionClaimsRepository.getLatestConvictionClaim(
        testAccount1,
        0,
      );
    expect(latestClaim).not.toBeNull();
    expect(latestClaim!.blockNumber).toBe(BigInt(36891708));
    expect(latestClaim!.claimedAmount).toBe(BigInt("1200000000000000000"));

    // Get latest claim for non-existent season
    const noClaimSeason =
      await convictionClaimsRepository.getLatestConvictionClaim(
        testAccount1,
        99,
      );
    expect(noClaimSeason).toBeNull();

    // Get latest claim for non-existent account
    const noClaimAccount =
      await convictionClaimsRepository.getLatestConvictionClaim(
        "0x0000000000000000000000000000000000000000",
        0,
      );
    expect(noClaimAccount).toBeNull();
  });

  test("addresses should be normalized to lowercase", async () => {
    const upperCaseAccount = "0x686BAB3F162E72F903FA9DA42D1726E5D01BB46A";
    const lowerCaseAccount = "0x686bab3f162e72f903fa9da42d1726e5d01bb46a";

    await convictionClaimsRepository.saveConvictionClaim({
      account: upperCaseAccount, // Save with uppercase
      eligibleAmount: BigInt("1000000000000000000"),
      claimedAmount: BigInt("1000000000000000000"),
      season: 0,
      duration: BigInt(31536000),
      blockNumber: BigInt(36891706),
      blockTimestamp: new Date("2025-10-15T23:59:19Z"),
      transactionHash: testTxHash1,
    });

    // Query with uppercase
    const claimsUpper =
      await convictionClaimsRepository.getConvictionClaimsByAccount(
        upperCaseAccount,
      );
    expect(claimsUpper).toHaveLength(1);
    expect(claimsUpper[0]!.account).toBe(lowerCaseAccount);

    // Query with lowercase
    const claimsLower =
      await convictionClaimsRepository.getConvictionClaimsByAccount(
        lowerCaseAccount,
      );
    expect(claimsLower).toHaveLength(1);
    expect(claimsLower[0]!.account).toBe(lowerCaseAccount);
  });
});
