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

describe("BoostRepository.increase() Integration Tests", () => {
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
      name: "Test User for Boost Integration",
      status: "active",
    });

    // 2. Create competition (no dependencies) - provide explicit UUID
    testCompetitionId = randomUUID();
    await db.insert(coreSchema.competitions).values({
      id: testCompetitionId,
      name: "Test Competition for Boost Integration",
      description: "Integration test competition",
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

  describe("basic increase functionality", () => {
    test("should create boost balance record on first increase", async () => {
      const result = await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId,
        amount: 1000n,
      });

      expect(result.type).toBe("applied");
      if (result.type === "applied") {
        expect(result.balanceAfter).toBe(1000n);
        expect(result.changeId).toBeDefined();
        expect(result.idemKey).toBeInstanceOf(Uint8Array);
      }

      // Verify actual database records were created
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
      expect(balanceRecords[0]?.balance).toBe(1000n);
      expect(balanceRecords[0]?.userId).toBe(testUserId);
      expect(balanceRecords[0]?.competitionId).toBe(testCompetitionId);

      // Verify change log was created
      const changeRecords = await db
        .select()
        .from(schema.boostChanges)
        .where(eq(schema.boostChanges.balanceId, balanceRecords[0]!.id));

      expect(changeRecords).toHaveLength(1);
      expect(changeRecords[0]?.deltaAmount).toBe(1000n);
      expect(changeRecords[0]?.wallet).toEqual(
        BlockchainAddressAsU8A.encode(testWallet),
      );
    });

    test("should add to existing boost balance on subsequent increases", async () => {
      // First increase
      const result1 = await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId,
        amount: 500n,
      });

      expect(result1.type).toBe("applied");

      // Second increase
      const result2 = await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId,
        amount: 300n,
      });

      expect(result2.type).toBe("applied");
      if (result2.type === "applied") {
        expect(result2.balanceAfter).toBe(800n); // 500 + 300
      }

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

      expect(balanceRecords).toHaveLength(1); // Still only one balance record
      expect(balanceRecords[0]?.balance).toBe(800n);

      // Verify both change records exist
      const changeRecords = await db
        .select()
        .from(schema.boostChanges)
        .where(eq(schema.boostChanges.balanceId, balanceRecords[0]!.id))
        .orderBy(schema.boostChanges.createdAt);

      expect(changeRecords).toHaveLength(2);
      expect(changeRecords[0]?.deltaAmount).toBe(500n);
      expect(changeRecords[1]?.deltaAmount).toBe(300n);
    });

    test("should handle zero amount increases", async () => {
      const result = await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId,
        amount: 0n,
      });

      expect(result.type).toBe("applied");
      if (result.type === "applied") {
        expect(result.balanceAfter).toBe(0n);
      }

      // Verify change record was created even for zero amount
      const balanceRecords = await db
        .select()
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

      expect(changeRecords).toHaveLength(1);
      expect(changeRecords[0]?.deltaAmount).toBe(0n);
    });
  });

  describe("idempotency with real database", () => {
    test("should handle idempotent increases with same idemKey", async () => {
      const idemKey = randomBytes(32);

      // First increase with idemKey
      const result1 = await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId,
        amount: 750n,
        idemKey,
      });

      expect(result1.type).toBe("applied");

      // Second increase with same idemKey - should be noop
      const result2 = await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId,
        amount: 750n, // Same amount
        idemKey, // Same key
      });

      expect(result2.type).toBe("noop");
      if (result2.type === "noop") {
        expect(result2.balance).toBe(750n);
      }

      // Verify database state reflects only one operation
      const balanceRecords = await db
        .select()
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, testUserId),
            eq(schema.boostBalances.competitionId, testCompetitionId),
          ),
        );

      expect(balanceRecords[0]?.balance).toBe(750n); // Only increased once

      // Verify only one change record despite two calls
      const changeRecords = await db
        .select()
        .from(schema.boostChanges)
        .where(eq(schema.boostChanges.balanceId, balanceRecords[0]!.id));

      expect(changeRecords).toHaveLength(1); // Idempotency worked!
      expect(changeRecords[0]?.deltaAmount).toBe(750n);
    });

    test("should allow different idemKeys for same user/competition", async () => {
      const idemKey1 = randomBytes(32);
      const idemKey2 = randomBytes(32);

      // First increase
      const result1 = await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId,
        amount: 400n,
        idemKey: idemKey1,
      });

      expect(result1.type).toBe("applied");

      // Second increase with different idemKey - should work
      const result2 = await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId,
        amount: 300n,
        idemKey: idemKey2, // Different key
      });

      expect(result2.type).toBe("applied");
      if (result2.type === "applied") {
        expect(result2.balanceAfter).toBe(700n); // 400 + 300
      }

      // Verify both operations were applied (filter by this test's balance)
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

      expect(changeRecords).toHaveLength(2);
      expect(changeRecords[0]?.deltaAmount).toBe(400n);
      expect(changeRecords[1]?.deltaAmount).toBe(300n);
    });

    test("should work across different database sessions/connections", async () => {
      const idemKey = randomBytes(32);

      // First operation with original repository
      const result1 = await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId,
        amount: 600n,
        idemKey,
      });

      expect(result1.type).toBe("applied");

      // Create NEW repository instance (simulating different request/connection)
      const newRepository = new BoostRepository(db);

      // Same operation with same idemKey - should be idempotent across instances
      const result2 = await newRepository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId,
        amount: 600n,
        idemKey,
      });

      expect(result2.type).toBe("noop");

      // Verify only one change record exists
      const balanceRecords = await db
        .select()
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

      expect(changeRecords).toHaveLength(1); // Cross-session idempotency works!
    });
  });

  describe("amount validation", () => {
    test("should throw error for negative amounts", async () => {
      await expect(
        repository.increase({
          userId: testUserId,
          wallet: testWallet,
          competitionId: testCompetitionId,
          amount: -100n, // Negative amount
        }),
      ).rejects.toThrow("amount must be non-negative");

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
  });

  describe("database constraint validation", () => {
    test("should fail with non-existent user", async () => {
      const fakeUserId = "00000000-0000-0000-0000-000000000000";

      await expect(
        repository.increase({
          userId: fakeUserId, // Non-existent user
          wallet: testWallet,
          competitionId: testCompetitionId,
          amount: 100n,
        }),
      ).rejects.toThrow(/violates foreign key constraint.*user/);

      // Verify no records were created
      const balanceRecords = await db
        .select()
        .from(schema.boostBalances)
        .where(eq(schema.boostBalances.userId, fakeUserId));

      expect(balanceRecords).toHaveLength(0);
    });

    test("should fail with non-existent competition", async () => {
      const fakeCompetitionId = "00000000-0000-0000-0000-000000000000";

      await expect(
        repository.increase({
          userId: testUserId,
          wallet: testWallet,
          competitionId: fakeCompetitionId, // Non-existent competition
          amount: 100n,
        }),
      ).rejects.toThrow(/violates foreign key constraint.*competition/);

      // Verify no records were created
      const balanceRecords = await db
        .select()
        .from(schema.boostBalances)
        .where(eq(schema.boostBalances.competitionId, fakeCompetitionId));

      expect(balanceRecords).toHaveLength(0);
    });
  });

  describe("metadata handling", () => {
    test("should persist metadata in change records", async () => {
      const meta = { description: "Integration test boost increase" };

      const result = await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId,
        amount: 500n,
        meta,
      });

      expect(result.type).toBe("applied");

      // Verify metadata was persisted
      const balanceRecords = await db
        .select()
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

      expect(changeRecords[0]?.meta).toEqual(meta);
    });
  });

  describe("wallet address handling", () => {
    test("should properly encode and store wallet address", async () => {
      const result = await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId,
        amount: 250n,
      });

      expect(result.type).toBe("applied");

      // Verify wallet was properly encoded and stored
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

      expect(changeRecords[0]?.wallet).toEqual(
        BlockchainAddressAsU8A.encode(testWallet),
      );

      // Verify the wallet is exactly 20 bytes (database constraint)
      expect(changeRecords[0]?.wallet.length).toBe(20);
    });
  });

  describe("userBoostBalance integration", () => {
    test("should reflect increases in userBoostBalance", async () => {
      // Initially should be 0
      const initialBalance = await repository.userBoostBalance({
        userId: testUserId,
        competitionId: testCompetitionId,
      });
      expect(initialBalance).toBe(0n);

      // Add some balance
      await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId,
        amount: 850n,
      });

      // Should now return the balance
      const balance = await repository.userBoostBalance({
        userId: testUserId,
        competitionId: testCompetitionId,
      });
      expect(balance).toBe(850n);

      // Add more balance
      await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId,
        amount: 150n,
      });

      // Should reflect cumulative balance
      const finalBalance = await repository.userBoostBalance({
        userId: testUserId,
        competitionId: testCompetitionId,
      });
      expect(finalBalance).toBe(1000n); // 850 + 150
    });

    test("should isolate balances by competition", async () => {
      // Create another competition
      const testCompetitionId2 = randomUUID();
      await db.insert(coreSchema.competitions).values({
        id: testCompetitionId2,
        name: "Second Test Competition",
        description: "Another test competition",
        status: "pending",
      });

      // Add balance to first competition
      await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId,
        amount: 500n,
      });

      // Add balance to second competition
      await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId2,
        amount: 300n,
      });

      // Balances should be separate
      const balance1 = await repository.userBoostBalance({
        userId: testUserId,
        competitionId: testCompetitionId,
      });
      expect(balance1).toBe(500n);

      const balance2 = await repository.userBoostBalance({
        userId: testUserId,
        competitionId: testCompetitionId2,
      });
      expect(balance2).toBe(300n);

      // Cleanup second competition - need to clean boost records first
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
