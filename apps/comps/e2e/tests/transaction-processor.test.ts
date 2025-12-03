import { beforeEach, describe, expect, test } from "vitest";

import { ConvictionClaimsRepository } from "@recallnet/db/repositories/conviction-claims";
import { seasons } from "@recallnet/db/schema/airdrop/defs";
import { convictionClaims } from "@recallnet/db/schema/conviction-claims/defs";
import { TransactionProcessor } from "@recallnet/services/indexing";

import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";

describe("TransactionProcessor", () => {
  let transactionProcessor: TransactionProcessor;
  let convictionClaimsRepository: ConvictionClaimsRepository;

  beforeEach(async () => {
    // Initialize transaction processor and repository directly
    const logger = createLogger("TransactionProcessor");
    convictionClaimsRepository = new ConvictionClaimsRepository(db, logger);
    transactionProcessor = new TransactionProcessor(
      convictionClaimsRepository,
      logger,
    );

    // Clean up existing data
    await db.delete(convictionClaims);
    await db.delete(seasons);

    // Insert required seasons for the tests
    // Season 1 is used in multiple tests
    const startDate = new Date("2024-01-01T00:00:00Z");
    const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    await db
      .insert(seasons)
      .values({
        id: 1,
        number: 1,
        name: "Season 1",
        startDate,
        endDate,
      })
      .onConflictDoNothing();
  });

  describe("conviction claim insertion", () => {
    test("should process conviction claim transaction successfully", async () => {
      // Create a test transaction that should trigger a conviction claim
      const testTransaction = {
        hash: "0xb9af1dd26c1ef5a1ac9e5e3a756c788a0f5742995009aff2b5f2f5057290e9fb",
        from: "0x1234567890123456789012345678901234567890",
        to: "0x6A3044c1Cf077F386c9345eF84f2518A2682Dfff",
        // This is a properly encoded claim function call with:
        // - claimer address
        // - amount: 1000000000000000000 (1e18)
        // - season: 1
        // - duration: 7776000 (90 days in seconds)
        input:
          "0x2ac96e2a" +
          "00000000000000000000000000000000000000000000000000000000000000c0" + // proof offset
          "0000000000000000000000001234567890123456789012345678901234567890" + // to address
          "0000000000000000000000000000000000000000000000000de0b6b3a7640000" + // amount (1e18)
          "0000000000000000000000000000000000000000000000000000000000000001" + // season (1)
          "000000000000000000000000000000000000000000000000000000000076a700" + // duration (7776000)
          "00000000000000000000000000000000000000000000000000000000000000e0" + // signature offset
          "0000000000000000000000000000000000000000000000000000000000000000" + // proof length (0)
          "0000000000000000000000000000000000000000000000000000000000000000", // signature length (0)
        blockNumber: 36871800n,
        blockTimestamp: new Date("2024-01-01T00:00:00Z"),
      };

      // Process the transaction
      const result =
        await transactionProcessor.processTransaction(testTransaction);

      // Verify the transaction was processed successfully
      expect(result).toBe(true);

      // Verify the conviction claim was saved correctly
      const claims =
        await convictionClaimsRepository.getConvictionClaimsByAccount(
          "0x1234567890123456789012345678901234567890",
          1, // season
        );

      expect(claims).toHaveLength(1);
      expect(claims[0]).toMatchObject({
        account: "0x1234567890123456789012345678901234567890".toLowerCase(),
        season: 1,
        duration: 7776000n,
      });
    });
  });

  describe("transaction processing", () => {
    test("should extract claim parameters correctly from transaction input", async () => {
      const testTransaction = {
        hash: "0xe9af1dd26c1ef5a1ac9e5e3a756c788a0f5742995009aff2b5f2f5057290e9fe",
        from: "0x4567890123456789012345678901234567890123",
        to: "0x6A3044c1Cf077F386c9345eF84f2518A2682Dfff",
        input:
          "0x2ac96e2a00000000000000000000000000000000000000000000000000000000000000c000000000000000000000000045678901234567890123456789012345678901230000000000000000000000000000000000000000000000001bc16d674ec8000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000ed4e0000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
        blockNumber: 36871803n,
        blockTimestamp: new Date("2024-01-01T00:03:00Z"),
      };

      const result =
        await transactionProcessor.processTransaction(testTransaction);
      expect(result).toBe(true);

      const claims =
        await convictionClaimsRepository.getConvictionClaimsByAccount(
          "0x4567890123456789012345678901234567890123",
          1,
        );

      expect(claims).toHaveLength(1);
      expect(claims[0]).toMatchObject({
        account: "0x4567890123456789012345678901234567890123".toLowerCase(),
        eligibleAmount: 2000000000000000000n, // 2e18
        claimedAmount: 1200000000000000000n, // 60% of 2e18 for 180 days
        season: 1,
        duration: 15552000n, // 180 days in seconds
      });
    });

    test("should handle idempotent processing", async () => {
      const testTransaction = {
        hash: "0xf9af1dd26c1ef5a1ac9e5e3a756c788a0f5742995009aff2b5f2f5057290e9ff",
        from: "0x5678901234567890123456789012345678901234",
        to: "0x6A3044c1Cf077F386c9345eF84f2518A2682Dfff",
        input:
          "0x2ac96e2a" +
          "00000000000000000000000000000000000000000000000000000000000000c0" + // proof offset
          "0000000000000000000000005678901234567890123456789012345678901234" + // to address
          "0000000000000000000000000000000000000000000000000de0b6b3a7640000" + // amount
          "0000000000000000000000000000000000000000000000000000000000000001" + // season
          "000000000000000000000000000000000000000000000000000000000076a700" + // duration
          "00000000000000000000000000000000000000000000000000000000000000e0" + // signature offset
          "0000000000000000000000000000000000000000000000000000000000000000" + // proof length (0)
          "0000000000000000000000000000000000000000000000000000000000000000", // signature length (0)
        blockNumber: 36871804n,
        blockTimestamp: new Date("2024-01-01T00:04:00Z"),
      };

      // Process the transaction once
      const result1 =
        await transactionProcessor.processTransaction(testTransaction);
      expect(result1).toBe(true);

      // Process the same transaction again (should be idempotent)
      const result2 =
        await transactionProcessor.processTransaction(testTransaction);
      expect(result2).toBe(false); // Should return false for duplicate

      // Verify only one claim was created
      const claims =
        await convictionClaimsRepository.getConvictionClaimsByAccount(
          "0x5678901234567890123456789012345678901234",
          1,
        );
      expect(claims).toHaveLength(1);
    });

    test("should return last block number for resumption", async () => {
      // Process a few transactions with different block numbers
      const transactions = [
        {
          hash: "0xa1af1dd26c1ef5a1ac9e5e3a756c788a0f5742995009aff2b5f2f5057290e9a1",
          from: "0x6789012345678901234567890123456789012345",
          to: "0x6A3044c1Cf077F386c9345eF84f2518A2682Dfff",
          input:
            "0x2ac96e2a" +
            "00000000000000000000000000000000000000000000000000000000000000c0" + // proof offset
            "0000000000000000000000006789012345678901234567890123456789012345" + // to address
            "0000000000000000000000000000000000000000000000000de0b6b3a7640000" + // amount
            "0000000000000000000000000000000000000000000000000000000000000001" + // season
            "000000000000000000000000000000000000000000000000000000000076a700" + // duration
            "00000000000000000000000000000000000000000000000000000000000000e0" + // signature offset
            "0000000000000000000000000000000000000000000000000000000000000000" + // proof length (0)
            "0000000000000000000000000000000000000000000000000000000000000000", // signature length (0)
          blockNumber: 36871900n,
          blockTimestamp: new Date("2024-01-01T01:00:00Z"),
        },
        {
          hash: "0xa2af1dd26c1ef5a1ac9e5e3a756c788a0f5742995009aff2b5f2f5057290e9a2",
          from: "0x7890123456789012345678901234567890123456",
          to: "0x6A3044c1Cf077F386c9345eF84f2518A2682Dfff",
          input:
            "0x2ac96e2a" +
            "00000000000000000000000000000000000000000000000000000000000000c0" + // proof offset
            "0000000000000000000000007890123456789012345678901234567890123456" + // to address
            "0000000000000000000000000000000000000000000000000de0b6b3a7640000" + // amount
            "0000000000000000000000000000000000000000000000000000000000000001" + // season
            "000000000000000000000000000000000000000000000000000000000076a700" + // duration
            "00000000000000000000000000000000000000000000000000000000000000e0" + // signature offset
            "0000000000000000000000000000000000000000000000000000000000000000" + // proof length (0)
            "0000000000000000000000000000000000000000000000000000000000000000", // signature length (0)
          blockNumber: 36872000n,
          blockTimestamp: new Date("2024-01-01T02:00:00Z"),
        },
      ];

      for (const tx of transactions) {
        await transactionProcessor.processTransaction(tx);
      }

      // Get the last block number
      const lastBlockNumber = await transactionProcessor.lastBlockNumber();

      // Should return the highest block number processed
      expect(lastBlockNumber).toBe(36872000n);
    });
  });
});
