import { type RouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { users } from "@recallnet/db/schema/core/defs";
import { generateRandomPrivyId } from "@recallnet/test-utils";
import {
  ADMIN_EMAIL,
  ensureDefaultArenas,
  generateRandomEthAddress,
} from "@recallnet/test-utils";

import { db } from "@/lib/db";
import { router as adminRouter } from "@/rpc/router/admin/index.js";

import {
  assertRpcError,
  createTestAdminRpcClient,
  registerUserAndAgent,
} from "../utils/rpc-client-helpers.js";

describe("Admin Reset Privy User API", () => {
  let authorizedAdminClient: RouterClient<typeof adminRouter>;

  beforeEach(async () => {
    // Create an unauthorized client first to setup admin
    const unauthorizedAdminClient = await createTestAdminRpcClient();
    const result = await unauthorizedAdminClient.setup({
      username: "admin",
      password: "admin-password",
      email: ADMIN_EMAIL,
    });
    authorizedAdminClient = await createTestAdminRpcClient({
      apiKey: result.admin.apiKey,
    });

    await ensureDefaultArenas();
  });

  test("should reset a user by email", async () => {
    // Register a user with Privy-related fields
    const userEmail = `reset-test-${Date.now()}@test.com`;
    const walletAddress = generateRandomEthAddress();
    const privyId = generateRandomPrivyId();
    const embeddedWalletAddress = generateRandomEthAddress();

    const { user } = await registerUserAndAgent(authorizedAdminClient, {
      walletAddress,
      email: userEmail,
      name: "Reset Test User",
      privyId,
      embeddedWalletAddress,
    });

    expect(user.email).toBe(userEmail);
    expect(user.privyId).toBe(privyId);
    expect(user.embeddedWalletAddress).toBe(
      embeddedWalletAddress.toLowerCase(),
    );

    // Reset the user by email
    const resetResult = await authorizedAdminClient.users.resetPrivy({
      emails: [userEmail],
    });

    expect(resetResult.success).toBe(true);
    expect(resetResult.resetCount).toBe(1);
    expect(resetResult.totalRequested).toBe(1);
    expect(resetResult.results).toHaveLength(1);
    expect(resetResult.results[0]!.success).toBe(true);

    // Verify user fields are now null in DB
    const [updatedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id));

    expect(updatedUser).toBeDefined();
    expect(updatedUser!.email).toBeNull();
    expect(updatedUser!.privyId).toBeNull();
    expect(updatedUser!.embeddedWalletAddress).toBeNull();
    expect(updatedUser!.walletLastVerifiedAt).toBeNull();
    // walletAddress should still be set
    expect(updatedUser!.walletAddress).toBe(walletAddress.toLowerCase());
  });

  test("should reset a user by wallet address", async () => {
    // Register a user with Privy-related fields
    const userEmail = `wallet-reset-${Date.now()}@test.com`;
    const walletAddress = generateRandomEthAddress();
    const privyId = generateRandomPrivyId();

    const { user } = await registerUserAndAgent(authorizedAdminClient, {
      walletAddress,
      email: userEmail,
      name: "Wallet Reset User",
      privyId,
    });

    // Reset the user by wallet
    const resetResult = await authorizedAdminClient.users.resetPrivy({
      wallets: [walletAddress],
    });

    expect(resetResult.success).toBe(true);
    expect(resetResult.resetCount).toBe(1);
    expect(resetResult.results[0]!.success).toBe(true);

    // Verify user fields are now null in DB
    const [updatedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id));

    expect(updatedUser!.email).toBeNull();
    expect(updatedUser!.privyId).toBeNull();
  });

  test("should reset multiple users by wallets", async () => {
    // Register multiple users
    const wallet1 = generateRandomEthAddress();
    const wallet2 = generateRandomEthAddress();

    const { user: user1 } = await registerUserAndAgent(authorizedAdminClient, {
      walletAddress: wallet1,
      email: `multi1-${Date.now()}@test.com`,
      privyId: generateRandomPrivyId(),
    });

    const { user: user2 } = await registerUserAndAgent(authorizedAdminClient, {
      walletAddress: wallet2,
      email: `multi2-${Date.now()}@test.com`,
      privyId: generateRandomPrivyId(),
    });

    // Reset both users
    const resetResult = await authorizedAdminClient.users.resetPrivy({
      wallets: [wallet1, wallet2],
    });

    expect(resetResult.success).toBe(true);
    expect(resetResult.resetCount).toBe(2);
    expect(resetResult.totalRequested).toBe(2);

    // Verify both users are reset
    const [updated1] = await db
      .select()
      .from(users)
      .where(eq(users.id, user1.id));
    const [updated2] = await db
      .select()
      .from(users)
      .where(eq(users.id, user2.id));

    expect(updated1!.email).toBeNull();
    expect(updated1!.privyId).toBeNull();
    expect(updated2!.email).toBeNull();
    expect(updated2!.privyId).toBeNull();
  });

  test("should handle user not found gracefully", async () => {
    const resetResult = await authorizedAdminClient.users.resetPrivy({
      emails: ["nonexistent@email.com"],
    });

    // Should still return success but with 0 reset count
    expect(resetResult.success).toBe(true);
    expect(resetResult.resetCount).toBe(0);
    expect(resetResult.results[0]!.success).toBe(false);
    expect(resetResult.results[0]!.error).toBe("User not found");
  });

  test("should fail when both emails and wallets are provided", async () => {
    await assertRpcError(
      authorizedAdminClient.users.resetPrivy({
        emails: ["test@test.com"],
        wallets: [generateRandomEthAddress()],
      }),
      "BAD_REQUEST",
      { messageContains: "exactly one of emails or wallets" },
    );
  });

  test("should fail when neither emails nor wallets are provided", async () => {
    await assertRpcError(
      authorizedAdminClient.users.resetPrivy({}),
      "BAD_REQUEST",
    );
  });
});
