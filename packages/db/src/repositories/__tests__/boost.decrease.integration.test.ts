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

import * as schema from "../../schema/boost/defs.js";
import * as coreSchema from "../../schema/core/defs.js";
import { dropAllSchemas } from "../../utils/drop-all-schemas.js";
import { pushSchema } from "../../utils/push-schema.js";
import { BoostRepository } from "../boost.js";
import { db } from "./db.js";

describe("BoostRepository.decrease() Integration Tests", () => {
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

    // Create required foreign key records using explicit UUIDs

    // 1. Create user (no dependencies) - provide explicit UUID and valid EVM address
    testUserId = randomUUID();
    testWallet = `0x${randomUUID().replace(/-/g, "").substring(0, 40).padEnd(40, "0")}`; // Generate valid 40-char EVM address
    await db.insert(coreSchema.users).values({
      id: testUserId,
      walletAddress: testWallet,
      name: "Test User for Decrease Integration",
      status: "active",
    });

    // 2. Create competition (no dependencies) - provide explicit UUID
    testCompetitionId = randomUUID();
    await db.insert(coreSchema.competitions).values({
      id: testCompetitionId,
      name: "Test Competition for Decrease Integration",
      description: "Integration test competition for decrease",
      status: "pending",
    });
  });

  afterEach(async () => {
    // Clean up in proper order to respect foreign key constraints

    try {
      // 1. Find and clean up boost changes first (restrict constraint)
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

      // 2. Clean up boost balances
      await db
        .delete(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, testUserId),
            eq(schema.boostBalances.competitionId, testCompetitionId),
          ),
        );

      // 3. Clean up competition (cascade will handle dependencies)
      await db
        .delete(coreSchema.competitions)
        .where(eq(coreSchema.competitions.id, testCompetitionId));

      // 4. Clean up user (cascade will handle dependencies)
      await db
        .delete(coreSchema.users)
        .where(eq(coreSchema.users.id, testUserId));
    } catch (error) {
      console.warn("Cleanup error:", error);
    }
  });

  describe("basic decrease functionality", () => {
    test("should successfully decrease from existing balance", async () => {
      // Setup: Give user some balance first
      await repository.increase({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 1000n,
      });

      // Now decrease the balance
      const result = await repository.decrease({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 300n,
      });

      expect(result.type).toBe("applied");
      if (result.type === "applied") {
        expect(result.balanceAfter).toBe(700n); // 1000 - 300
        expect(result.changeId).toBeDefined();
        expect(result.idemKey).toBeInstanceOf(Uint8Array);
      }

      // Verify actual database state
      const balanceRecords = await db
        .select()
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, testUserId),
            eq(schema.boostBalances.competitionId, testCompetitionId),
          ),
        );

      expect(balanceRecords).toHaveLength(1);
      expect(balanceRecords[0]?.balance).toBe(700n);

      // Verify we have both increase and decrease change records
      const changeRecords = await db
        .select()
        .from(schema.boostChanges)
        .where(eq(schema.boostChanges.balanceId, balanceRecords[0]!.id))
        .orderBy(schema.boostChanges.createdAt);

      expect(changeRecords).toHaveLength(2);
      expect(changeRecords[0]?.deltaAmount).toBe(1000n); // increase
      expect(changeRecords[1]?.deltaAmount).toBe(-300n); // decrease
    });

    test("should handle multiple decreases", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 1000n,
      });

      // First decrease
      const result1 = await repository.decrease({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 200n,
      });

      expect(result1.type).toBe("applied");
      if (result1.type === "applied") {
        expect(result1.balanceAfter).toBe(800n);
      }

      // Second decrease
      const result2 = await repository.decrease({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 300n,
      });

      expect(result2.type).toBe("applied");
      if (result2.type === "applied") {
        expect(result2.balanceAfter).toBe(500n); // 800 - 300
      }

      // Verify final database state
      const balanceRecords = await db
        .select()
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, testUserId),
            eq(schema.boostBalances.competitionId, testCompetitionId),
          ),
        );

      expect(balanceRecords[0]?.balance).toBe(500n);

      // Verify all change records (1 increase + 2 decreases)
      const changeRecords = await db
        .select()
        .from(schema.boostChanges)
        .where(eq(schema.boostChanges.balanceId, balanceRecords[0]!.id))
        .orderBy(schema.boostChanges.createdAt);

      expect(changeRecords).toHaveLength(3);
      expect(changeRecords[0]?.deltaAmount).toBe(1000n); // increase
      expect(changeRecords[1]?.deltaAmount).toBe(-200n); // first decrease
      expect(changeRecords[2]?.deltaAmount).toBe(-300n); // second decrease
    });

    test("should be able to decrease to zero balance", async () => {
      // Setup: Give user exact amount we'll decrease
      await repository.increase({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 500n,
      });

      // Decrease entire balance
      const result = await repository.decrease({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 500n,
      });

      expect(result.type).toBe("applied");
      if (result.type === "applied") {
        expect(result.balanceAfter).toBe(0n);
      }

      // Verify balance is exactly zero
      const balance = await repository.userBoostBalance({
        userId: testUserId,
        competitionId: testCompetitionId,
      });
      expect(balance).toBe(0n);

      // Verify database state
      const balanceRecords = await db
        .select()
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, testUserId),
            eq(schema.boostBalances.competitionId, testCompetitionId),
          ),
        );

      expect(balanceRecords[0]?.balance).toBe(0n);
    });
  });

  describe("error conditions with real database", () => {
    test("should fail when user has no balance (non-existent wallet)", async () => {
      // Try to decrease without any balance setup
      await expect(
        repository.decrease({
          userId: testUserId,
          competitionId: testCompetitionId,
          amount: 100n,
        }),
      ).rejects.toThrow("Can not decrease balance of non-existent user");

      // Verify no records were created
      const balanceRecords = await db
        .select()
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, testUserId),
            eq(schema.boostBalances.competitionId, testCompetitionId),
          ),
        );

      expect(balanceRecords).toHaveLength(0);
    });

    test("should fail when user has insufficient balance", async () => {
      // Setup: Give user small balance
      await repository.increase({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 100n,
      });

      // Try to decrease more than available
      await expect(
        repository.decrease({
          userId: testUserId,
          competitionId: testCompetitionId,
          amount: 200n, // More than 100n available
        }),
      ).rejects.toThrow("Can not decrease balance below zero");

      // Verify balance is unchanged
      const balance = await repository.userBoostBalance({
        userId: testUserId,
        competitionId: testCompetitionId,
      });
      expect(balance).toBe(100n);

      // Verify only the increase change record exists
      const balanceRecords = await db
        .select({ id: schema.boostBalances.id })
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, testUserId),
            eq(schema.boostBalances.competitionId, testCompetitionId),
          ),
        );

      const changeRecords = await db
        .select()
        .from(schema.boostChanges)
        .where(eq(schema.boostChanges.balanceId, balanceRecords[0]!.id));

      expect(changeRecords).toHaveLength(1); // Only increase, no decrease
      expect(changeRecords[0]?.deltaAmount).toBe(100n);
    });

    test("should fail with non-existent user", async () => {
      const fakeUserId = "00000000-0000-0000-0000-000000000000";

      await expect(
        repository.decrease({
          userId: fakeUserId, // Non-existent user
          competitionId: testCompetitionId,
          amount: 100n,
        }),
      ).rejects.toThrow("Can not decrease balance of non-existent user");
    });

    test("should throw error for zero amount", async () => {
      // Setup: Give user some balance so wallet exists
      await repository.increase({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 100n,
      });

      expect(() =>
        repository.decrease({
          userId: testUserId,
          competitionId: testCompetitionId,
          amount: 0n, // Zero amount not allowed
        }),
      ).toThrow("amount must be positive");

      // Verify balance remains unchanged
      const balance = await repository.userBoostBalance({
        userId: testUserId,
        competitionId: testCompetitionId,
      });
      expect(balance).toBe(100n);
    });

    test("should throw error for negative amount", async () => {
      // Setup: Give user some balance so wallet exists
      await repository.increase({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 100n,
      });

      expect(() =>
        repository.decrease({
          userId: testUserId,
          competitionId: testCompetitionId,
          amount: -50n, // Negative amount not allowed
        }),
      ).toThrow("amount must be positive");

      // Verify balance remains unchanged
      const balance = await repository.userBoostBalance({
        userId: testUserId,
        competitionId: testCompetitionId,
      });
      expect(balance).toBe(100n);
    });
  });

  describe("idempotency with real database", () => {
    test("should handle idempotent decreases with same idemKey", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 1000n,
      });

      const idemKey = randomBytes(32);

      // First decrease with idemKey
      const result1 = await repository.decrease({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 400n,
        idemKey,
      });

      expect(result1.type).toBe("applied");
      if (result1.type === "applied") {
        expect(result1.balanceAfter).toBe(600n);
      }

      // Second decrease with same idemKey - should be noop
      const result2 = await repository.decrease({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 400n, // Same amount
        idemKey, // Same key
      });

      expect(result2.type).toBe("noop");
      if (result2.type === "noop") {
        expect(result2.balance).toBe(600n);
      }

      // Verify database state reflects only one decrease
      const balance = await repository.userBoostBalance({
        userId: testUserId,
        competitionId: testCompetitionId,
      });
      expect(balance).toBe(600n); // Only decreased once

      // Verify only one decrease change record despite two calls
      const balanceRecords = await db
        .select({ id: schema.boostBalances.id })
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, testUserId),
            eq(schema.boostBalances.competitionId, testCompetitionId),
          ),
        );

      const changeRecords = await db
        .select()
        .from(schema.boostChanges)
        .where(eq(schema.boostChanges.balanceId, balanceRecords[0]!.id))
        .orderBy(schema.boostChanges.createdAt);

      expect(changeRecords).toHaveLength(2); // 1 increase + 1 decrease (idempotency worked!)
      expect(changeRecords[0]?.deltaAmount).toBe(1000n); // increase
      expect(changeRecords[1]?.deltaAmount).toBe(-400n); // decrease (only once)
    });

    test("should allow different idemKeys for same user/competition", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 1000n,
      });

      const idemKey1 = randomBytes(32);
      const idemKey2 = randomBytes(32);

      // First decrease
      const result1 = await repository.decrease({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 250n,
        idemKey: idemKey1,
      });

      expect(result1.type).toBe("applied");

      // Second decrease with different idemKey - should work
      const result2 = await repository.decrease({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 150n,
        idemKey: idemKey2, // Different key
      });

      expect(result2.type).toBe("applied");
      if (result2.type === "applied") {
        expect(result2.balanceAfter).toBe(600n); // 1000 - 250 - 150
      }

      // Verify both operations were applied
      const balanceRecords = await db
        .select({ id: schema.boostBalances.id })
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, testUserId),
            eq(schema.boostBalances.competitionId, testCompetitionId),
          ),
        );

      const changeRecords = await db
        .select()
        .from(schema.boostChanges)
        .where(eq(schema.boostChanges.balanceId, balanceRecords[0]!.id))
        .orderBy(schema.boostChanges.createdAt);

      expect(changeRecords).toHaveLength(3); // 1 increase + 2 decreases
      expect(changeRecords[0]?.deltaAmount).toBe(1000n); // increase
      expect(changeRecords[1]?.deltaAmount).toBe(-250n); // first decrease
      expect(changeRecords[2]?.deltaAmount).toBe(-150n); // second decrease
    });

    test("should work across different database sessions/connections", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 800n,
      });

      const idemKey = randomBytes(32);

      // First operation with original repository
      const result1 = await repository.decrease({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 200n,
        idemKey,
      });

      expect(result1.type).toBe("applied");

      // Create NEW repository instance (simulating different request/connection)
      const newRepository = new BoostRepository(db);

      // Same operation with same idemKey - should be idempotent across instances
      const result2 = await newRepository.decrease({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 200n,
        idemKey,
      });

      expect(result2.type).toBe("noop");

      // Verify only one decrease operation was applied
      const balance = await repository.userBoostBalance({
        userId: testUserId,
        competitionId: testCompetitionId,
      });
      expect(balance).toBe(600n); // 800 - 200 (only once)

      // Verify database has only one decrease change record
      const balanceRecords = await db
        .select({ id: schema.boostBalances.id })
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, testUserId),
            eq(schema.boostBalances.competitionId, testCompetitionId),
          ),
        );

      const changeRecords = await db
        .select()
        .from(schema.boostChanges)
        .where(eq(schema.boostChanges.balanceId, balanceRecords[0]!.id));

      expect(changeRecords).toHaveLength(2); // 1 increase + 1 decrease (cross-session idempotency!)
    });
  });

  describe("database transaction atomicity", () => {
    test("should ensure decrease operations are atomic", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 750n,
      });

      // Perform decrease operation
      const result = await repository.decrease({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 250n,
      });

      expect(result.type).toBe("applied");

      // Verify atomicity: balance update and change log must be consistent
      const balance = await repository.userBoostBalance({
        userId: testUserId,
        competitionId: testCompetitionId,
      });
      expect(balance).toBe(500n);

      // Verify change records match the balance
      const balanceRecords = await db
        .select({ id: schema.boostBalances.id })
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, testUserId),
            eq(schema.boostBalances.competitionId, testCompetitionId),
          ),
        );

      const changeRecords = await db
        .select()
        .from(schema.boostChanges)
        .where(eq(schema.boostChanges.balanceId, balanceRecords[0]!.id))
        .orderBy(schema.boostChanges.createdAt);

      // Verify balance equals sum of all changes
      const totalFromChanges = changeRecords.reduce(
        (sum, change) => sum + change.deltaAmount,
        0n,
      );
      expect(totalFromChanges).toBe(balance); // Perfect consistency!

      expect(changeRecords).toHaveLength(2);
      expect(changeRecords[0]?.deltaAmount).toBe(750n); // increase
      expect(changeRecords[1]?.deltaAmount).toBe(-250n); // decrease
    });
  });

  describe("metadata and wallet handling", () => {
    test("should persist metadata in decrease change records", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 600n,
      });

      const meta = { description: "Integration test boost decrease" };

      const result = await repository.decrease({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 200n,
        meta,
      });

      expect(result.type).toBe("applied");

      // Verify metadata was persisted in the decrease change record
      const balanceRecords = await db
        .select({ id: schema.boostBalances.id })
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, testUserId),
            eq(schema.boostBalances.competitionId, testCompetitionId),
          ),
        );

      const changeRecords = await db
        .select()
        .from(schema.boostChanges)
        .where(eq(schema.boostChanges.balanceId, balanceRecords[0]!.id))
        .orderBy(schema.boostChanges.createdAt);

      // Find the decrease record (negative delta)
      const decreaseRecord = changeRecords.find((r) => r.deltaAmount < 0);
      expect(decreaseRecord).toBeDefined();
      expect(decreaseRecord!.meta).toEqual(meta);
    });
  });

  describe("integration with userBoostBalance", () => {
    test("should reflect decreases in userBoostBalance", async () => {
      // Setup: Start with balance
      await repository.increase({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 900n,
      });

      // Verify initial balance
      const initialBalance = await repository.userBoostBalance({
        userId: testUserId,
        competitionId: testCompetitionId,
      });
      expect(initialBalance).toBe(900n);

      // Decrease some balance
      await repository.decrease({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 350n,
      });

      // Should reflect the decrease
      const balance1 = await repository.userBoostBalance({
        userId: testUserId,
        competitionId: testCompetitionId,
      });
      expect(balance1).toBe(550n);

      // Decrease more
      await repository.decrease({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 100n,
      });

      // Should reflect cumulative decreases
      const finalBalance = await repository.userBoostBalance({
        userId: testUserId,
        competitionId: testCompetitionId,
      });
      expect(finalBalance).toBe(450n); // 900 - 350 - 100
    });

    test("should maintain balance integrity across increase/decrease cycles", async () => {
      // Complex scenario: multiple increases and decreases

      // Start with balance
      await repository.increase({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 500n,
      });

      // Decrease some
      await repository.decrease({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 200n,
      });

      // Add more
      await repository.increase({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 300n,
      });

      // Decrease again
      await repository.decrease({
        userId: testUserId,
        competitionId: testCompetitionId,
        amount: 100n,
      });

      // Final balance should be: 500 - 200 + 300 - 100 = 500
      const finalBalance = await repository.userBoostBalance({
        userId: testUserId,
        competitionId: testCompetitionId,
      });
      expect(finalBalance).toBe(500n);

      // Verify all change records exist
      const balanceRecords = await db
        .select({ id: schema.boostBalances.id })
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, testUserId),
            eq(schema.boostBalances.competitionId, testCompetitionId),
          ),
        );

      const changeRecords = await db
        .select()
        .from(schema.boostChanges)
        .where(eq(schema.boostChanges.balanceId, balanceRecords[0]!.id))
        .orderBy(schema.boostChanges.createdAt);

      expect(changeRecords).toHaveLength(4);
      expect(changeRecords[0]?.deltaAmount).toBe(500n); // increase
      expect(changeRecords[1]?.deltaAmount).toBe(-200n); // decrease
      expect(changeRecords[2]?.deltaAmount).toBe(300n); // increase
      expect(changeRecords[3]?.deltaAmount).toBe(-100n); // decrease

      // Verify balance equals sum of changes (ultimate integrity test)
      const totalFromChanges = changeRecords.reduce(
        (sum, change) => sum + change.deltaAmount,
        0n,
      );
      expect(totalFromChanges).toBe(finalBalance);
    });
  });
});
