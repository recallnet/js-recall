import { and, eq } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
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
import { dropAllSchemas } from "../../utils/drop-all-schemas.js";
import { pushSchema } from "../../utils/push-schema.js";
import { BoostRepository } from "../boost.js";
import { db } from "./db.js";

describe("BoostRepository.mergeBoost() Integration Tests", () => {
  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  let repository: BoostRepository;
  let fromUserId: string;
  let toUserId: string;
  let testCompetitionId1: string;
  let testCompetitionId2: string;
  let testWallet1: string;
  let testWallet2: string;

  beforeEach(async () => {
    repository = new BoostRepository(db);

    // Create required foreign key records using explicit UUIDs

    // Create two test users
    fromUserId = randomUUID();
    toUserId = randomUUID();
    testWallet1 = `0x${randomUUID().replace(/-/g, "").substring(0, 40).padEnd(40, "0")}`; // Generate valid 40-char EVM address
    testWallet2 = `0x${randomUUID().replace(/-/g, "").substring(0, 40).padEnd(40, "0")}`; // Generate valid 40-char EVM address

    await db.insert(coreSchema.users).values([
      {
        id: fromUserId,
        walletAddress: testWallet1,
        name: "Test User From for Boost Merge Integration",
        status: "active",
      },
      {
        id: toUserId,
        walletAddress: testWallet2,
        name: "Test User To for Boost Merge Integration",
        status: "active",
      },
    ]);

    // Create two test competitions
    testCompetitionId1 = randomUUID();
    testCompetitionId2 = randomUUID();
    await db.insert(coreSchema.competitions).values([
      {
        id: testCompetitionId1,
        name: "Test Competition 1 for Boost Merge Integration",
        description: "Integration test competition 1",
        status: "pending",
      },
      {
        id: testCompetitionId2,
        name: "Test Competition 2 for Boost Merge Integration",
        description: "Integration test competition 2",
        status: "pending",
      },
    ]);
  });

  afterEach(async () => {
    // Clean up in proper order to respect foreign key constraints
    try {
      // Clean up boost changes first
      const allBalances = await db
        .select({ id: schema.boostBalances.id })
        .from(schema.boostBalances)
        .where(and(eq(schema.boostBalances.userId, fromUserId)));

      const allToBalances = await db
        .select({ id: schema.boostBalances.id })
        .from(schema.boostBalances)
        .where(and(eq(schema.boostBalances.userId, toUserId)));

      const balancesToClean = [...allBalances, ...allToBalances];

      for (const balance of balancesToClean) {
        await db
          .delete(schema.boostChanges)
          .where(eq(schema.boostChanges.balanceId, balance.id));
      }

      // Clean up boost balances
      await db
        .delete(schema.boostBalances)
        .where(eq(schema.boostBalances.userId, fromUserId));

      await db
        .delete(schema.boostBalances)
        .where(eq(schema.boostBalances.userId, toUserId));

      // Clean up competitions
      await db
        .delete(coreSchema.competitions)
        .where(eq(coreSchema.competitions.id, testCompetitionId1));

      await db
        .delete(coreSchema.competitions)
        .where(eq(coreSchema.competitions.id, testCompetitionId2));

      // Clean up users
      await db
        .delete(coreSchema.users)
        .where(eq(coreSchema.users.id, fromUserId));

      await db
        .delete(coreSchema.users)
        .where(eq(coreSchema.users.id, toUserId));
    } catch (error) {
      console.warn("Cleanup error:", error);
    }
  });

  describe("basic merge functionality", () => {
    test("should merge single competition balance from source to target user", async () => {
      // Set up source user with some boost balance
      await repository.increase({
        userId: fromUserId,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 1000n,
      });

      // Perform merge
      const result = await repository.mergeBoost(fromUserId, toUserId);

      expect(result).toHaveLength(1);

      // Verify target user now has the balance
      const targetBalance = await repository.userBoostBalance({
        userId: toUserId,
        competitionId: testCompetitionId1,
      });
      expect(targetBalance).toBe(1000n);

      // Verify source user balance still exists but boost changes now point to target
      const sourceBalance = await repository.userBoostBalance({
        userId: fromUserId,
        competitionId: testCompetitionId1,
      });
      expect(sourceBalance).toBe(0n); // Source balance record still exists but should be 0

      // Verify boost changes are now linked to target user's balance
      const targetBalanceRecord = await db
        .select()
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, toUserId),
            eq(schema.boostBalances.competitionId, testCompetitionId1),
          ),
        );

      expect(targetBalanceRecord).toHaveLength(1);

      const changeRecords = await db
        .select()
        .from(schema.boostChanges)
        .where(eq(schema.boostChanges.balanceId, targetBalanceRecord[0]!.id));

      expect(changeRecords).toHaveLength(1);
      expect(changeRecords[0]?.deltaAmount).toBe(1000n);
      expect(changeRecords[0]?.wallet).toEqual(
        BlockchainAddressAsU8A.encode(testWallet1),
      );
    });

    test("should merge multiple competition balances", async () => {
      // Set up source user with balances in multiple competitions
      await repository.increase({
        userId: fromUserId,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 500n,
      });

      await repository.increase({
        userId: fromUserId,
        wallet: testWallet1,
        competitionId: testCompetitionId2,
        amount: 750n,
      });

      // Perform merge
      const result = await repository.mergeBoost(fromUserId, toUserId);

      expect(result).toHaveLength(2);

      // Verify target user has both balances
      const targetBalance1 = await repository.userBoostBalance({
        userId: toUserId,
        competitionId: testCompetitionId1,
      });
      expect(targetBalance1).toBe(500n);

      const targetBalance2 = await repository.userBoostBalance({
        userId: toUserId,
        competitionId: testCompetitionId2,
      });
      expect(targetBalance2).toBe(750n);
    });

    test("should handle multiple boost changes per competition", async () => {
      // Create multiple boost changes for same competition
      await repository.increase({
        userId: fromUserId,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 300n,
      });

      await repository.increase({
        userId: fromUserId,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 200n,
      });

      // Also create a decrease to test sum calculation
      await repository.decrease({
        userId: fromUserId,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 100n,
      });

      // Perform merge
      const result = await repository.mergeBoost(fromUserId, toUserId);

      expect(result).toHaveLength(1);

      // Verify target user has the correct net balance (300 + 200 - 100 = 400)
      const targetBalance = await repository.userBoostBalance({
        userId: toUserId,
        competitionId: testCompetitionId1,
      });
      expect(targetBalance).toBe(400n);

      // Verify all change records are now linked to target balance
      const targetBalanceRecord = await db
        .select()
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, toUserId),
            eq(schema.boostBalances.competitionId, testCompetitionId1),
          ),
        );

      const changeRecords = await db
        .select()
        .from(schema.boostChanges)
        .where(eq(schema.boostChanges.balanceId, targetBalanceRecord[0]!.id))
        .orderBy(schema.boostChanges.createdAt);

      expect(changeRecords).toHaveLength(3);
      expect(changeRecords[0]?.deltaAmount).toBe(300n);
      expect(changeRecords[1]?.deltaAmount).toBe(200n);
      expect(changeRecords[2]?.deltaAmount).toBe(-100n);
    });
  });

  describe("merging with existing target balances", () => {
    test("should add to existing target user balance", async () => {
      // Set up both users with balances in same competition
      await repository.increase({
        userId: fromUserId,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 600n,
      });

      await repository.increase({
        userId: toUserId,
        wallet: testWallet2,
        competitionId: testCompetitionId1,
        amount: 400n,
      });

      // Perform merge
      await repository.mergeBoost(fromUserId, toUserId);

      // Verify target user has combined balance
      const targetBalance = await repository.userBoostBalance({
        userId: toUserId,
        competitionId: testCompetitionId1,
      });
      expect(targetBalance).toBe(1000n); // 400 + 600

      // Verify we have change records from both users
      const targetBalanceRecord = await db
        .select()
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, toUserId),
            eq(schema.boostBalances.competitionId, testCompetitionId1),
          ),
        );

      const changeRecords = await db
        .select()
        .from(schema.boostChanges)
        .where(eq(schema.boostChanges.balanceId, targetBalanceRecord[0]!.id))
        .orderBy(schema.boostChanges.createdAt);

      expect(changeRecords).toHaveLength(2);
      // First change should be from source user (600n) - created first chronologically
      expect(changeRecords[0]?.deltaAmount).toBe(600n);
      expect(changeRecords[0]?.wallet).toEqual(
        BlockchainAddressAsU8A.encode(testWallet1),
      );
      // Second change should be from target user (400n) - created second chronologically
      expect(changeRecords[1]?.deltaAmount).toBe(400n);
      expect(changeRecords[1]?.wallet).toEqual(
        BlockchainAddressAsU8A.encode(testWallet2),
      );
    });

    test("should handle partial competition overlaps", async () => {
      // Source has balances in both competitions
      await repository.increase({
        userId: fromUserId,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 300n,
      });

      await repository.increase({
        userId: fromUserId,
        wallet: testWallet1,
        competitionId: testCompetitionId2,
        amount: 500n,
      });

      // Target has balance only in competition 1
      await repository.increase({
        userId: toUserId,
        wallet: testWallet2,
        competitionId: testCompetitionId1,
        amount: 200n,
      });

      // Perform merge
      const result = await repository.mergeBoost(fromUserId, toUserId);

      expect(result).toHaveLength(2);

      // Verify competition 1 balances are combined
      const targetBalance1 = await repository.userBoostBalance({
        userId: toUserId,
        competitionId: testCompetitionId1,
      });
      expect(targetBalance1).toBe(500n); // 200 + 300

      // Verify competition 2 balance is transferred
      const targetBalance2 = await repository.userBoostBalance({
        userId: toUserId,
        competitionId: testCompetitionId2,
      });
      expect(targetBalance2).toBe(500n);
    });
  });

  describe("edge cases", () => {
    test("should handle merging user with zero balances", async () => {
      // Create a zero-amount balance for source user
      await repository.increase({
        userId: fromUserId,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 0n,
      });

      // Perform merge
      const result = await repository.mergeBoost(fromUserId, toUserId);

      expect(result).toHaveLength(1);

      // Verify target user has zero balance
      const targetBalance = await repository.userBoostBalance({
        userId: toUserId,
        competitionId: testCompetitionId1,
      });
      expect(targetBalance).toBe(0n);

      // Verify change record was transferred
      const targetBalanceRecord = await db
        .select()
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, toUserId),
            eq(schema.boostBalances.competitionId, testCompetitionId1),
          ),
        );

      const changeRecords = await db
        .select()
        .from(schema.boostChanges)
        .where(eq(schema.boostChanges.balanceId, targetBalanceRecord[0]!.id));

      expect(changeRecords).toHaveLength(1);
      expect(changeRecords[0]?.deltaAmount).toBe(0n);
    });

    test("should handle merging user with no balances", async () => {
      // Source user has no boost balances at all

      // Perform merge
      const result = await repository.mergeBoost(fromUserId, toUserId);

      expect(result).toHaveLength(0);

      // Verify no balances exist for target user
      const targetBalances = await db
        .select()
        .from(schema.boostBalances)
        .where(eq(schema.boostBalances.userId, toUserId));

      expect(targetBalances).toHaveLength(0);
    });

    test("should handle complex balance calculations with positive and negative changes", async () => {
      // Create a complex history for source user
      await repository.increase({
        userId: fromUserId,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 1000n,
      });

      await repository.decrease({
        userId: fromUserId,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 300n,
      });

      await repository.increase({
        userId: fromUserId,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 250n,
      });

      await repository.decrease({
        userId: fromUserId,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 150n,
      });

      // Expected net: 1000 - 300 + 250 - 150 = 800

      // Perform merge
      await repository.mergeBoost(fromUserId, toUserId);

      // Verify correct net balance
      const targetBalance = await repository.userBoostBalance({
        userId: toUserId,
        competitionId: testCompetitionId1,
      });
      expect(targetBalance).toBe(800n);

      // Verify all change records were transferred
      const targetBalanceRecord = await db
        .select()
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, toUserId),
            eq(schema.boostBalances.competitionId, testCompetitionId1),
          ),
        );

      const changeRecords = await db
        .select()
        .from(schema.boostChanges)
        .where(eq(schema.boostChanges.balanceId, targetBalanceRecord[0]!.id))
        .orderBy(schema.boostChanges.createdAt);

      expect(changeRecords).toHaveLength(4);
      expect(changeRecords[0]?.deltaAmount).toBe(1000n);
      expect(changeRecords[1]?.deltaAmount).toBe(-300n);
      expect(changeRecords[2]?.deltaAmount).toBe(250n);
      expect(changeRecords[3]?.deltaAmount).toBe(-150n);
    });
  });

  describe("transaction behavior", () => {
    test("should handle merge within external transaction", async () => {
      // Set up source user with balance
      await repository.increase({
        userId: fromUserId,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 500n,
      });

      // Perform merge within transaction
      await db.transaction(async (tx) => {
        const result = await repository.mergeBoost(fromUserId, toUserId, tx);
        expect(result).toHaveLength(1);

        // Within transaction, verify changes
        const targetBalance = await repository.userBoostBalance(
          {
            userId: toUserId,
            competitionId: testCompetitionId1,
          },
          tx,
        );
        expect(targetBalance).toBe(500n);
      });

      // After transaction, verify changes persisted
      const finalBalance = await repository.userBoostBalance({
        userId: toUserId,
        competitionId: testCompetitionId1,
      });
      expect(finalBalance).toBe(500n);
    });

    test("should preserve idempotency keys and metadata during merge", async () => {
      const idemKey = randomBytes(32);
      const meta = { description: "Test boost for merge" };

      // Create boost with specific idempotency key and metadata
      await repository.increase({
        userId: fromUserId,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 400n,
        idemKey,
        meta,
      });

      // Perform merge
      await repository.mergeBoost(fromUserId, toUserId);

      // Verify change record preserved idempotency key and metadata
      const targetBalanceRecord = await db
        .select()
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, toUserId),
            eq(schema.boostBalances.competitionId, testCompetitionId1),
          ),
        );

      const changeRecords = await db
        .select()
        .from(schema.boostChanges)
        .where(eq(schema.boostChanges.balanceId, targetBalanceRecord[0]!.id));

      expect(changeRecords).toHaveLength(1);
      expect(changeRecords[0]?.idemKey).toEqual(idemKey);
      expect(changeRecords[0]?.meta).toEqual(meta);
    });
  });

  describe("error handling", () => {
    test("should handle non-existent source user gracefully", async () => {
      const fakeUserId = "00000000-0000-0000-0000-000000000000";

      // Should not throw, just return empty array
      const result = await repository.mergeBoost(fakeUserId, toUserId);
      expect(result).toHaveLength(0);
    });

    test("should fail with non-existent target user", async () => {
      const fakeToUserId = "00000000-0000-0000-0000-000000000000";

      // Set up source user with balance
      await repository.increase({
        userId: fromUserId,
        wallet: testWallet1,
        competitionId: testCompetitionId1,
        amount: 500n,
      });

      // Should fail due to foreign key constraint on target user
      await expect(
        repository.mergeBoost(fromUserId, fakeToUserId),
      ).rejects.toThrow(/violates foreign key constraint.*user/);
    });
  });
});
