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

describe("BoostRepository Bonus Boost Methods Integration Tests", () => {
  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  let repository: BoostRepository;
  let testUserId: string;
  let testAdminId: string;
  let testWallet: string;
  let testCompetitionId: string;

  beforeEach(async () => {
    repository = new BoostRepository(db);

    testUserId = randomUUID();
    testWallet = `0x${randomUUID().replace(/-/g, "").substring(0, 40).padEnd(40, "0")}`;
    await db.insert(coreSchema.users).values({
      id: testUserId,
      walletAddress: testWallet,
      name: "Test User for Bonus Boost",
      status: "active",
    });

    testAdminId = randomUUID();
    await db.insert(coreSchema.admins).values({
      id: testAdminId,
      username: "testadmin",
      email: "admin@test.com",
      passwordHash: "fake-hash-for-testing",
      name: "Test Admin",
    });

    testCompetitionId = randomUUID();
    await db.insert(coreSchema.competitions).values({
      id: testCompetitionId,
      name: "Test Competition",
      description: "Test competition for bonus boost tests",
      status: "pending",
    });
  });

  afterEach(async () => {
    try {
      const balances = await db
        .select({ id: schema.boostBalances.id })
        .from(schema.boostBalances)
        .where(eq(schema.boostBalances.userId, testUserId));

      for (const balance of balances) {
        await db
          .delete(schema.boostChanges)
          .where(eq(schema.boostChanges.balanceId, balance.id));
      }

      await db
        .delete(schema.boostBalances)
        .where(eq(schema.boostBalances.userId, testUserId));

      await db
        .delete(schema.boostBonus)
        .where(eq(schema.boostBonus.userId, testUserId));

      await db
        .delete(coreSchema.competitions)
        .where(eq(coreSchema.competitions.id, testCompetitionId));

      await db
        .delete(coreSchema.users)
        .where(eq(coreSchema.users.id, testUserId));

      await db
        .delete(coreSchema.admins)
        .where(eq(coreSchema.admins.id, testAdminId));
    } catch (error) {
      console.warn("Cleanup error:", error);
    }
  });

  describe("createBoostBonus()", () => {
    test("should create bonus boost with required fields", async () => {
      const expiresAt = new Date("2025-12-31T23:59:59Z");
      const result = await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt,
      });

      expect(result.id).toBeDefined();
      expect(result.userId).toBe(testUserId);
      expect(result.amount).toBe(1000n);
      expect(result.expiresAt).toEqual(expiresAt);
      expect(result.isActive).toBe(true);
      expect(result.revokedAt).toBeNull();
      expect(result.createdByAdminId).toBeNull();
      expect(result.meta).toEqual({});
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);

      const [dbRecord] = await db
        .select()
        .from(schema.boostBonus)
        .where(eq(schema.boostBonus.id, result.id));

      expect(dbRecord).toBeDefined();
      expect(dbRecord!.amount).toBe(1000n);
      expect(dbRecord!.isActive).toBe(true);
      expect(dbRecord!.meta).toEqual({});
    });

    test("should create bonus boost with optional fields", async () => {
      const expiresAt = new Date("2025-12-31T23:59:59Z");
      const meta = { source: "campaign", campaignId: "test-123" };

      const result = await repository.createBoostBonus({
        userId: testUserId,
        amount: 500n,
        expiresAt,
        createdByAdminId: testAdminId,
        meta,
      });

      expect(result.createdByAdminId).toBe(testAdminId);
      expect(result.meta).toEqual(meta);

      const [dbRecord] = await db
        .select()
        .from(schema.boostBonus)
        .where(eq(schema.boostBonus.id, result.id));

      expect(dbRecord!.createdByAdminId).toBe(testAdminId);
      expect(dbRecord!.meta).toEqual(meta);
    });

    test("should reject zero amount", async () => {
      await expect(
        repository.createBoostBonus({
          userId: testUserId,
          amount: 0n,
          expiresAt: new Date("2025-12-31T23:59:59Z"),
        }),
      ).rejects.toThrow();
    });

    test("should enforce CHECK constraint on negative amount", async () => {
      await expect(
        repository.createBoostBonus({
          userId: testUserId,
          amount: -500n,
          expiresAt: new Date("2025-12-31T23:59:59Z"),
        }),
      ).rejects.toThrow();
    });

    test("should cascade delete when user is deleted", async () => {
      const boost = await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      await db
        .delete(coreSchema.users)
        .where(eq(coreSchema.users.id, testUserId));

      const [dbRecord] = await db
        .select()
        .from(schema.boostBonus)
        .where(eq(schema.boostBonus.id, boost.id));

      expect(dbRecord).toBeUndefined();
    });

    test("should preserve boost when admin is deleted (FK nullable)", async () => {
      const boost = await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
        createdByAdminId: testAdminId,
      });

      await db
        .delete(coreSchema.admins)
        .where(eq(coreSchema.admins.id, testAdminId));

      const [dbRecord] = await db
        .select()
        .from(schema.boostBonus)
        .where(eq(schema.boostBonus.id, boost.id));

      expect(dbRecord).toBeDefined();
      expect(dbRecord!.createdByAdminId).toBeNull();
    });
  });

  describe("updateBoostBonus()", () => {
    let boostId: string;

    beforeEach(async () => {
      const boost = await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
        meta: { source: "initial" },
      });
      boostId = boost.id;
    });

    test("should update expiresAt field", async () => {
      const newExpiresAt = new Date("2026-06-30T23:59:59Z");
      const result = await repository.updateBoostBonus(boostId, {
        expiresAt: newExpiresAt,
      });

      expect(result.expiresAt).toEqual(newExpiresAt);
      expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(
        result.createdAt.getTime(),
      );

      const [dbRecord] = await db
        .select()
        .from(schema.boostBonus)
        .where(eq(schema.boostBonus.id, boostId));

      expect(dbRecord!.expiresAt).toEqual(newExpiresAt);
    });

    test("should update isActive field", async () => {
      const result = await repository.updateBoostBonus(boostId, {
        isActive: false,
      });

      expect(result.isActive).toBe(false);

      const [dbRecord] = await db
        .select()
        .from(schema.boostBonus)
        .where(eq(schema.boostBonus.id, boostId));

      expect(dbRecord!.isActive).toBe(false);
    });

    test("should update revokedAt field", async () => {
      const revokedAt = new Date();
      const result = await repository.updateBoostBonus(boostId, {
        revokedAt,
      });

      expect(result.revokedAt).toEqual(revokedAt);

      const [dbRecord] = await db
        .select()
        .from(schema.boostBonus)
        .where(eq(schema.boostBonus.id, boostId));

      expect(dbRecord!.revokedAt).toEqual(revokedAt);
    });

    test("should update meta field", async () => {
      const newMeta = { source: "updated", reason: "correction" };
      const result = await repository.updateBoostBonus(boostId, {
        meta: newMeta,
      });

      expect(result.meta).toEqual(newMeta);

      const [dbRecord] = await db
        .select()
        .from(schema.boostBonus)
        .where(eq(schema.boostBonus.id, boostId));

      expect(dbRecord!.meta).toEqual(newMeta);
    });

    test("should update multiple fields at once", async () => {
      const newExpiresAt = new Date("2026-06-30T23:59:59Z");
      const revokedAt = new Date();
      const newMeta = { reason: "bulk update" };

      const result = await repository.updateBoostBonus(boostId, {
        expiresAt: newExpiresAt,
        isActive: false,
        revokedAt,
        meta: newMeta,
      });

      expect(result.expiresAt).toEqual(newExpiresAt);
      expect(result.isActive).toBe(false);
      expect(result.revokedAt).toEqual(revokedAt);
      expect(result.meta).toEqual(newMeta);
    });

    test("should always update updatedAt timestamp", async () => {
      const originalUpdatedAt = (await repository.findBoostBonusById(boostId))!
        .updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await repository.updateBoostBonus(boostId, {
        meta: { updated: true },
      });

      expect(result.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
    });

    test("should throw error when boost not found", async () => {
      const nonExistentId = randomUUID();

      await expect(
        repository.updateBoostBonus(nonExistentId, { isActive: false }),
      ).rejects.toThrow(`Bonus boost with id ${nonExistentId} not found`);
    });

    test("should NOT allow updating amount (immutability)", async () => {
      const result = await repository.updateBoostBonus(boostId, {
        meta: { test: true },
      });

      expect(result.amount).toBe(1000n);

      const result2 = await repository.updateBoostBonus(boostId, {
        meta: { updated: true },
      });

      expect(result2.amount).toBe(1000n);
    });
  });

  describe("findBoostBonusById()", () => {
    test("should find existing bonus boost", async () => {
      const created = await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const result = await repository.findBoostBonusById(created.id);

      expect(result).toBeDefined();
      expect(result!.id).toBe(created.id);
      expect(result!.amount).toBe(1000n);
    });

    test("should return undefined for non-existent ID", async () => {
      const nonExistentId = randomUUID();
      const result = await repository.findBoostBonusById(nonExistentId);

      expect(result).toBeUndefined();
    });
  });

  describe("findActiveBoostBonusesByUserId()", () => {
    test("should return only active boosts for user", async () => {
      const active1 = await repository.createBoostBonus({
        userId: testUserId,
        amount: 500n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const active2 = await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date("2026-12-31T23:59:59Z"),
      });

      const inactive = await repository.createBoostBonus({
        userId: testUserId,
        amount: 750n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });
      await repository.updateBoostBonus(inactive.id, { isActive: false });

      const results =
        await repository.findActiveBoostBonusesByUserId(testUserId);

      expect(results).toHaveLength(2);
      const ids = results.map((r) => r.id);
      expect(ids).toContain(active1.id);
      expect(ids).toContain(active2.id);
      expect(ids).not.toContain(inactive.id);
    });

    test("should return empty array when user has no active boosts", async () => {
      const results =
        await repository.findActiveBoostBonusesByUserId(testUserId);

      expect(results).toHaveLength(0);
    });

    test("should order results by createdAt DESC", async () => {
      const first = await repository.createBoostBonus({
        userId: testUserId,
        amount: 500n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const second = await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const results =
        await repository.findActiveBoostBonusesByUserId(testUserId);

      expect(results[0]!.id).toBe(second.id);
      expect(results[1]!.id).toBe(first.id);
    });

    test("should not return boosts from other users", async () => {
      const otherUserId = randomUUID();
      const otherWallet = `0x${randomUUID().replace(/-/g, "").substring(0, 40).padEnd(40, "0")}`;
      await db.insert(coreSchema.users).values({
        id: otherUserId,
        walletAddress: otherWallet,
        name: "Other User",
        status: "active",
      });

      await repository.createBoostBonus({
        userId: otherUserId,
        amount: 500n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const testUserBoost = await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const results =
        await repository.findActiveBoostBonusesByUserId(testUserId);

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe(testUserBoost.id);

      await db
        .delete(coreSchema.users)
        .where(eq(coreSchema.users.id, otherUserId));
    });
  });

  describe("findAllActiveBoostBonuses()", () => {
    test("should return all active boosts across all users", async () => {
      const boost1 = await repository.createBoostBonus({
        userId: testUserId,
        amount: 500n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const otherUserId = randomUUID();
      const otherWallet = `0x${randomUUID().replace(/-/g, "").substring(0, 40).padEnd(40, "0")}`;
      await db.insert(coreSchema.users).values({
        id: otherUserId,
        walletAddress: otherWallet,
        name: "Other User",
        status: "active",
      });

      const boost2 = await repository.createBoostBonus({
        userId: otherUserId,
        amount: 1000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      // Create inactive boost
      const inactive = await repository.createBoostBonus({
        userId: testUserId,
        amount: 750n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });
      await repository.updateBoostBonus(inactive.id, { isActive: false });

      const results = await repository.findAllActiveBoostBonuses();

      expect(results.length).toBeGreaterThanOrEqual(2);
      const ids = results.map((r) => r.id);
      expect(ids).toContain(boost1.id);
      expect(ids).toContain(boost2.id);
      expect(ids).not.toContain(inactive.id);

      await db
        .delete(coreSchema.users)
        .where(eq(coreSchema.users.id, otherUserId));
    });

    test("should return empty array when no active boosts exist", async () => {
      const results = await repository.findAllActiveBoostBonuses();

      expect(results).toHaveLength(0);
    });

    test("should order results by createdAt DESC", async () => {
      const first = await repository.createBoostBonus({
        userId: testUserId,
        amount: 500n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const second = await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const results = await repository.findAllActiveBoostBonuses();

      expect(results[0]!.id).toBe(second.id);
      expect(results[1]!.id).toBe(first.id);
    });
  });

  describe("findUsersWithActiveBoostBonuses()", () => {
    test("should return boosts expiring after given date", async () => {
      const cutoffDate = new Date("2025-06-01T00:00:00Z");

      const expiredBoost = await repository.createBoostBonus({
        userId: testUserId,
        amount: 500n,
        expiresAt: new Date("2025-05-31T23:59:59Z"),
      });

      const validBoost = await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const results =
        await repository.findUsersWithActiveBoostBonuses(cutoffDate);

      const ids = results.map((r) => r.id);
      expect(ids).toContain(validBoost.id);
      expect(ids).not.toContain(expiredBoost.id);
    });

    test("should exclude inactive boosts", async () => {
      const cutoffDate = new Date("2025-06-01T00:00:00Z");

      const activeBoost = await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const inactiveBoost = await repository.createBoostBonus({
        userId: testUserId,
        amount: 500n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });
      await repository.updateBoostBonus(inactiveBoost.id, { isActive: false });

      const results =
        await repository.findUsersWithActiveBoostBonuses(cutoffDate);

      const ids = results.map((r) => r.id);
      expect(ids).toContain(activeBoost.id);
      expect(ids).not.toContain(inactiveBoost.id);
    });

    test("should handle boundary condition (expires exactly at cutoff)", async () => {
      const cutoffDate = new Date("2025-12-31T23:59:59Z");

      const exactBoost = await repository.createBoostBonus({
        userId: testUserId,
        amount: 500n,
        expiresAt: cutoffDate,
      });

      const afterBoost = await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date(cutoffDate.getTime() + 1),
      });

      const results =
        await repository.findUsersWithActiveBoostBonuses(cutoffDate);

      const ids = results.map((r) => r.id);
      expect(ids).not.toContain(exactBoost.id);
      expect(ids).toContain(afterBoost.id);
    });

    test("should return empty array when no eligible boosts", async () => {
      const cutoffDate = new Date("2026-12-31T23:59:59Z");

      await repository.createBoostBonus({
        userId: testUserId,
        amount: 500n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const results =
        await repository.findUsersWithActiveBoostBonuses(cutoffDate);

      expect(results).toHaveLength(0);
    });
  });

  describe("findBoostBonusesByIds()", () => {
    test("should return multiple boosts by IDs", async () => {
      const boost1 = await repository.createBoostBonus({
        userId: testUserId,
        amount: 500n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const boost2 = await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const boost3 = await repository.createBoostBonus({
        userId: testUserId,
        amount: 750n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const results = await repository.findBoostBonusesByIds([
        boost1.id,
        boost3.id,
      ]);

      expect(results).toHaveLength(2);
      const ids = results.map((r) => r.id);
      expect(ids).toContain(boost1.id);
      expect(ids).toContain(boost3.id);
      expect(ids).not.toContain(boost2.id);
    });

    test("should return empty array when given empty array", async () => {
      const results = await repository.findBoostBonusesByIds([]);

      expect(results).toHaveLength(0);
    });

    test("should return only found boosts when some IDs do not exist", async () => {
      const boost = await repository.createBoostBonus({
        userId: testUserId,
        amount: 500n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const nonExistentId1 = randomUUID();
      const nonExistentId2 = randomUUID();

      const results = await repository.findBoostBonusesByIds([
        boost.id,
        nonExistentId1,
        nonExistentId2,
      ]);

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe(boost.id);
    });

    test("should return empty array when all IDs do not exist", async () => {
      const nonExistentId1 = randomUUID();
      const nonExistentId2 = randomUUID();

      const results = await repository.findBoostBonusesByIds([
        nonExistentId1,
        nonExistentId2,
      ]);

      expect(results).toHaveLength(0);
    });

    test("should return both active and inactive boosts", async () => {
      const active = await repository.createBoostBonus({
        userId: testUserId,
        amount: 500n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const inactive = await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });
      await repository.updateBoostBonus(inactive.id, { isActive: false });

      const results = await repository.findBoostBonusesByIds([
        active.id,
        inactive.id,
      ]);

      expect(results).toHaveLength(2);
      const activeResult = results.find((r) => r.id === active.id);
      const inactiveResult = results.find((r) => r.id === inactive.id);

      expect(activeResult!.isActive).toBe(true);
      expect(inactiveResult!.isActive).toBe(false);
    });
  });

  describe("sumActiveBoostBonusesForUser()", () => {
    test("should sum multiple active boosts", async () => {
      await repository.createBoostBonus({
        userId: testUserId,
        amount: 500n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      await repository.createBoostBonus({
        userId: testUserId,
        amount: 250n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const result = await repository.sumActiveBoostBonusesForUser(testUserId);

      expect(result).toBe(1750n);
    });

    test("should return 0n when no active boosts exist", async () => {
      const result = await repository.sumActiveBoostBonusesForUser(testUserId);

      expect(result).toBe(0n);
    });

    test("should exclude inactive boosts from sum", async () => {
      await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      // Create inactive boost
      const inactive = await repository.createBoostBonus({
        userId: testUserId,
        amount: 5000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });
      await repository.updateBoostBonus(inactive.id, { isActive: false });

      const result = await repository.sumActiveBoostBonusesForUser(testUserId);

      expect(result).toBe(1000n);
    });

    test("should return 0n when all boosts are inactive", async () => {
      const boost = await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });
      await repository.updateBoostBonus(boost.id, { isActive: false });

      const result = await repository.sumActiveBoostBonusesForUser(testUserId);

      expect(result).toBe(0n);
    });

    test("should handle large amounts correctly", async () => {
      const largeAmount = BigInt("999999999999999999999999999999"); // 30 digits

      await repository.createBoostBonus({
        userId: testUserId,
        amount: largeAmount,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      await repository.createBoostBonus({
        userId: testUserId,
        amount: largeAmount,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const result = await repository.sumActiveBoostBonusesForUser(testUserId);

      expect(result).toBe(largeAmount * 2n);
    });
  });

  describe("findBoostChangesByBoostBonusId()", () => {
    test("should find boost_changes entries for a specific bonus boost", async () => {
      const boost = await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId,
        amount: 1000n,
        meta: { description: `bonus-${boost.id}` },
      });

      const balanceRecord = await db
        .select()
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, testUserId),
            eq(schema.boostBalances.competitionId, testCompetitionId),
          ),
        )
        .limit(1);

      await db
        .update(schema.boostChanges)
        .set({ meta: { boostBonusId: boost.id } })
        .where(eq(schema.boostChanges.balanceId, balanceRecord[0]!.id));

      const results = await repository.findBoostChangesByBoostBonusId(boost.id);

      expect(results).toHaveLength(1);
      expect(results[0]!.competitionId).toBe(testCompetitionId);
      expect(results[0]!.balanceId).toBeDefined();
      expect(results[0]!.id).toBeDefined();
    });

    test("should return empty array when no changes exist", async () => {
      const boost = await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const results = await repository.findBoostChangesByBoostBonusId(boost.id);

      expect(results).toHaveLength(0);
    });

    test("should find changes across multiple competitions", async () => {
      const boost = await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const competition2Id = randomUUID();
      await db.insert(coreSchema.competitions).values({
        id: competition2Id,
        name: "Test Competition 2",
        description: "Second test competition",
        status: "pending",
      });

      const increase1 = await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId,
        amount: 500n,
      });

      const increase2 = await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: competition2Id,
        amount: 500n,
      });

      if (increase1.type === "applied") {
        await db
          .update(schema.boostChanges)
          .set({ meta: { boostBonusId: boost.id } })
          .where(eq(schema.boostChanges.id, increase1.changeId));
      }
      if (increase2.type === "applied") {
        await db
          .update(schema.boostChanges)
          .set({ meta: { boostBonusId: boost.id } })
          .where(eq(schema.boostChanges.id, increase2.changeId));
      }

      const results = await repository.findBoostChangesByBoostBonusId(boost.id);

      expect(results).toHaveLength(2);
      const competitionIds = results.map((r) => r.competitionId);
      expect(competitionIds).toContain(testCompetitionId);
      expect(competitionIds).toContain(competition2Id);

      const balance2 = await db
        .select()
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, testUserId),
            eq(schema.boostBalances.competitionId, competition2Id),
          ),
        )
        .limit(1);
      if (balance2[0]) {
        await db
          .delete(schema.boostChanges)
          .where(eq(schema.boostChanges.balanceId, balance2[0].id));
      }

      await db
        .delete(coreSchema.competitions)
        .where(eq(coreSchema.competitions.id, competition2Id));
    });

    test("should not return changes without boostBonusId in meta", async () => {
      const boost = await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId,
        amount: 1000n,
        meta: { description: "stake boost" },
      });

      const results = await repository.findBoostChangesByBoostBonusId(boost.id);

      expect(results).toHaveLength(0);
    });
  });

  describe("findBoostChangesByCompetitionId()", () => {
    test("should find boost_changes entries for a specific competition", async () => {
      const boost = await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const increase = await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId,
        amount: 1000n,
      });

      if (increase.type === "applied") {
        await db
          .update(schema.boostChanges)
          .set({ meta: { boostBonusId: boost.id } })
          .where(eq(schema.boostChanges.id, increase.changeId));
      }

      const results =
        await repository.findBoostChangesByCompetitionId(testCompetitionId);

      expect(results).toHaveLength(1);
      expect(results[0]!.balanceId).toBeDefined();
      expect(results[0]!.id).toBeDefined();
      expect(results[0]!.meta).toHaveProperty("boostBonusId", boost.id);
    });

    test("should return empty array when no bonus boost changes exist", async () => {
      await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId,
        amount: 1000n,
        meta: { description: "stake boost" },
      });

      const results =
        await repository.findBoostChangesByCompetitionId(testCompetitionId);

      expect(results).toHaveLength(0);
    });

    test("should find multiple bonus boost changes for same competition", async () => {
      const boost1 = await repository.createBoostBonus({
        userId: testUserId,
        amount: 500n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const boost2 = await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const increase1 = await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId,
        amount: 500n,
      });

      const increase2 = await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: testCompetitionId,
        amount: 1000n,
      });

      if (increase1.type === "applied") {
        await db
          .update(schema.boostChanges)
          .set({ meta: { boostBonusId: boost1.id } })
          .where(eq(schema.boostChanges.id, increase1.changeId));
      }
      if (increase2.type === "applied") {
        await db
          .update(schema.boostChanges)
          .set({ meta: { boostBonusId: boost2.id } })
          .where(eq(schema.boostChanges.id, increase2.changeId));
      }

      const results =
        await repository.findBoostChangesByCompetitionId(testCompetitionId);

      expect(results).toHaveLength(2);
      const boostBonusIds = results.map((r) => r.meta.boostBonusId);
      expect(boostBonusIds).toContain(boost1.id);
      expect(boostBonusIds).toContain(boost2.id);
    });

    test("should not return changes from other competitions", async () => {
      const boost = await repository.createBoostBonus({
        userId: testUserId,
        amount: 1000n,
        expiresAt: new Date("2025-12-31T23:59:59Z"),
      });

      const competition2Id = randomUUID();
      await db.insert(coreSchema.competitions).values({
        id: competition2Id,
        name: "Test Competition 2",
        description: "Second test competition",
        status: "pending",
      });

      const increase = await repository.increase({
        userId: testUserId,
        wallet: testWallet,
        competitionId: competition2Id,
        amount: 1000n,
      });

      if (increase.type === "applied") {
        await db
          .update(schema.boostChanges)
          .set({ meta: { boostBonusId: boost.id } })
          .where(eq(schema.boostChanges.id, increase.changeId));
      }

      const results =
        await repository.findBoostChangesByCompetitionId(testCompetitionId);

      expect(results).toHaveLength(0);

      const balance2 = await db
        .select()
        .from(schema.boostBalances)
        .where(
          and(
            eq(schema.boostBalances.userId, testUserId),
            eq(schema.boostBalances.competitionId, competition2Id),
          ),
        )
        .limit(1);
      if (balance2[0]) {
        await db
          .delete(schema.boostChanges)
          .where(eq(schema.boostChanges.balanceId, balance2[0].id));
      }

      await db
        .delete(coreSchema.competitions)
        .where(eq(coreSchema.competitions.id, competition2Id));
    });
  });
});
