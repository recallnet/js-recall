import { and, eq } from "drizzle-orm";
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

describe("BoostRepository.recordStakeBoostAward() Integration Tests", () => {
  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  let repository: BoostRepository;
  let testUserId: string;
  let testCompetitionId: string;
  let testWallet: string;
  let testStakeId: bigint;
  let testBoostChangeId: string;

  beforeEach(async () => {
    repository = new BoostRepository(db);

    // Create required foreign key records
    testUserId = randomUUID();
    testWallet = `0x${randomUUID().replace(/-/g, "").substring(0, 40).padEnd(40, "0")}`;

    // 1. Create user
    await db.insert(coreSchema.users).values({
      id: testUserId,
      walletAddress: testWallet,
      name: "Test User for Stake Boost Award",
      status: "active",
    });

    // 2. Create competition
    testCompetitionId = randomUUID();
    await db.insert(coreSchema.competitions).values({
      id: testCompetitionId,
      name: "Test Competition for Stake Boost Award",
      description: "Integration test competition",
      status: "pending",
    });

    // 3. Create a stake
    testStakeId = 12345n;
    const now = new Date();
    await db.insert(stakes).values({
      id: testStakeId,
      wallet: BlockchainAddressAsU8A.encode(testWallet),
      walletAddress: testWallet.toLowerCase(),
      amount: 1000n,
      stakedAt: now,
      canUnstakeAfter: new Date(now.getTime() + 3600000),
      createdAt: now,
    });

    // 4. Create a boost balance and boost change to reference
    const increaseResult = await repository.increase({
      userId: testUserId,
      competitionId: testCompetitionId,
      amount: 500n,
    });

    if (increaseResult.type === "applied") {
      testBoostChangeId = increaseResult.changeId;
    } else {
      throw new Error("Failed to create test boost change");
    }
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
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, testUserId),
            eq(schema.boostBalances.competitionId, testCompetitionId),
          ),
        );

      for (const balance of balances) {
        await db
          .delete(schema.boostChanges)
          .where(eq(schema.boostChanges.balanceId, balance.id));
      }

      await db
        .delete(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, testUserId),
            eq(schema.boostBalances.competitionId, testCompetitionId),
          ),
        );

      // 3. Clean up stake
      await db.delete(stakes).where(eq(stakes.id, testStakeId));

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

  describe("basic recordStakeBoostAward functionality", () => {
    test("should create stake boost award record", async () => {
      const awardData = {
        stakeId: testStakeId,
        baseAmount: 1000n,
        multiplier: 1.5,
        boostChangeId: testBoostChangeId,
        competitionId: testCompetitionId,
      };

      const result = await repository.recordStakeBoostAward(awardData);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        stakeId: testStakeId,
        baseAmount: 1000n,
        multiplier: 1.5,
        boostChangeId: testBoostChangeId,
        competitionId: testCompetitionId,
      });
      expect(result[0]?.id).toBeDefined();
      expect(result[0]?.createdAt).toBeInstanceOf(Date);

      // Verify actual database record was created
      const awardRecords = await db
        .select()
        .from(schema.stakeBoostAwards)
        .where(
          and(
            eq(schema.stakeBoostAwards.stakeId, testStakeId),
            eq(schema.stakeBoostAwards.competitionId, testCompetitionId),
          ),
        );

      expect(awardRecords).toHaveLength(1);
      expect(awardRecords[0]?.stakeId).toBe(testStakeId);
      expect(awardRecords[0]?.baseAmount).toBe(1000n);
      expect(awardRecords[0]?.multiplier).toBe(1.5);
      expect(awardRecords[0]?.boostChangeId).toBe(testBoostChangeId);
      expect(awardRecords[0]?.competitionId).toBe(testCompetitionId);
    });

    test("should handle multiple awards for different stakes", async () => {
      // Create another stake
      const testStakeId2 = 54321n;
      const now = new Date();
      await db.insert(stakes).values({
        id: testStakeId2,
        wallet: BlockchainAddressAsU8A.encode(testWallet),
        walletAddress: testWallet.toLowerCase(),
        amount: 2000n,
        stakedAt: now,
        canUnstakeAfter: new Date(now.getTime() + 3600000),
        createdAt: now,
      });

      // Create another boost change
      const increaseResult2 = await repository.increase({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 750n,
      });

      if (increaseResult2.type !== "applied") {
        throw new Error("Failed to create second test boost change");
      }

      // Create awards for both stakes
      const award1 = {
        stakeId: testStakeId,
        baseAmount: 1000n,
        multiplier: 1.5,
        boostChangeId: testBoostChangeId,
        competitionId: testCompetitionId,
      };

      const award2 = {
        stakeId: testStakeId2,
        baseAmount: 2000n,
        multiplier: 2.0,
        boostChangeId: increaseResult2.changeId,
        competitionId: testCompetitionId,
      };

      await repository.recordStakeBoostAward(award1);
      await repository.recordStakeBoostAward(award2);

      // Verify both awards exist
      const awardRecords = await db
        .select()
        .from(schema.stakeBoostAwards)
        .where(eq(schema.stakeBoostAwards.competitionId, testCompetitionId));

      expect(awardRecords).toHaveLength(2);
      expect(awardRecords.map((r) => r.stakeId)).toContain(testStakeId);
      expect(awardRecords.map((r) => r.stakeId)).toContain(testStakeId2);

      // Cleanup second stake
      await db.delete(stakes).where(eq(stakes.id, testStakeId2));
    });

    test("should work within a transaction", async () => {
      const awardData = {
        stakeId: testStakeId,
        baseAmount: 1000n,
        multiplier: 1.5,
        boostChangeId: testBoostChangeId,
        competitionId: testCompetitionId,
      };

      // Use the method within a transaction
      const result = await db.transaction(async (tx) => {
        return await repository.recordStakeBoostAward(awardData, tx);
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.stakeId).toBe(testStakeId);

      // Verify the record was committed
      const awardRecords = await db
        .select()
        .from(schema.stakeBoostAwards)
        .where(
          and(
            eq(schema.stakeBoostAwards.stakeId, testStakeId),
            eq(schema.stakeBoostAwards.competitionId, testCompetitionId),
          ),
        );

      expect(awardRecords).toHaveLength(1);
    });
  });

  describe("foreign key constraint validation", () => {
    test("should fail with non-existent stake", async () => {
      const nonExistentStakeId = 99999n;
      const awardData = {
        stakeId: nonExistentStakeId,
        baseAmount: 1000n,
        multiplier: 1.5,
        boostChangeId: testBoostChangeId,
        competitionId: testCompetitionId,
      };

      await expect(repository.recordStakeBoostAward(awardData)).rejects.toThrow(
        /violates foreign key constraint.*stake/,
      );

      // Verify no record was created
      const awardRecords = await db
        .select()
        .from(schema.stakeBoostAwards)
        .where(eq(schema.stakeBoostAwards.stakeId, nonExistentStakeId));

      expect(awardRecords).toHaveLength(0);
    });

    test("should fail with non-existent boost change", async () => {
      const nonExistentBoostChangeId = "00000000-0000-0000-0000-000000000000";
      const awardData = {
        stakeId: testStakeId,
        baseAmount: 1000n,
        multiplier: 1.5,
        boostChangeId: nonExistentBoostChangeId,
        competitionId: testCompetitionId,
      };

      await expect(repository.recordStakeBoostAward(awardData)).rejects.toThrow(
        /violates foreign key constraint.*boost_change/,
      );

      // Verify no record was created
      const awardRecords = await db
        .select()
        .from(schema.stakeBoostAwards)
        .where(
          eq(schema.stakeBoostAwards.boostChangeId, nonExistentBoostChangeId),
        );

      expect(awardRecords).toHaveLength(0);
    });

    test("should fail with non-existent competition", async () => {
      const nonExistentCompetitionId = "00000000-0000-0000-0000-000000000000";
      const awardData = {
        stakeId: testStakeId,
        baseAmount: 1000n,
        multiplier: 1.5,
        boostChangeId: testBoostChangeId,
        competitionId: nonExistentCompetitionId,
      };

      await expect(repository.recordStakeBoostAward(awardData)).rejects.toThrow(
        /violates foreign key constraint.*competition/,
      );

      // Verify no record was created
      const awardRecords = await db
        .select()
        .from(schema.stakeBoostAwards)
        .where(
          eq(schema.stakeBoostAwards.competitionId, nonExistentCompetitionId),
        );

      expect(awardRecords).toHaveLength(0);
    });
  });

  describe("duplicate prevention", () => {
    test("should allow duplicate awards for same stake in different competitions", async () => {
      // Create another competition
      const testCompetitionId2 = randomUUID();
      await db.insert(coreSchema.competitions).values({
        id: testCompetitionId2,
        name: "Second Test Competition",
        description: "Another test competition",
        status: "pending",
      });

      // Create boost change for second competition
      const increaseResult2 = await repository.increase({
        userId: testUserId,
        competitionId: testCompetitionId2,
        amount: 300n,
      });

      if (increaseResult2.type !== "applied") {
        throw new Error("Failed to create boost change for second competition");
      }

      // Create awards for same stake in different competitions
      const award1 = {
        stakeId: testStakeId,
        baseAmount: 1000n,
        multiplier: 1.5,
        boostChangeId: testBoostChangeId,
        competitionId: testCompetitionId,
      };

      const award2 = {
        stakeId: testStakeId,
        baseAmount: 500n,
        multiplier: 2.0,
        boostChangeId: increaseResult2.changeId,
        competitionId: testCompetitionId2,
      };

      await repository.recordStakeBoostAward(award1);
      await repository.recordStakeBoostAward(award2);

      // Verify both awards exist
      const awards1 = await db
        .select()
        .from(schema.stakeBoostAwards)
        .where(eq(schema.stakeBoostAwards.competitionId, testCompetitionId));

      const awards2 = await db
        .select()
        .from(schema.stakeBoostAwards)
        .where(eq(schema.stakeBoostAwards.competitionId, testCompetitionId2));

      expect(awards1).toHaveLength(1);
      expect(awards2).toHaveLength(1);
      expect(awards1[0]?.stakeId).toBe(testStakeId);
      expect(awards2[0]?.stakeId).toBe(testStakeId);

      // Cleanup second competition
      await db
        .delete(schema.stakeBoostAwards)
        .where(eq(schema.stakeBoostAwards.competitionId, testCompetitionId2));

      const balances2 = await db
        .select({ id: schema.boostBalances.id })
        .from(schema.boostBalances)
        .where(eq(schema.boostBalances.competitionId, testCompetitionId2));

      for (const balance of balances2) {
        await db
          .delete(schema.boostChanges)
          .where(eq(schema.boostChanges.balanceId, balance.id));
      }

      await db
        .delete(schema.boostBalances)
        .where(eq(schema.boostBalances.competitionId, testCompetitionId2));

      await db
        .delete(coreSchema.competitions)
        .where(eq(coreSchema.competitions.id, testCompetitionId2));
    });
  });
});
