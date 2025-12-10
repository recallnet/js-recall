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

import * as schema from "../../schema/boost/defs.js";
import * as coreSchema from "../../schema/core/defs.js";
import { dropAllSchemas } from "../../utils/drop-all-schemas.js";
import { pushSchema } from "../../utils/push-schema.js";
import { BoostRepository } from "../boost.js";
import { db } from "./db.js";

describe("BoostRepository.userBoostBalance() Integration Tests", () => {
  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  let repository: BoostRepository;
  let testUserId1: string;
  let testUserId2: string;
  let testCompetitionId1: string;
  let testCompetitionId2: string;
  let testWallet1: string;
  let testWallet2: string;

  beforeEach(async () => {
    repository = new BoostRepository(db);

    // Create multiple users and competitions for isolation testing

    // 1. Create first user
    testUserId1 = randomUUID();
    testWallet1 = `0x${randomUUID().replace(/-/g, "").substring(0, 40).padEnd(40, "1")}`;
    await db.insert(coreSchema.users).values({
      id: testUserId1,
      walletAddress: testWallet1,
      name: "Test User 1 for Balance Integration",
      status: "active",
    });

    // 2. Create second user
    testUserId2 = randomUUID();
    testWallet2 = `0x${randomUUID().replace(/-/g, "").substring(0, 40).padEnd(40, "2")}`;
    await db.insert(coreSchema.users).values({
      id: testUserId2,
      walletAddress: testWallet2,
      name: "Test User 2 for Balance Integration",
      status: "active",
    });

    // 3. Create first competition
    testCompetitionId1 = randomUUID();
    await db.insert(coreSchema.competitions).values({
      id: testCompetitionId1,
      name: "Test Competition 1 for Balance Integration",
      description: "First test competition",
      status: "pending",
    });

    // 4. Create second competition
    testCompetitionId2 = randomUUID();
    await db.insert(coreSchema.competitions).values({
      id: testCompetitionId2,
      name: "Test Competition 2 for Balance Integration",
      description: "Second test competition",
      status: "pending",
    });
  });

  afterEach(async () => {
    // Clean up all test data in proper order

    try {
      // Clean up boost changes and balances for both users and competitions
      const allBalances = await db
        .select({ id: schema.boostBalances.id })
        .from(schema.boostBalances)
        .where(and(eq(schema.boostBalances.userId, testUserId1)));

      const allBalances2 = await db
        .select({ id: schema.boostBalances.id })
        .from(schema.boostBalances)
        .where(and(eq(schema.boostBalances.userId, testUserId2)));

      // Clean up changes for both users
      for (const balance of [...allBalances, ...allBalances2]) {
        await db
          .delete(schema.boostChanges)
          .where(eq(schema.boostChanges.balanceId, balance.id));
      }

      // Clean up balances
      await db
        .delete(schema.boostBalances)
        .where(eq(schema.boostBalances.userId, testUserId1));

      await db
        .delete(schema.boostBalances)
        .where(eq(schema.boostBalances.userId, testUserId2));

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
        .where(eq(coreSchema.users.id, testUserId1));

      await db
        .delete(coreSchema.users)
        .where(eq(coreSchema.users.id, testUserId2));
    } catch (error) {
      console.warn("Cleanup error:", error);
    }
  });

  describe("basic balance retrieval", () => {
    test("should return 0n for user with no balance", async () => {
      const balance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      expect(balance).toBe(0n);
    });

    test("should return correct balance after increase", async () => {
      // Give user some balance
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 750n,
      });

      const balance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      expect(balance).toBe(750n);
    });

    test("should return correct balance after decrease", async () => {
      // Setup: Give user balance then decrease it
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 1000n,
      });

      await repository.decrease({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 400n,
      });

      const balance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      expect(balance).toBe(600n); // 1000 - 400
    });

    test("should reflect multiple balance operations", async () => {
      // Complex scenario: multiple increases and decreases
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 500n,
      });

      await repository.decrease({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 200n,
      });

      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 300n,
      });

      const balance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      expect(balance).toBe(600n); // 500 - 200 + 300
    });
  });

  describe("user isolation", () => {
    test("should isolate balances between different users", async () => {
      // Give both users different balances in same competition
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 500n,
      });

      await repository.increase({
        userId: testUserId2,
        competitionId: testCompetitionId1,
        amount: 800n,
      });

      // Check balances are isolated
      const balance1 = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(balance1).toBe(500n);

      const balance2 = await repository.userBoostBalance({
        userId: testUserId2,
        competitionId: testCompetitionId1,
      });
      expect(balance2).toBe(800n);

      // Modify one user's balance
      await repository.decrease({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 100n,
      });

      // Verify only that user's balance changed
      const newBalance1 = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(newBalance1).toBe(400n); // 500 - 100

      const unchangedBalance2 = await repository.userBoostBalance({
        userId: testUserId2,
        competitionId: testCompetitionId1,
      });
      expect(unchangedBalance2).toBe(800n); // Unchanged
    });

    test("should return 0n for non-existent user", async () => {
      const fakeUserId = "00000000-0000-0000-0000-000000000000";

      const balance = await repository.userBoostBalance({
        userId: fakeUserId,
        competitionId: testCompetitionId1,
      });

      expect(balance).toBe(0n);
    });
  });

  describe("competition isolation", () => {
    test("should isolate balances between different competitions", async () => {
      // Give same user different balances in different competitions
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 600n,
      });

      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId2,
        amount: 300n,
      });

      // Check balances are isolated by competition
      const balance1 = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(balance1).toBe(600n);

      const balance2 = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId2,
      });
      expect(balance2).toBe(300n);

      // Modify balance in one competition
      await repository.decrease({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 200n,
      });

      // Verify only that competition's balance changed
      const newBalance1 = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(newBalance1).toBe(400n); // 600 - 200

      const unchangedBalance2 = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId2,
      });
      expect(unchangedBalance2).toBe(300n); // Unchanged
    });

    test("should return 0n for non-existent competition", async () => {
      const fakeCompetitionId = "00000000-0000-0000-0000-000000000000";

      const balance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: fakeCompetitionId,
      });

      expect(balance).toBe(0n);
    });
  });

  describe("database consistency verification", () => {
    test("should return balance that matches database record", async () => {
      // Setup: Create balance through repository
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 850n,
      });

      // Get balance through repository
      const repoBalance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      // Get balance directly from database
      const dbBalance = await db
        .select({ balance: schema.boostBalances.balance })
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, testUserId1),
            eq(schema.boostBalances.competitionId, testCompetitionId1),
          ),
        );

      // Both should match
      expect(repoBalance).toBe(850n);
      expect(dbBalance[0]?.balance).toBe(850n);
      expect(repoBalance).toBe(dbBalance[0]?.balance);
    });

    test("should reflect real-time balance changes", async () => {
      // Initial balance
      let balance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(balance).toBe(0n);

      // After increase
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 400n,
      });

      balance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(balance).toBe(400n);

      // After decrease
      await repository.decrease({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 150n,
      });

      balance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(balance).toBe(250n);

      // After another increase
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 100n,
      });

      balance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(balance).toBe(350n); // 400 - 150 + 100
    });
  });

  describe("transaction behavior", () => {
    test("should work within a database transaction", async () => {
      // Setup: Give user balance
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 600n,
      });

      // Test reading balance within a transaction
      await db.transaction(async (tx) => {
        const balance = await repository.userBoostBalance(
          {
            userId: testUserId1,
            competitionId: testCompetitionId1,
          },
          tx,
        );

        expect(balance).toBe(600n);

        // Perform operation within same transaction
        await repository.increase(
          {
            userId: testUserId1,
            competitionId: testCompetitionId1,
            amount: 200n,
          },
          tx,
        );

        // Read updated balance within same transaction
        const updatedBalance = await repository.userBoostBalance(
          {
            userId: testUserId1,
            competitionId: testCompetitionId1,
          },
          tx,
        );

        expect(updatedBalance).toBe(800n); // 600 + 200
      });

      // Verify the transaction committed properly
      const finalBalance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(finalBalance).toBe(800n);
    });
  });

  describe("multi-user multi-competition scenarios", () => {
    test("should handle complex matrix of users and competitions", async () => {
      // Create a matrix of balances:
      // User1, Comp1: 500n
      // User1, Comp2: 300n
      // User2, Comp1: 700n
      // User2, Comp2: 0n (no balance)

      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 500n,
      });

      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId2,
        amount: 300n,
      });

      await repository.increase({
        userId: testUserId2,
        competitionId: testCompetitionId1,
        amount: 700n,
      });

      // Verify all balances are correctly isolated
      expect(
        await repository.userBoostBalance({
          userId: testUserId1,
          competitionId: testCompetitionId1,
        }),
      ).toBe(500n);

      expect(
        await repository.userBoostBalance({
          userId: testUserId1,
          competitionId: testCompetitionId2,
        }),
      ).toBe(300n);

      expect(
        await repository.userBoostBalance({
          userId: testUserId2,
          competitionId: testCompetitionId1,
        }),
      ).toBe(700n);

      expect(
        await repository.userBoostBalance({
          userId: testUserId2,
          competitionId: testCompetitionId2,
        }),
      ).toBe(0n); // No balance created

      // Verify actual database records match (filter by our test users)
      const allBalanceRecords = await db
        .select()
        .from(schema.boostBalances)
        .where(and(eq(schema.boostBalances.userId, testUserId1)));

      const user2BalanceRecords = await db
        .select()
        .from(schema.boostBalances)
        .where(and(eq(schema.boostBalances.userId, testUserId2)));

      expect(allBalanceRecords).toHaveLength(2); // User 1 has 2 records (comp1, comp2)
      expect(user2BalanceRecords).toHaveLength(1); // User 2 has 1 record (comp1 only)

      // Verify specific balance records exist with correct values
      const user1Comp1 = allBalanceRecords.find(
        (b) =>
          b.userId === testUserId1 && b.competitionId === testCompetitionId1,
      );
      expect(user1Comp1?.balance).toBe(500n);

      const user1Comp2 = allBalanceRecords.find(
        (b) =>
          b.userId === testUserId1 && b.competitionId === testCompetitionId2,
      );
      expect(user1Comp2?.balance).toBe(300n);

      const user2Comp1 = user2BalanceRecords.find(
        (b) =>
          b.userId === testUserId2 && b.competitionId === testCompetitionId1,
      );
      expect(user2Comp1?.balance).toBe(700n);

      // Verify user2/comp2 has no record
      const user2Comp2 = user2BalanceRecords.find(
        (b) =>
          b.userId === testUserId2 && b.competitionId === testCompetitionId2,
      );
      expect(user2Comp2).toBeUndefined();
    });

    test("should maintain consistency after mixed operations", async () => {
      // Setup balances for multiple users
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 1000n,
      });

      await repository.increase({
        userId: testUserId2,
        competitionId: testCompetitionId1,
        amount: 800n,
      });

      // Perform mixed operations
      await repository.decrease({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 300n,
      });

      await repository.increase({
        userId: testUserId2,
        competitionId: testCompetitionId1,
        amount: 200n,
      });

      await repository.decrease({
        userId: testUserId2,
        competitionId: testCompetitionId1,
        amount: 100n,
      });

      // Verify final balances
      const balance1 = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });
      expect(balance1).toBe(700n); // 1000 - 300

      const balance2 = await repository.userBoostBalance({
        userId: testUserId2,
        competitionId: testCompetitionId1,
      });
      expect(balance2).toBe(900n); // 800 + 200 - 100

      // Verify database consistency - sum all changes should equal current balance
      const allBalances = await db
        .select({
          id: schema.boostBalances.id,
          balance: schema.boostBalances.balance,
        })
        .from(schema.boostBalances)
        .where(eq(schema.boostBalances.competitionId, testCompetitionId1));

      for (const balanceRecord of allBalances) {
        const changes = await db
          .select()
          .from(schema.boostChanges)
          .where(eq(schema.boostChanges.balanceId, balanceRecord.id));

        const totalFromChanges = changes.reduce(
          (sum, change) => sum + change.deltaAmount,
          0n,
        );

        expect(totalFromChanges).toBe(balanceRecord.balance);
      }
    });
  });

  describe("edge cases and boundary conditions", () => {
    test("should handle zero balance correctly", async () => {
      // Create balance then reduce to zero
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 200n,
      });

      await repository.decrease({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 200n,
      });

      const balance = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      expect(balance).toBe(0n);

      // Verify the balance record still exists but with zero balance
      const balanceRecords = await db
        .select()
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, testUserId1),
            eq(schema.boostBalances.competitionId, testCompetitionId1),
          ),
        );

      expect(balanceRecords).toHaveLength(1);
      expect(balanceRecords[0]?.balance).toBe(0n);
    });

    test("should return same result across multiple calls", async () => {
      // Setup: Create balance
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 450n,
      });

      // Call userBoostBalance multiple times
      const balance1 = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      const balance2 = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      const balance3 = await repository.userBoostBalance({
        userId: testUserId1,
        competitionId: testCompetitionId1,
      });

      // All calls should return the same result
      expect(balance1).toBe(450n);
      expect(balance2).toBe(450n);
      expect(balance3).toBe(450n);
      expect(balance1).toBe(balance2);
      expect(balance2).toBe(balance3);
    });
  });

  describe("concurrent access simulation", () => {
    test("should handle concurrent reads correctly", async () => {
      // Setup: Create balance
      await repository.increase({
        userId: testUserId1,
        competitionId: testCompetitionId1,
        amount: 555n,
      });

      // Simulate concurrent reads from different repository instances
      const repo1 = new BoostRepository(db);
      const repo2 = new BoostRepository(db);
      const repo3 = new BoostRepository(db);

      const [balance1, balance2, balance3] = await Promise.all([
        repo1.userBoostBalance({
          userId: testUserId1,
          competitionId: testCompetitionId1,
        }),
        repo2.userBoostBalance({
          userId: testUserId1,
          competitionId: testCompetitionId1,
        }),
        repo3.userBoostBalance({
          userId: testUserId1,
          competitionId: testCompetitionId1,
        }),
      ]);

      // All concurrent reads should return the same correct balance
      expect(balance1).toBe(555n);
      expect(balance2).toBe(555n);
      expect(balance3).toBe(555n);
    });
  });
});
