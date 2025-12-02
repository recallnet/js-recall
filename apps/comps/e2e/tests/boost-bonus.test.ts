import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { BoostRepository } from "@recallnet/db/repositories/boost";
import {
  boostBalances,
  boostBonus,
  boostChanges,
} from "@recallnet/db/schema/boost/defs";
import {
  createTestClient,
  createTestCompetition,
  generateRandomEthAddress,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
} from "@recallnet/test-utils";

import { db } from "@/lib/db";

const createActiveCompWithOpenWindow = (
  adminClient: ReturnType<typeof createTestClient>,
  name = "Active Open Window",
  baseTime?: Date,
) => {
  const now = baseTime ? baseTime.getTime() : Date.now();
  return createTestCompetition({
    adminClient,
    name,
    boostStartDate: new Date(now - 5000).toISOString(),
    boostEndDate: new Date(now + 100000).toISOString(),
    startDate: new Date(now - 10000).toISOString(),
    endDate: new Date(now + 200000).toISOString(),
  });
};

const createPendingCompEligible = (
  adminClient: ReturnType<typeof createTestClient>,
  name = "Pending Eligible",
  baseTime?: Date,
) => {
  const now = baseTime ? baseTime.getTime() : Date.now();
  return createTestCompetition({
    adminClient,
    name,
    boostStartDate: new Date(now + 1000).toISOString(),
    boostEndDate: new Date(now + 100000).toISOString(),
    startDate: new Date(now + 2000).toISOString(),
    endDate: new Date(now + 200000).toISOString(),
  });
};

const createCompWindowClosed = (
  adminClient: ReturnType<typeof createTestClient>,
  name = "Window Closed",
  baseTime?: Date,
) => {
  const now = baseTime ? baseTime.getTime() : Date.now();
  return createTestCompetition({
    adminClient,
    name,
    boostStartDate: new Date(now - 10000).toISOString(),
    boostEndDate: new Date(now - 1000).toISOString(),
    startDate: new Date(now + 1000).toISOString(),
    endDate: new Date(now + 100000).toISOString(),
  });
};

const createCompNoBoostDates = (
  adminClient: ReturnType<typeof createTestClient>,
  name = "No Boost Dates",
) => createTestCompetition({ adminClient, name });

const getBoostBalance = (userId: string, competitionId: string) =>
  db
    .select()
    .from(boostBalances)
    .where(
      and(
        eq(boostBalances.userId, userId),
        eq(boostBalances.competitionId, competitionId),
      ),
    );

const getUserBoosts = (userId: string) =>
  db.select().from(boostBonus).where(eq(boostBonus.userId, userId));

describe("Bonus Boosts E2E", () => {
  let adminApiKey: string;
  let adminClient: ReturnType<typeof createTestClient>;

  beforeEach(async () => {
    adminApiKey = await getAdminApiKey();
    adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);
  });

  describe("POST /api/admin/boost-bonus", () => {
    test("rejects request from non-admin user", async () => {
      // Setup: Register a regular user (non-admin)
      const { user, client: userClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          walletAddress: generateRandomEthAddress(),
        });

      const expiresAt = new Date(Date.now() + 300000).toISOString();

      // Attempt to add bonus boost as regular user (should fail)
      const response = await userClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "1000000000000000000",
            expiresAt,
          },
        ],
      });

      expect(response.success).toBe(false);
      if (response.success) throw new Error("Should have failed");

      // Verify no boosts were created
      const boosts = await getUserBoosts(user.id);
      expect(boosts).toHaveLength(0);
    });

    test("rejects unauthenticated request", async () => {
      // Create a client without admin credentials
      const unauthenticatedClient = createTestClient();

      const { user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        walletAddress: generateRandomEthAddress(),
      });

      const expiresAt = new Date(Date.now() + 300000).toISOString();

      // Attempt to add bonus boost without authentication (should fail)
      const response = await unauthenticatedClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "1000000000000000000",
            expiresAt,
          },
        ],
      });

      expect(response.success).toBe(false);
      if (response.success) throw new Error("Should have failed");

      // Verify no boosts were created
      const boosts = await getUserBoosts(user.id);
      expect(boosts).toHaveLength(0);
    });

    test("adds batch of boosts and applies to eligible competitions", async () => {
      // Setup: Register 2 users
      const { user: user1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        walletAddress: generateRandomEthAddress(),
      });
      const { user: user2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        walletAddress: generateRandomEthAddress(),
      });

      // Create competitions with different states
      const compA = await createActiveCompWithOpenWindow(
        adminClient,
        "Comp A - Active Open",
      );
      const compB = await createPendingCompEligible(
        adminClient,
        "Comp B - Pending Eligible",
      );
      const compC = await createCompWindowClosed(
        adminClient,
        "Comp C - Window Closed",
      );

      const expiresAt = new Date(Date.now() + 300000).toISOString();
      const response = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user1.walletAddress,
            amount: "500000000000000000",
            expiresAt,
            meta: { source: "test", campaign: "batch-1" },
          },
          {
            wallet: user2.walletAddress,
            amount: "750000000000000000",
            expiresAt,
          },
        ],
      });

      expect(response.success).toBe(true);
      if (!response.success) throw new Error("Response should be successful");

      expect(response.data.results).toHaveLength(2);

      const [result1, result2] = response.data.results;

      expect(result1).toBeDefined();
      expect(result1!.userId).toBe(user1.id);
      expect(result1!.amount).toBe("500000000000000000");
      expect(result1!.isActive).toBe(true);

      // Should apply to active and pending competitions, but not closed window
      const appliedCompIds = result1!.appliedToCompetitions || [];
      expect(appliedCompIds).toContain(compA.competition.id);
      expect(appliedCompIds).toContain(compB.competition.id);
      expect(appliedCompIds).not.toContain(compC.competition.id);

      expect(result2).toBeDefined();
      expect(result2!.userId).toBe(user2.id);
      expect(result2!.amount).toBe("750000000000000000");

      // Verify boost record created with metadata
      const bonusBoosts = await getUserBoosts(user1.id);

      expect(bonusBoosts).toHaveLength(1);
      expect(bonusBoosts[0]!.amount).toBe(500000000000000000n);
      expect(bonusBoosts[0]!.isActive).toBe(true);
      expect(bonusBoosts[0]!.meta).toEqual({
        source: "test",
        campaign: "batch-1",
      });

      // Verify balances updated for eligible competitions only
      const balanceA = await getBoostBalance(user1.id, compA.competition.id);
      expect(balanceA).toHaveLength(1);
      expect(balanceA[0]!.balance).toBe(500000000000000000n);

      const balanceB = await db
        .select()
        .from(boostBalances)
        .where(
          and(
            eq(boostBalances.userId, user1.id),
            eq(boostBalances.competitionId, compB.competition.id),
          ),
        );
      expect(balanceB).toHaveLength(1);
      expect(balanceB[0]!.balance).toBe(500000000000000000n);

      const balanceC = await db
        .select()
        .from(boostBalances)
        .where(
          and(
            eq(boostBalances.userId, user1.id),
            eq(boostBalances.competitionId, compC.competition.id),
          ),
        );
      expect(balanceC).toHaveLength(0);

      const changesA = await db
        .select()
        .from(boostChanges)
        .where(eq(boostChanges.balanceId, balanceA[0]!.id));
      expect(changesA).toHaveLength(1);
      expect(changesA[0]!.deltaAmount).toBe(500000000000000000n);
      expect(changesA[0]!.meta).toHaveProperty("boostBonusId");
    });

    test("rejects invalid batch data", async () => {
      const { user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        walletAddress: generateRandomEthAddress(),
      });

      const validExpiration = new Date(Date.now() + 100000).toISOString();

      // Test: Empty array should be rejected
      const emptyResponse = await adminClient.addBonusBoosts({ boosts: [] });
      expect(emptyResponse.success).toBe(false);
      if (emptyResponse.success) throw new Error("Should have failed");

      expect(emptyResponse.error).toContain("at least one");

      // Test: Exceeding max batch size (100) should be rejected
      const largeArray = Array.from({ length: 101 }, () => ({
        wallet: user.walletAddress,
        amount: "1000000000000000000",
        expiresAt: validExpiration,
      }));
      const largeResponse = await adminClient.addBonusBoosts({
        boosts: largeArray,
      });
      expect(largeResponse.success).toBe(false);
      if (largeResponse.success) throw new Error("Should have failed");

      expect(largeResponse.error).toContain("more than 100");

      // Test: Past expiration date should be rejected
      const pastResponse = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "1000000000000000000",
            expiresAt: new Date(Date.now() - 1000).toISOString(),
          },
        ],
      });
      expect(pastResponse.success).toBe(false);
      if (pastResponse.success) throw new Error("Should have failed");

      expect(pastResponse.error).toContain("future");

      // Test: Expiration too soon (< 60 seconds minimum) should be rejected
      const soonResponse = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "1000000000000000000",
            expiresAt: new Date(Date.now() + 30000).toISOString(),
          },
        ],
      });
      expect(soonResponse.success).toBe(false);
      if (soonResponse.success) throw new Error("Should have failed");

      expect(soonResponse.error).toContain("future");

      // Test: Wallet not found should be rejected
      const notFoundResponse = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: generateRandomEthAddress(),
            amount: "1000000000000000000",
            expiresAt: validExpiration,
          },
        ],
      });
      expect(notFoundResponse.success).toBe(false);
      if (notFoundResponse.success) throw new Error("Should have failed");

      expect(notFoundResponse.error).toContain("validation failed");

      // Test: Invalid wallet format should be rejected
      const invalidWalletResponse = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: "invalid-wallet",
            amount: "1000000000000000000",
            expiresAt: validExpiration,
          },
        ],
      });
      expect(invalidWalletResponse.success).toBe(false);
      if (invalidWalletResponse.success) throw new Error("Should have failed");

      expect(invalidWalletResponse.error).toContain("wallet");

      // Test: Zero amount should be rejected
      const zeroResponse = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "0",
            expiresAt: validExpiration,
          },
        ],
      });
      expect(zeroResponse.success).toBe(false);
      if (zeroResponse.success) throw new Error("Should have failed");

      expect(zeroResponse.error).toContain("positive");

      // Test: Amount exceeding maximum (1 token = 10^18) should be rejected
      const largeAmountResponse = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "1000000000000000001",
            expiresAt: validExpiration,
          },
        ],
      });
      expect(largeAmountResponse.success).toBe(false);
      if (largeAmountResponse.success) throw new Error("Should have failed");

      expect(largeAmountResponse.error).toContain("maximum");

      // Test: Non-numeric amount should be rejected
      const invalidAmountResponse = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "not-a-number",
            expiresAt: validExpiration,
          },
        ],
      });
      expect(invalidAmountResponse.success).toBe(false);

      // Test: Meta exceeding 1000 characters should be rejected
      const largeMeta = "x".repeat(1001);
      const largeMetaResponse = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "1000000000000000000",
            expiresAt: validExpiration,
            meta: { data: largeMeta },
          },
        ],
      });
      expect(largeMetaResponse.success).toBe(false);
      if (largeMetaResponse.success) throw new Error("Should have failed");

      expect(largeMetaResponse.error).toContain("1000");
    });

    test("rejects batch with duplicate wallet addresses", async () => {
      // One wallet per batch - prevents accidental duplicate grants
      const { user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        walletAddress: generateRandomEthAddress(),
      });

      const expiresAt = new Date(Date.now() + 100000).toISOString();

      const response = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "500000000000000000",
            expiresAt,
          },
          {
            wallet: user.walletAddress,
            amount: "1000000000000000000",
            expiresAt,
          },
        ],
      });

      expect(response.success).toBe(false);
      if (response.success) throw new Error("Should have failed");

      expect(response.error).toContain("duplicate");

      // Verify no boosts were created (transaction rolled back)
      const boosts = await db
        .select()
        .from(boostBonus)
        .where(eq(boostBonus.userId, user.id));
      expect(boosts).toHaveLength(0);
    });

    test("rejects amount exceeding maximum limit", async () => {
      const { user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        walletAddress: generateRandomEthAddress(),
      });

      const validExpiration = new Date(Date.now() + 300000).toISOString();

      const response = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "1000000000000000001",
            expiresAt: validExpiration,
          },
        ],
      });

      expect(response.success).toBe(false);
      if (response.success) throw new Error("Should have failed");

      expect(response.error).toContain("maximum");

      const boosts = await db
        .select()
        .from(boostBonus)
        .where(eq(boostBonus.userId, user.id));
      expect(boosts).toHaveLength(0);
    });

    test("applies boosts only to eligible competitions", async () => {
      // Test eligibility rules: boost start must be before boost expiration
      const { user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        walletAddress: generateRandomEthAddress(),
      });

      const boostExpires = new Date(Date.now() + 300000);

      // Eligible: Active competition
      const comp1 = await createActiveCompWithOpenWindow(adminClient, "Comp 1");

      // Eligible: Pending competition
      const comp2 = await createPendingCompEligible(adminClient, "Comp 2");

      // Ineligible: Competition starts after boost expires
      const comp3 = await createTestCompetition({
        adminClient,
        name: "Comp 3 - Starts After Expiry",
        boostStartDate: new Date(boostExpires.getTime() + 10000).toISOString(),
        boostEndDate: new Date(boostExpires.getTime() + 100000).toISOString(),
      });

      // Ineligible: Window already closed
      const comp4 = await createCompWindowClosed(adminClient, "Comp 4");

      // Ineligible: No boost dates set
      const comp5 = await createCompNoBoostDates(adminClient, "Comp 5");

      // Ineligible: Starts exactly at expiration (not before)
      const comp6 = await createTestCompetition({
        adminClient,
        name: "Comp 6 - Starts At Expiry",
        boostStartDate: boostExpires.toISOString(),
        boostEndDate: new Date(boostExpires.getTime() + 100000).toISOString(),
      });

      const response = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "1000000000000000000",
            expiresAt: boostExpires.toISOString(),
          },
        ],
      });

      expect(response.success).toBe(true);

      // Verify comp1 and comp2 have balances
      const balance1 = await db
        .select()
        .from(boostBalances)
        .where(
          and(
            eq(boostBalances.userId, user.id),
            eq(boostBalances.competitionId, comp1.competition.id),
          ),
        );
      expect(balance1).toHaveLength(1);

      const balance2 = await db
        .select()
        .from(boostBalances)
        .where(
          and(
            eq(boostBalances.userId, user.id),
            eq(boostBalances.competitionId, comp2.competition.id),
          ),
        );
      expect(balance2).toHaveLength(1);

      // Verify comp3, comp4, comp5, comp6 have no balances
      const balance3 = await db
        .select()
        .from(boostBalances)
        .where(
          and(
            eq(boostBalances.userId, user.id),
            eq(boostBalances.competitionId, comp3.competition.id),
          ),
        );
      expect(balance3).toHaveLength(0);

      const balance4 = await db
        .select()
        .from(boostBalances)
        .where(
          and(
            eq(boostBalances.userId, user.id),
            eq(boostBalances.competitionId, comp4.competition.id),
          ),
        );
      expect(balance4).toHaveLength(0);

      const balance5 = await db
        .select()
        .from(boostBalances)
        .where(
          and(
            eq(boostBalances.userId, user.id),
            eq(boostBalances.competitionId, comp5.competition.id),
          ),
        );
      expect(balance5).toHaveLength(0);

      const balance6 = await db
        .select()
        .from(boostBalances)
        .where(
          and(
            eq(boostBalances.userId, user.id),
            eq(boostBalances.competitionId, comp6.competition.id),
          ),
        );
      expect(balance6).toHaveLength(0);
    });

    test("does not apply boosts to completed competitions", async () => {
      // Boosts should only be applied to active or pending competitions
      const { user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        walletAddress: generateRandomEthAddress(),
      });

      const boostExpires = new Date(Date.now() + 300000);

      // Create competitions with different statuses
      // Eligible: Active competition
      const activeComp = await createActiveCompWithOpenWindow(
        adminClient,
        "Active Comp",
      );

      // Eligible: Pending competition
      const pendingComp = await createPendingCompEligible(
        adminClient,
        "Pending Comp",
      );

      // Ineligible: Completed competition (ended in the past)
      const now = Date.now();
      const completedComp = await createTestCompetition({
        adminClient,
        name: "Completed Comp",
        boostStartDate: new Date(now - 100000).toISOString(),
        boostEndDate: new Date(now - 50000).toISOString(),
        startDate: new Date(now - 150000).toISOString(),
        endDate: new Date(now - 10000).toISOString(),
      });

      // Award boost
      const response = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "1000000000000000000",
            expiresAt: boostExpires.toISOString(),
          },
        ],
      });

      expect(response.success).toBe(true);
      if (!response.success) throw new Error("Should have succeeded");

      // Verify boost was applied to active and pending competitions
      const activeBalance = await db
        .select()
        .from(boostBalances)
        .where(
          and(
            eq(boostBalances.userId, user.id),
            eq(boostBalances.competitionId, activeComp.competition.id),
          ),
        );
      expect(activeBalance).toHaveLength(1);
      expect(activeBalance[0]!.balance).toBe(1000000000000000000n);

      const pendingBalance = await db
        .select()
        .from(boostBalances)
        .where(
          and(
            eq(boostBalances.userId, user.id),
            eq(boostBalances.competitionId, pendingComp.competition.id),
          ),
        );
      expect(pendingBalance).toHaveLength(1);
      expect(pendingBalance[0]!.balance).toBe(1000000000000000000n);

      // Verify boost was NOT applied to completed competition
      const completedBalance = await db
        .select()
        .from(boostBalances)
        .where(
          and(
            eq(boostBalances.userId, user.id),
            eq(boostBalances.competitionId, completedComp.competition.id),
          ),
        );
      expect(completedBalance).toHaveLength(0);

      // Verify response shows boost was applied to exactly 2 competitions
      const result = response.data.results[0];
      expect(result).toBeDefined();
      const appliedCompIds = result!.appliedToCompetitions || [];
      expect(appliedCompIds).toHaveLength(2);
      expect(appliedCompIds).toContain(activeComp.competition.id);
      expect(appliedCompIds).toContain(pendingComp.competition.id);
      expect(appliedCompIds).not.toContain(completedComp.competition.id);
    });

    test("sums multiple boosts for same user (across separate API calls)", async () => {
      // Users can receive multiple boosts - each creates separate record, balance is sum
      const { user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        walletAddress: generateRandomEthAddress(),
      });

      const comp = await createActiveCompWithOpenWindow(
        adminClient,
        "Test Comp",
      );
      const expiresAt = new Date(Date.now() + 300000).toISOString();
      const response1 = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "500000000000000000",
            expiresAt,
          },
        ],
      });

      expect(response1.success).toBe(true);
      if (!response1.success) throw new Error("Should have succeeded");

      const boost1Id = response1.data.results[0]!.id;
      const response2 = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "1000000000000000000",
            expiresAt,
          },
        ],
      });

      expect(response2.success).toBe(true);
      if (!response2.success) throw new Error("Should have succeeded");

      const boost2Id = response2.data.results[0]!.id;
      const boosts = await db
        .select()
        .from(boostBonus)
        .where(eq(boostBonus.userId, user.id));

      expect(boosts).toHaveLength(2);
      expect(boosts[0]?.id).not.toBe(boosts[1]?.id);
      expect(boosts.map((b) => b.id).sort()).toEqual(
        [boost1Id, boost2Id].sort(),
      );

      // Balance should be sum: 0.5 + 1.0 = 1.5 tokens
      const balance = await db
        .select()
        .from(boostBalances)
        .where(
          and(
            eq(boostBalances.userId, user.id),
            eq(boostBalances.competitionId, comp.competition.id),
          ),
        );

      expect(balance).toHaveLength(1);
      expect(balance[0]?.balance.toString()).toBe("1500000000000000000");

      // Two separate boost_changes entries (one per boost grant)
      const changes = await db
        .select()
        .from(boostChanges)
        .where(eq(boostChanges.balanceId, balance[0]!.id));

      expect(changes).toHaveLength(2);
    });

    test("handles mixed valid and invalid items in batch", async () => {
      // All-or-nothing: entire batch fails if any item is invalid
      const { user: user1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        walletAddress: generateRandomEthAddress(),
      });

      const user2Wallet = generateRandomEthAddress();
      const expiresAt = new Date(Date.now() + 300000).toISOString();
      const response = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user1.walletAddress,
            amount: "500000000000000000",
            expiresAt,
          },
          {
            wallet: user2Wallet,
            amount: "1000000000000000000",
            expiresAt,
          },
          {
            wallet: user1.walletAddress,
            amount: "-500000000000000000",
            expiresAt,
          },
        ],
      });

      expect(response.success).toBe(false);
      if (response.success) throw new Error("Should have failed");

      expect(response.error).toBeDefined();

      // No boosts should be created (transaction rolled back)
      const boostsForUser1 = await db
        .select()
        .from(boostBonus)
        .where(eq(boostBonus.userId, user1.id));

      expect(boostsForUser1).toHaveLength(0);
      const balances = await db
        .select()
        .from(boostBalances)
        .where(eq(boostBalances.userId, user1.id));

      expect(balances).toHaveLength(0);
    });
  });

  describe("POST /api/admin/boost-bonus/revoke", () => {
    test("rejects request from non-admin user", async () => {
      // Setup: Create a boost as admin first
      const { user, client: userClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          walletAddress: generateRandomEthAddress(),
        });

      const expiresAt = new Date(Date.now() + 300000).toISOString();

      // Admin adds a boost
      const addResponse = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "1000000000000000000",
            expiresAt,
          },
        ],
      });

      expect(addResponse.success).toBe(true);
      if (!addResponse.success) throw new Error("Should have succeeded");

      const boostId = addResponse.data.results[0]!.id;

      // Attempt to revoke as regular user (should fail)
      const revokeResponse = await userClient.revokeBonusBoosts({
        boostIds: [boostId],
      });

      expect(revokeResponse.success).toBe(false);
      if (revokeResponse.success) throw new Error("Should have failed");

      // Verify boost is still active
      const boosts = await getUserBoosts(user.id);
      expect(boosts).toHaveLength(1);
      expect(boosts[0]!.isActive).toBe(true);
      expect(boosts[0]!.revokedAt).toBeNull();
    });

    test("rejects unauthenticated request", async () => {
      // Setup: Create a boost as admin first
      const { user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        walletAddress: generateRandomEthAddress(),
      });

      const expiresAt = new Date(Date.now() + 300000).toISOString();

      // Admin adds a boost
      const addResponse = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "1000000000000000000",
            expiresAt,
          },
        ],
      });

      expect(addResponse.success).toBe(true);
      if (!addResponse.success) throw new Error("Should have succeeded");

      const boostId = addResponse.data.results[0]!.id;

      // Create unauthenticated client
      const unauthenticatedClient = createTestClient();

      // Attempt to revoke without authentication (should fail)
      const revokeResponse = await unauthenticatedClient.revokeBonusBoosts({
        boostIds: [boostId],
      });

      expect(revokeResponse.success).toBe(false);
      if (revokeResponse.success) throw new Error("Should have failed");

      // Verify boost is still active
      const boosts = await getUserBoosts(user.id);
      expect(boosts).toHaveLength(1);
      expect(boosts[0]!.isActive).toBe(true);
      expect(boosts[0]!.revokedAt).toBeNull();
    });

    test("revokes batch of boosts with different competition states", async () => {
      const { user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        walletAddress: generateRandomEthAddress(),
      });

      // Comp A: Pending (safe to remove), Comp B: Active (keep - might be spent), Comp C: No boost dates
      const compA = await createPendingCompEligible(adminClient, "Comp A");
      const compB = await createActiveCompWithOpenWindow(adminClient, "Comp B");
      await createCompNoBoostDates(adminClient, "Comp C");
      const expiresAt = new Date(Date.now() + 300000).toISOString();
      const addResponse1 = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "600000000000000000",
            expiresAt,
          },
        ],
      });
      const addResponse2 = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "400000000000000000",
            expiresAt,
          },
        ],
      });

      expect(addResponse1.success).toBe(true);
      expect(addResponse2.success).toBe(true);
      if (!addResponse1.success || !addResponse2.success)
        throw new Error("Should have succeeded");

      const boostIds = [
        addResponse1.data.results[0]!.id,
        addResponse2.data.results[0]!.id,
      ];

      // Verify boosts were applied to A and B (not C - no boost dates)
      const balanceABefore = await db
        .select()
        .from(boostBalances)
        .where(
          and(
            eq(boostBalances.userId, user.id),
            eq(boostBalances.competitionId, compA.competition.id),
          ),
        );
      expect(balanceABefore).toHaveLength(1);
      expect(balanceABefore[0]!.balance).toBe(1000000000000000000n);

      const balanceBBefore = await db
        .select()
        .from(boostBalances)
        .where(
          and(
            eq(boostBalances.userId, user.id),
            eq(boostBalances.competitionId, compB.competition.id),
          ),
        );
      expect(balanceBBefore).toHaveLength(1);
      expect(balanceBBefore[0]!.balance).toBe(1000000000000000000n);

      const revokeResponse = await adminClient.revokeBonusBoosts({
        boostIds,
      });

      expect(revokeResponse.success).toBe(true);
      if (!revokeResponse.success) throw new Error("Should have succeeded");

      const results = revokeResponse.data.results;
      expect(results).toHaveLength(2);

      // Both boosts should be marked as revoked
      const boostsAfter = await db
        .select()
        .from(boostBonus)
        .where(eq(boostBonus.userId, user.id));
      expect(boostsAfter).toHaveLength(2);
      expect(boostsAfter[0]!.isActive).toBe(false);
      expect(boostsAfter[0]!.revokedAt).not.toBeNull();
      expect(boostsAfter[1]!.isActive).toBe(false);
      expect(boostsAfter[1]!.revokedAt).not.toBeNull();

      // Pending competition: balance removed
      const balanceAAfter = await db
        .select()
        .from(boostBalances)
        .where(
          and(
            eq(boostBalances.userId, user.id),
            eq(boostBalances.competitionId, compA.competition.id),
          ),
        );
      expect(balanceAAfter[0]!.balance).toBe(0n);

      // Active competition: balance kept (window already open, might be spent)
      const balanceBAfter = await db
        .select()
        .from(boostBalances)
        .where(
          and(
            eq(boostBalances.userId, user.id),
            eq(boostBalances.competitionId, compB.competition.id),
          ),
        );
      expect(balanceBAfter[0]!.balance).toBe(1000000000000000000n);

      expect(results[0]).toBeDefined();
      expect(results[0]!.revoked).toBe(true);
      expect(results[0]!.removedFromPending).toContain(compA.competition.id);
      expect(results[0]!.keptInActive).toContain(compB.competition.id);
    });

    test("rejects invalid batch revoke data", async () => {
      // Test various invalid revoke scenarios
      const { user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        walletAddress: generateRandomEthAddress(),
      });

      const expiresAt = new Date(Date.now() + 300000).toISOString();
      const addResponse = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "500000000000000000",
            expiresAt,
          },
        ],
      });
      if (!addResponse.success) throw new Error("Should have succeeded");

      const validBoostId = addResponse.data.results[0]!.id;

      // Test: Empty array should be rejected
      const emptyResponse = await adminClient.revokeBonusBoosts({
        boostIds: [],
      });
      expect(emptyResponse.success).toBe(false);
      if (emptyResponse.success) throw new Error("Should have failed");

      expect(emptyResponse.error).toContain("at least one");

      // Test: Invalid UUID format should be rejected
      const invalidUuidResponse = await adminClient.revokeBonusBoosts({
        boostIds: ["not-a-uuid"],
      });
      expect(invalidUuidResponse.success).toBe(false);
      if (invalidUuidResponse.success) throw new Error("Should have failed");

      expect(invalidUuidResponse.error).toContain("Invalid");

      // Test: Non-existent boost ID should fail
      const nonExistentResponse = await adminClient.revokeBonusBoosts({
        boostIds: ["00000000-0000-0000-0000-000000000000"],
      });
      expect(nonExistentResponse.success).toBe(false);
      if (nonExistentResponse.success) throw new Error("Should have failed");

      expect(nonExistentResponse.error).toBeTruthy();

      // Test: Already revoked boost should fail
      await adminClient.revokeBonusBoosts({ boostIds: [validBoostId] });
      const alreadyRevokedResponse = await adminClient.revokeBonusBoosts({
        boostIds: [validBoostId],
      });
      expect(alreadyRevokedResponse.success).toBe(false);
      if (alreadyRevokedResponse.success) throw new Error("Should have failed");

      expect(alreadyRevokedResponse.error).toBeTruthy();
    });

    test("revokes one boost while leaving others active", async () => {
      // Selective revocation: can revoke individual boosts from same user
      const { user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        walletAddress: generateRandomEthAddress(),
      });

      const comp = await createPendingCompEligible(adminClient, "Test Comp");
      const expiresAt = new Date(Date.now() + 300000).toISOString();
      const response1 = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "500000000000000000",
            expiresAt,
          },
        ],
      });

      expect(response1.success).toBe(true);
      if (!response1.success) throw new Error("Should have succeeded");

      const boost1Id = response1.data.results[0]!.id;
      const response2 = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "1000000000000000000",
            expiresAt,
          },
        ],
      });

      expect(response2.success).toBe(true);
      if (!response2.success) throw new Error("Should have succeeded");

      const boost2Id = response2.data.results[0]!.id;
      const initialBalance = await db
        .select()
        .from(boostBalances)
        .where(
          and(
            eq(boostBalances.userId, user.id),
            eq(boostBalances.competitionId, comp.competition.id),
          ),
        );

      expect(initialBalance).toHaveLength(1);
      expect(initialBalance[0]?.balance.toString()).toBe("1500000000000000000");
      const revokeResponse = await adminClient.revokeBonusBoosts({
        boostIds: [boost1Id],
      });

      expect(revokeResponse.success).toBe(true);

      // First boost should be revoked
      const boost1 = await db
        .select()
        .from(boostBonus)
        .where(eq(boostBonus.id, boost1Id));

      expect(boost1).toHaveLength(1);
      expect(boost1[0]?.isActive).toBe(false);
      expect(boost1[0]?.revokedAt).not.toBeNull();

      // Second boost should still be active
      const boost2 = await db
        .select()
        .from(boostBonus)
        .where(eq(boostBonus.id, boost2Id));

      expect(boost2).toHaveLength(1);
      expect(boost2[0]?.isActive).toBe(true);
      expect(boost2[0]?.revokedAt).toBeNull();

      // Balance should only reflect remaining boost (1.0 tokens)
      const finalBalance = await db
        .select()
        .from(boostBalances)
        .where(
          and(
            eq(boostBalances.userId, user.id),
            eq(boostBalances.competitionId, comp.competition.id),
          ),
        );

      expect(finalBalance).toHaveLength(1);
      expect(finalBalance[0]?.balance.toString()).toBe("1000000000000000000");
    });
  });

  describe("Competition Configuration Changes", () => {
    test("cleans up invalid boosts when competition boostStartDate changes", async () => {
      // When comp dates change, boosts that are no longer eligible should be removed
      const { user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        walletAddress: generateRandomEthAddress(),
      });

      const boostExpires = new Date(Date.now() + 600000);
      const comp = await createPendingCompEligible(adminClient, "Test Comp");
      const response = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "1000000000000000000",
            expiresAt: boostExpires.toISOString(),
          },
        ],
      });

      expect(response.success).toBe(true);
      const initialBalance = await db
        .select()
        .from(boostBalances)
        .where(
          and(
            eq(boostBalances.userId, user.id),
            eq(boostBalances.competitionId, comp.competition.id),
          ),
        );

      expect(initialBalance).toHaveLength(1);
      expect(initialBalance[0]?.balance.toString()).toBe("1000000000000000000");

      // Update competition to start after boost expires (now ineligible)
      const newBoostStartDate = new Date(
        boostExpires.getTime() + 100000,
      ).toISOString();
      const updateResponse = await adminClient.updateCompetition(
        comp.competition.id,
        {
          boostStartDate: newBoostStartDate,
        },
      );

      expect(updateResponse.success).toBe(true);

      // Balance should be zeroed out (boost no longer eligible)
      const finalBalance = await db
        .select()
        .from(boostBalances)
        .where(
          and(
            eq(boostBalances.userId, user.id),
            eq(boostBalances.competitionId, comp.competition.id),
          ),
        );

      expect(finalBalance).toHaveLength(1);
      expect(finalBalance[0]?.balance.toString()).toBe("0");
    });
  });

  describe("Idempotency", () => {
    test("multiple boosts for same user sum correctly in balance", async () => {
      // Each API call creates a unique boost_bonus entry, balance is sum of all active boosts
      const { user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        walletAddress: generateRandomEthAddress(),
      });

      const expiresAt = new Date(Date.now() + 600000);

      const comp = await createActiveCompWithOpenWindow(
        adminClient,
        "Test Comp",
      );

      const response1 = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "1000000000000000000",
            expiresAt: expiresAt.toISOString(),
          },
        ],
      });

      expect(response1.success).toBe(true);
      if (!response1.success) throw new Error("Should have succeeded");

      const boost1Id = response1.data.results[0]!.id;

      const initialBalance = await db
        .select()
        .from(boostBalances)
        .where(
          and(
            eq(boostBalances.userId, user.id),
            eq(boostBalances.competitionId, comp.competition.id),
          ),
        );

      expect(initialBalance).toHaveLength(1);
      expect(initialBalance[0]?.balance.toString()).toBe("1000000000000000000");

      const initialChanges = await db
        .select()
        .from(boostChanges)
        .where(eq(boostChanges.balanceId, initialBalance[0]!.id));

      expect(initialChanges).toHaveLength(1);
      expect(initialChanges[0]?.meta).toHaveProperty("boostBonusId", boost1Id);

      const response2 = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "1000000000000000000",
            expiresAt: expiresAt.toISOString(),
          },
        ],
      });

      expect(response2.success).toBe(true);
      if (!response2.success) throw new Error("Should have succeeded");

      const boost2Id = response2.data.results[0]!.id;

      expect(boost1Id).not.toBe(boost2Id);

      // Balance should be sum of both boosts
      const finalBalance = await db
        .select()
        .from(boostBalances)
        .where(
          and(
            eq(boostBalances.userId, user.id),
            eq(boostBalances.competitionId, comp.competition.id),
          ),
        );

      expect(finalBalance).toHaveLength(1);
      expect(finalBalance[0]?.balance.toString()).toBe("2000000000000000000");

      const finalChanges = await db
        .select()
        .from(boostChanges)
        .where(eq(boostChanges.balanceId, finalBalance[0]!.id));

      expect(finalChanges).toHaveLength(2);

      const allBoosts = await db
        .select()
        .from(boostBonus)
        .where(eq(boostBonus.userId, user.id));

      expect(allBoosts).toHaveLength(2);
      expect(allBoosts.every((b) => b.isActive)).toBe(true);
    });
  });

  describe("Integration with Staked Boosts", () => {
    test("bonus boosts and staked boosts sum together correctly", async () => {
      // Both bonus and staked boosts contribute to same balance
      const { user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        walletAddress: generateRandomEthAddress(),
      });

      const comp = await createActiveCompWithOpenWindow(
        adminClient,
        "Test Comp",
      );
      const expiresAt = new Date(Date.now() + 300000).toISOString();

      // Add a bonus boost first
      const bonusResponse = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "1000000000000000000",
            expiresAt,
          },
        ],
      });

      expect(bonusResponse.success).toBe(true);

      const balanceAfterBonus = await getBoostBalance(
        user.id,
        comp.competition.id,
      );
      expect(balanceAfterBonus).toHaveLength(1);
      expect(balanceAfterBonus[0]?.balance.toString()).toBe(
        "1000000000000000000",
      );

      const changesAfterBonus = await db
        .select()
        .from(boostChanges)
        .where(eq(boostChanges.balanceId, balanceAfterBonus[0]!.id));

      expect(changesAfterBonus).toHaveLength(1);
      expect(changesAfterBonus[0]?.meta).toHaveProperty("boostBonusId");

      const bonusBoosts = await getUserBoosts(user.id);
      expect(bonusBoosts).toHaveLength(1);
      expect(bonusBoosts[0]?.amount.toString()).toBe("1000000000000000000");
      expect(bonusBoosts[0]?.isActive).toBe(true);

      // Now simulate a staked boost by creating a stake and using the boost service
      // This would normally be triggered by the staking event processor
      // For this test, we'll directly use the BoostRepository to simulate the effect
      const boostRepo = new BoostRepository(db);

      // Simulate a staked boost increase (500000000000000000 = 0.5 tokens)
      const stakeBoostResult = await boostRepo.increase({
        userId: user.id,
        wallet: user.walletAddress,
        competitionId: comp.competition.id,
        amount: 500000000000000000n,
      });

      expect(stakeBoostResult.type).toBe("applied");

      // Verify that bonus and staked boosts sum together
      const finalBalance = await getBoostBalance(user.id, comp.competition.id);
      expect(finalBalance).toHaveLength(1);
      // 1.0 (bonus) + 0.5 (staked) = 1.5 tokens
      expect(finalBalance[0]?.balance.toString()).toBe("1500000000000000000");

      const finalChanges = await db
        .select()
        .from(boostChanges)
        .where(eq(boostChanges.balanceId, finalBalance[0]!.id));

      // Should have 2 changes: one from bonus, one from staked
      expect(finalChanges).toHaveLength(2);

      // Verify one change has boostBonusId (bonus boost)
      const bonusChange = finalChanges.find(
        (c) => c.meta && typeof c.meta === "object" && "boostBonusId" in c.meta,
      );
      expect(bonusChange).toBeDefined();

      // Verify one change doesn't have boostBonusId (staked boost)
      const stakedChange = finalChanges.find(
        (c) =>
          !c.meta || typeof c.meta !== "object" || !("boostBonusId" in c.meta),
      );
      expect(stakedChange).toBeDefined();

      const allBonusBoosts = await getUserBoosts(user.id);
      expect(allBonusBoosts).toHaveLength(1);
      expect(allBonusBoosts.every((b) => b.isActive)).toBe(true);
    });

    test("revoking bonus boost keeps staked boosts intact", async () => {
      // Test that revoking bonus boosts doesn't affect staked boosts
      // Both types should be independent in the boost_changes table
      const { user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        walletAddress: generateRandomEthAddress(),
      });

      const activeComp = await createActiveCompWithOpenWindow(
        adminClient,
        "Active Comp",
      );
      const pendingComp = await createPendingCompEligible(
        adminClient,
        "Pending Comp",
      );
      const expiresAt = new Date(Date.now() + 300000).toISOString();

      // Add a bonus boost
      const bonusResponse = await adminClient.addBonusBoosts({
        boosts: [
          {
            wallet: user.walletAddress,
            amount: "1000000000000000000",
            expiresAt,
          },
        ],
      });
      if (!bonusResponse.success) throw new Error("Should have succeeded");

      const bonusBoostId = bonusResponse.data.results[0]!.id;

      // Add staked boosts to both competitions
      const boostRepo = new BoostRepository(db);

      await boostRepo.increase({
        userId: user.id,
        wallet: user.walletAddress,
        competitionId: activeComp.competition.id,
        amount: 500000000000000000n,
      });

      await boostRepo.increase({
        userId: user.id,
        wallet: user.walletAddress,
        competitionId: pendingComp.competition.id,
        amount: 500000000000000000n,
      });

      // Verify initial balances: 1.0 (bonus) + 0.5 (staked) = 1.5
      const activeBalanceBefore = await getBoostBalance(
        user.id,
        activeComp.competition.id,
      );
      expect(activeBalanceBefore[0]?.balance.toString()).toBe(
        "1500000000000000000",
      );

      const pendingBalanceBefore = await getBoostBalance(
        user.id,
        pendingComp.competition.id,
      );
      expect(pendingBalanceBefore[0]?.balance.toString()).toBe(
        "1500000000000000000",
      );

      // Revoke the bonus boost
      const revokeResponse = await adminClient.revokeBonusBoosts({
        boostIds: [bonusBoostId],
      });

      expect(revokeResponse.success).toBe(true);

      // Active competition keeps full balance (window already open, revoke doesn't apply)
      const activeBalanceAfter = await getBoostBalance(
        user.id,
        activeComp.competition.id,
      );
      expect(activeBalanceAfter[0]?.balance.toString()).toBe(
        "1500000000000000000",
      );

      // Pending competition: bonus removed (1.0), staked remains (0.5)
      const pendingBalanceAfter = await getBoostBalance(
        user.id,
        pendingComp.competition.id,
      );
      expect(pendingBalanceAfter[0]?.balance.toString()).toBe(
        "500000000000000000",
      );

      // Verify the bonus boost was revoked
      const allBoosts = await getUserBoosts(user.id);
      expect(allBoosts).toHaveLength(1);
      expect(allBoosts[0]?.id).toBe(bonusBoostId);
      expect(allBoosts[0]?.isActive).toBe(false);
      expect(allBoosts[0]?.revokedAt).not.toBeNull();

      // Verify staked boost changes are still in the database
      const pendingChanges = await db
        .select()
        .from(boostChanges)
        .where(eq(boostChanges.balanceId, pendingBalanceAfter[0]!.id));

      // Should have 2 changes initially (bonus + staked), minus 1 after revoke = 1 remaining
      expect(pendingChanges.length).toBeGreaterThanOrEqual(1);

      // Verify at least one change doesn't have boostBonusId (the staked boost)
      const stakedChange = pendingChanges.find(
        (c) =>
          !c.meta || typeof c.meta !== "object" || !("boostBonusId" in c.meta),
      );
      expect(stakedChange).toBeDefined();
    });
  });

  describe("Cron Job Integration", () => {
    test.skip("applies boosts to eligible competitions", async () => {
      // Cron job - applies boosts - verifies cron applies boosts to eligible competitions
      //
      // System Behavior:
      // - Cron runs every 3 hours, finds pending competitions
      // - Evaluates eligibility (competition starts before boost expires, window not ended, dates set)
      // - Applies eligible boosts using idempotency keys
      //
      // Scenario A: New competition created after boost awarded
      // - Register user, award boost (no competitions exist)
      // - Create new competition, cron job runs
      // - Expected: Boost applied to competition
      //
      // Scenario B: Competition gets dates set after boost awarded
      // - Register user, create competition without boost dates
      // - Award boost (skipped - no dates), then set boost dates
      // - Cron job runs
      // - Expected: Boost applied to competition
      // - Edge cases: Expired boost → no application, revoked boost → no application,
      //   past boostEndDate → no application
    });

    test.skip("prevents duplicate boost applications", async () => {
      // Cron job - idempotency - verifies cron doesn't duplicate boosts via idempotency keys
      //
      // System Behavior:
      // - Both immediate application (on award) and cron use same idempotency key format
      // - Database unique constraint on (balanceId, idemKey) prevents duplicates
      // - Second attempt silently skipped (no error)
      //
      // Scenario A: Cron runs after immediate application
      // - Register user, create competition, award boost (immediately applied)
      // - Cron job runs
      // - Expected: Duplicate prevented, boost_changes contains exactly one entry
      //
      // Scenario B: Concurrent API grant and cron job
      // - Register user, create pending competition
      // - Admin grants boost via API while cron job runs simultaneously
      // - Expected: Boost applied exactly once (not duplicated), transaction isolation prevents race conditions
    });

    test.skip("skips inactive and expired boosts in cron job", async () => {
      // Cron job - skips inactive/expired boosts - verifies cron excludes revoked and expired boosts
      //
      // System Behavior:
      // - Cron queries for active boosts only (filters is_active=true)
      // - Revoked boosts excluded from query
      // - Expired boosts excluded during eligibility check (expiresAt < now)
      // - New competitions don't receive revoked or expired boosts
      //
      // Scenario A: Revoked boost
      // - Register user, award boost, revoke boost
      // - Create new competition, cron job runs
      // - Expected: Revoked boost excluded from query, boost not applied
      //
      // Scenario B: Expired boost
      // - Register user, award boost with short expiration (expires before new competition)
      // - Create new competition, cron job runs
      // - Expected: Expired boost excluded during eligibility check, boost not applied
    });

    test.skip("handles failures gracefully in cron job", async () => {
      // Cron job - error handling - verifies cron continues processing even if one competition fails
      //
      // System Behavior:
      // - Processes each competition independently (isolated error handling)
      // - Catches and logs errors with full context (competition ID, boost ID, error details)
      // - Continues processing other competitions without stopping the job
      // - Accepts partial success (some competitions get boosts, others fail)
      // - Failed competitions will be retried on next cron run (implicit retry mechanism)
      // - No database storage of failures (errors only logged)
      //
      // Setup:
      // - Register user, award boost
      // - Create competitions: A (valid), B (invalid - e.g., deleted, missing dates), C (valid)
      // - Cron job runs
      //
      // Expected:
      // - Competition A: Boost applied successfully
      // - Competition B: Error caught and logged with context, processing continues
      // - Competition C: Boost applied successfully
      // - Cron job completes (does not crash)
      // - Failed competition B will be retried on next cron run
    });
  });
});
