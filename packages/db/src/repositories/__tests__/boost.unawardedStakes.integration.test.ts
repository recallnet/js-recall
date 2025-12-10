import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import { BlockchainAddressAsU8A } from "../../coders/index.js";
import * as schema from "../../schema/boost/defs.js";
import * as coreSchema from "../../schema/core/defs.js";
import { stakes } from "../../schema/indexing/defs.js";
import { dropAllSchemas } from "../../utils/drop-all-schemas.js";
import { pushSchema } from "../../utils/push-schema.js";
import { BoostRepository } from "../boost.js";
import { db } from "./db.js";

describe("BoostRepository.unawardedStakes() Integration Tests", () => {
  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  let repository: BoostRepository;
  let testUserId: string;
  let testCompetitionId: string;
  let testWallet: string;

  beforeEach(async () => {
    repository = new BoostRepository(db);

    // Create required foreign key records
    testUserId = randomUUID();
    testWallet = `0x${randomUUID().replace(/-/g, "").substring(0, 40).padEnd(40, "0")}`;

    // 1. Create user
    await db.insert(coreSchema.users).values({
      id: testUserId,
      walletAddress: testWallet,
      name: "Test User for Unawarded Stakes",
      status: "active",
    });

    // 2. Create competition
    testCompetitionId = randomUUID();
    await db.insert(coreSchema.competitions).values({
      id: testCompetitionId,
      name: "Test Competition for Unawarded Stakes",
      description: "Integration test competition",
      status: "pending",
    });
  });

  afterEach(async () => {
    // Clean up in proper order to respect foreign key constraints
    try {
      // 1. Clean up stake boost awards
      await db
        .delete(schema.stakeBoostAwards)
        .where(eq(schema.stakeBoostAwards.competitionId, testCompetitionId));

      // 2. Clean up boost changes and balances
      const balances = await db
        .select({ id: schema.boostBalances.id })
        .from(schema.boostBalances);

      for (const balance of balances) {
        await db
          .delete(schema.boostChanges)
          .where(eq(schema.boostChanges.balanceId, balance.id));
      }

      await db.delete(schema.boostBalances);

      // 3. Clean up stakes
      await db.delete(stakes);

      // 4. Clean up competition
      await db
        .delete(coreSchema.competitions)
        .where(eq(coreSchema.competitions.id, testCompetitionId));

      // 5. Clean up user
      await db
        .delete(coreSchema.users)
        .where(eq(coreSchema.users.id, testUserId));
    } catch (error) {
      console.warn("Cleanup error:", error);
    }
  });

  describe("basic unawardedStakes functionality", () => {
    test("should return empty array when no stakes exist", async () => {
      const result = await repository.unawardedStakes(
        testWallet,
        testCompetitionId,
      );

      expect(result).toEqual([]);
    });

    test("should return all active stakes when no awards exist", async () => {
      const now = new Date();

      // Create three active stakes for the wallet with explicit timestamps
      // 1001n: oldest (now - 2000ms), 1002n: middle (now - 1000ms), 1003n: newest (now)
      const stakesData = [
        { id: 1001n, timeOffset: 2000 }, // oldest
        { id: 1002n, timeOffset: 1000 }, // middle
        { id: 1003n, timeOffset: 0 }, // newest
      ];

      for (const stakeData of stakesData) {
        const createdTime = new Date(now.getTime() - stakeData.timeOffset);
        await db.insert(stakes).values({
          id: stakeData.id,
          wallet: BlockchainAddressAsU8A.encode(testWallet),
          walletAddress: testWallet.toLowerCase(),
          amount: BigInt(stakeData.id) * 100n, // Different amounts for identification
          stakedAt: createdTime,
          canUnstakeAfter: new Date(now.getTime() + 3600000), // 1 hour from now
          createdAt: createdTime, // Different creation times
        });
      }

      const result = await repository.unawardedStakes(
        testWallet,
        testCompetitionId,
      );

      expect(result).toHaveLength(3);

      // Should be ordered by creation time (most recent first)
      expect(result.map((s) => s.id)).toEqual([1003n, 1002n, 1001n]);

      // Verify properties
      for (const stake of result) {
        expect(stake.wallet).toEqual(BlockchainAddressAsU8A.encode(testWallet));
        expect(stake.unstakedAt).toBeNull();
      }
    });

    test("should exclude unstaked stakes", async () => {
      const now = new Date();

      // Create one active stake and one unstaked stake
      await db.insert(stakes).values({
        id: 2001n,
        wallet: BlockchainAddressAsU8A.encode(testWallet),
        walletAddress: testWallet.toLowerCase(),
        amount: 1000n,
        stakedAt: now,
        canUnstakeAfter: new Date(now.getTime() + 3600000),
        createdAt: now,
        unstakedAt: null, // Active
      });

      await db.insert(stakes).values({
        id: 2002n,
        wallet: BlockchainAddressAsU8A.encode(testWallet),
        walletAddress: testWallet.toLowerCase(),
        amount: 2000n,
        stakedAt: now,
        canUnstakeAfter: new Date(now.getTime() + 3600000),
        createdAt: now,
        unstakedAt: new Date(), // Unstaked
      });

      const result = await repository.unawardedStakes(
        testWallet,
        testCompetitionId,
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(2001n);
      expect(result[0]?.unstakedAt).toBeNull();
    });

    test("should exclude stakes that already have awards for the competition", async () => {
      const now = new Date();

      // Create two active stakes
      const stakeId1 = 3001n;
      const stakeId2 = 3002n;

      await db.insert(stakes).values({
        id: stakeId1,
        wallet: BlockchainAddressAsU8A.encode(testWallet),
        walletAddress: testWallet.toLowerCase(),
        amount: 1000n,
        stakedAt: now,
        canUnstakeAfter: new Date(now.getTime() + 3600000),
        createdAt: now,
      });

      await db.insert(stakes).values({
        id: stakeId2,
        wallet: BlockchainAddressAsU8A.encode(testWallet),
        walletAddress: testWallet.toLowerCase(),
        amount: 2000n,
        stakedAt: now,
        canUnstakeAfter: new Date(now.getTime() + 3600000),
        createdAt: now,
      });

      // Create a boost change to reference in the award
      const increaseResult = await repository.increase({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 500n,
      });

      if (increaseResult.type !== "applied") {
        throw new Error("Failed to create test boost change");
      }

      // Create an award for the first stake
      await repository.recordStakeBoostAward({
        stakeId: stakeId1,
        baseAmount: 1000n,
        multiplier: 1.5,
        boostChangeId: increaseResult.changeId,
        competitionId: testCompetitionId,
      });

      const result = await repository.unawardedStakes(
        testWallet,
        testCompetitionId,
      );

      // Should only return the second stake (without award)
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(stakeId2);
    });

    test("should include stakes that have awards for different competitions", async () => {
      const now = new Date();

      // Create another competition
      const otherCompetitionId = randomUUID();
      await db.insert(coreSchema.competitions).values({
        id: otherCompetitionId,
        name: "Other Competition",
        description: "Different competition",
        status: "pending",
      });

      // Create a stake
      const stakeId = 4001n;
      await db.insert(stakes).values({
        id: stakeId,
        wallet: BlockchainAddressAsU8A.encode(testWallet),
        walletAddress: testWallet.toLowerCase(),
        amount: 1000n,
        stakedAt: now,
        canUnstakeAfter: new Date(now.getTime() + 3600000),
        createdAt: now,
      });

      // Create boost changes for both competitions
      const increaseResult1 = await repository.increase({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 500n,
      });

      const increaseResult2 = await repository.increase({
        userId: testUserId,
        competitionId: otherCompetitionId,
        amount: 300n,
      });

      if (
        increaseResult1.type !== "applied" ||
        increaseResult2.type !== "applied"
      ) {
        throw new Error("Failed to create test boost changes");
      }

      // Create an award for the other competition
      await repository.recordStakeBoostAward({
        stakeId: stakeId,
        baseAmount: 1500n,
        multiplier: 2.0,
        boostChangeId: increaseResult2.changeId,
        competitionId: otherCompetitionId,
      });

      // Should still return the stake for our test competition
      const result = await repository.unawardedStakes(
        testWallet,
        testCompetitionId,
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(stakeId);

      // Cleanup other competition
      await db
        .delete(schema.stakeBoostAwards)
        .where(eq(schema.stakeBoostAwards.competitionId, otherCompetitionId));

      const balances = await db
        .select({ id: schema.boostBalances.id })
        .from(schema.boostBalances)
        .where(eq(schema.boostBalances.competitionId, otherCompetitionId));

      for (const balance of balances) {
        await db
          .delete(schema.boostChanges)
          .where(eq(schema.boostChanges.balanceId, balance.id));
      }

      await db
        .delete(schema.boostBalances)
        .where(eq(schema.boostBalances.competitionId, otherCompetitionId));

      await db
        .delete(coreSchema.competitions)
        .where(eq(coreSchema.competitions.id, otherCompetitionId));
    });

    test("should only return stakes for the specified wallet", async () => {
      const now = new Date();
      const otherWallet = `0x${randomUUID().replace(/-/g, "").substring(0, 40).padEnd(40, "0")}`;

      // Create stakes for both wallets
      await db.insert(stakes).values({
        id: 5001n,
        wallet: BlockchainAddressAsU8A.encode(testWallet),
        walletAddress: testWallet.toLowerCase(),
        amount: 1000n,
        stakedAt: now,
        canUnstakeAfter: new Date(now.getTime() + 3600000),
        createdAt: now,
      });

      await db.insert(stakes).values({
        id: 5002n,
        wallet: BlockchainAddressAsU8A.encode(otherWallet),
        walletAddress: otherWallet.toLowerCase(),
        amount: 2000n,
        stakedAt: now,
        canUnstakeAfter: new Date(now.getTime() + 3600000),
        createdAt: now,
      });

      const result = await repository.unawardedStakes(
        testWallet,
        testCompetitionId,
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(5001n);
      expect(result[0]?.wallet).toEqual(
        BlockchainAddressAsU8A.encode(testWallet),
      );
    });
  });

  describe("ordering and consistency", () => {
    test("should order results by creation timestamp descending (most recent first)", async () => {
      const baseTime = new Date();
      const stakeData = [
        { id: 6001n, time: baseTime.getTime() - 3000 }, // Oldest
        { id: 6002n, time: baseTime.getTime() - 1000 }, // Newest
        { id: 6003n, time: baseTime.getTime() - 2000 }, // Middle
      ];

      for (const stake of stakeData) {
        const stakeTime = new Date(stake.time);
        await db.insert(stakes).values({
          id: stake.id,
          wallet: BlockchainAddressAsU8A.encode(testWallet),
          walletAddress: testWallet.toLowerCase(),
          amount: 1000n,
          stakedAt: stakeTime,
          canUnstakeAfter: new Date(stake.time + 3600000),
          createdAt: stakeTime,
        });
      }

      const result = await repository.unawardedStakes(
        testWallet,
        testCompetitionId,
      );

      expect(result).toHaveLength(3);
      // Should be ordered by creation time (most recent first)
      expect(result.map((s) => s.id)).toEqual([6002n, 6003n, 6001n]);

      // Verify the timestamps are correct
      expect(result[0]?.createdAt.getTime()).toBe(baseTime.getTime() - 1000);
      expect(result[1]?.createdAt.getTime()).toBe(baseTime.getTime() - 2000);
      expect(result[2]?.createdAt.getTime()).toBe(baseTime.getTime() - 3000);
    });
  });

  describe("transaction support", () => {
    test("should work within a transaction", async () => {
      const now = new Date();

      // Create a stake
      await db.insert(stakes).values({
        id: 7001n,
        wallet: BlockchainAddressAsU8A.encode(testWallet),
        walletAddress: testWallet.toLowerCase(),
        amount: 1000n,
        stakedAt: now,
        canUnstakeAfter: new Date(now.getTime() + 3600000),
        createdAt: now,
      });

      // Use the method within a transaction
      const result = await db.transaction(async (tx) => {
        return await repository.unawardedStakes(
          testWallet,
          testCompetitionId,
          tx,
        );
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(7001n);
    });

    test("should respect transaction isolation", async () => {
      const now = new Date();

      // Start with one stake
      await db.insert(stakes).values({
        id: 8001n,
        wallet: BlockchainAddressAsU8A.encode(testWallet),
        walletAddress: testWallet.toLowerCase(),
        amount: 1000n,
        stakedAt: now,
        canUnstakeAfter: new Date(now.getTime() + 3600000),
        createdAt: now,
      });

      // Verify initial state
      const initialResult = await repository.unawardedStakes(
        testWallet,
        testCompetitionId,
      );
      expect(initialResult).toHaveLength(1);

      // In a transaction, add an award but don't commit yet
      await db.transaction(async (tx) => {
        // Create boost change within transaction
        const increaseResult = await repository.increase(
          {
            userId: testUserId,
            competitionId: testCompetitionId,
            amount: 500n,
          },
          tx,
        );

        if (increaseResult.type !== "applied") {
          throw new Error("Failed to create boost change in transaction");
        }

        // Create award within transaction
        await repository.recordStakeBoostAward(
          {
            stakeId: 8001n,
            baseAmount: 2000n,
            multiplier: 1.8,
            boostChangeId: increaseResult.changeId,
            competitionId: testCompetitionId,
          },
          tx,
        );

        // Within transaction, the stake should now be excluded
        const txResult = await repository.unawardedStakes(
          testWallet,
          testCompetitionId,
          tx,
        );
        expect(txResult).toHaveLength(0);
      });

      // After transaction, the stake should be excluded from outside queries too
      const finalResult = await repository.unawardedStakes(
        testWallet,
        testCompetitionId,
      );
      expect(finalResult).toHaveLength(0);
    });
  });
});
