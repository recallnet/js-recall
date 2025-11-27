import axios from "axios";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { users } from "@recallnet/db/schema/core/defs";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  ApiClient,
  ErrorResponse,
  connectToDb,
  createTestClient,
  generateRandomEthAddress,
  getBaseUrl,
  registerUserAndAgentAndGetClient,
} from "@recallnet/test-utils";

/**
 * E2E tests for admin users reset email/Privy endpoint
 */
describe("Admin reset users' email and Privy state", () => {
  let adminApiKey: string;

  beforeEach(async () => {
    const response = await axios.post(`${getBaseUrl()}/api/admin/setup`, {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
      email: ADMIN_EMAIL,
    });
    adminApiKey = response.data.admin.apiKey;
    expect(adminApiKey).toBeDefined();
  });

  test("should reset single user's email and privy fields", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register one user with agent
    const { user } = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });

    // Call reset endpoint
    const result = (await adminClient.request(
      "post",
      "/api/admin/users/reset-email",
      { walletAddresses: [user.walletAddress] },
    )) as { success: boolean; userIds?: string[] } | ErrorResponse;

    expect(result).toBeDefined();
    if ("success" in result && result.success) {
      expect(result.userIds).toBeDefined();
      expect(result.userIds!.includes(user.id)).toBe(true);
    } else {
      throw new Error(`Expected success response, got ${(result as ErrorResponse).error}`);
    }

    // Verify DB fields are nullified
    const db = await connectToDb();
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row).toBeDefined();
    expect(row!.email).toBeNull();
    expect(row!.privyId).toBeNull();
    expect(row!.embeddedWalletAddress).toBeNull();
    expect(row!.walletLastVerifiedAt).toBeNull();
    expect(row!.lastLoginAt).toBeNull();
  });

  test("should reset multiple users", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const u1 = await registerUserAndAgentAndGetClient({ adminApiKey });
    const u2 = await registerUserAndAgentAndGetClient({ adminApiKey });

    const result = (await adminClient.request(
      "post",
      "/api/admin/users/reset-email",
      { walletAddresses: [u1.user.walletAddress, u2.user.walletAddress] },
    )) as { success: boolean; userIds?: string[] } | ErrorResponse;

    expect(result).toBeDefined();
    if ("success" in result && result.success) {
      expect(result.userIds).toBeDefined();
      expect(result.userIds!.sort()).toEqual([u1.user.id, u2.user.id].sort());
    } else {
      throw new Error(`Expected success response, got ${(result as ErrorResponse).error}`);
    }

    const db = await connectToDb();
    const [r1] = await db.select().from(users).where(eq(users.id, u1.user.id));
    const [r2] = await db.select().from(users).where(eq(users.id, u2.user.id));
    expect(r1!.email).toBeNull();
    expect(r2!.email).toBeNull();
  });

  test("should accept case-insensitive wallet addresses", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const { user } = await registerUserAndAgentAndGetClient({ adminApiKey });

    const upperWallet = user.walletAddress.toUpperCase();

    const result = (await adminClient.request(
      "post",
      "/api/admin/users/reset-email",
      { walletAddresses: [upperWallet] },
    )) as { success: boolean; userIds?: string[] } | ErrorResponse;

    expect(result).toBeDefined();
    if ("success" in result && result.success) {
      expect(result.userIds).toBeDefined();
      expect(result.userIds!.includes(user.id)).toBe(true);
    } else {
      throw new Error(`Expected success response, got ${(result as ErrorResponse).error}`);
    }
  });

  test("should rollback when Privy API deletion fails", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const okUser = await registerUserAndAgentAndGetClient({ adminApiKey });
    // Create a user with a Privy ID that triggers mock failure
    const failingPrivyId = "did:privy:fail-delete-" + Math.random().toString(36).slice(2, 8);
    const failWallet = generateRandomEthAddress();
    const failUser = await registerUserAndAgentAndGetClient({
      adminApiKey,
      walletAddress: failWallet,
      embeddedWalletAddress: failWallet,
      privyId: failingPrivyId,
    });

    const errorResp = (await adminClient.request(
      "post",
      "/api/admin/users/reset-email",
      {
        walletAddresses: [okUser.user.walletAddress, failUser.user.walletAddress],
      },
    )) as ErrorResponse | { success: boolean };

    // Expect failure due to Privy deletion error
    if ("status" in errorResp) {
      expect(errorResp.success).toBe(false);
      expect(errorResp.status).toBe(500);
    } else {
      throw new Error("Expected error response due to Privy deletion failure");
    }

    // Verify DB changes rolled back (emails should remain non-null)
    const db = await connectToDb();
    const [okRow] = await db
      .select()
      .from(users)
      .where(eq(users.id, okUser.user.id));
    const [failRow] = await db
      .select()
      .from(users)
      .where(eq(users.id, failUser.user.id));
    expect(okRow!.email).not.toBeNull();
    expect(failRow!.email).not.toBeNull();
  });

  test("should handle non-existent wallet addresses", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const randomWallet = generateRandomEthAddress();

    const result = (await adminClient.request(
      "post",
      "/api/admin/users/reset-email",
      { walletAddresses: [randomWallet] },
    )) as { success: boolean; userIds?: string[]; message?: string } | ErrorResponse;

    expect(result).toBeDefined();
    if ("success" in result && result.success) {
      expect(result.userIds).toBeDefined();
      expect(result.userIds!.length).toBe(0);
    } else {
      throw new Error(`Expected success response, got ${(result as ErrorResponse).error}`);
    }
  });

  test("should require admin authentication", async () => {
    const nonAdminClient = new ApiClient();
    const wallet = generateRandomEthAddress();
    const resp = (await nonAdminClient.request(
      "post",
      "/api/admin/users/reset-email",
      { walletAddresses: [wallet] },
    )) as ErrorResponse | { success: boolean };

    // Expect unauthorized
    if ("status" in resp) {
      expect(resp.success).toBe(false);
      expect(resp.status).toBe(401);
    } else {
      throw new Error("Expected unauthorized error response");
    }
  });
});
