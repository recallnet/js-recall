import { randomUUID } from "crypto";
import { describe, expect, test } from "vitest";

import { users } from "@recallnet/db/schema/core/defs";
import {
  connectToDb,
  createMockPrivyToken,
  createTestPrivyUser,
  generateRandomEthAddress,
  generateRandomPrivyId,
} from "@recallnet/test-utils";

import { createTestRpcClient } from "../utils/rpc-client-helpers.js";

describe("email subscription", () => {
  test("should subscribe user to email list upon user creation", async () => {
    const testUser = createTestPrivyUser({
      name: "Alice Test",
      email: "alice@example.com",
    });
    const { name, email, privyId } = testUser;

    // Create mock Privy token and RPC client
    const privyToken = await createMockPrivyToken(testUser);
    const rpcClient = await createTestRpcClient(privyToken);

    // Login to create user
    await rpcClient.user.login();

    // Get profile and verify user is subscribed by default
    const user = await rpcClient.user.getProfile();
    expect(user.name).toBe(name);
    expect(user.email).toBe(email);
    expect(user.privyId).toBe(privyId);
    expect(user.isSubscribed).toBe(true);
  });

  test("subscribes user and is idempotent on subscribe", async () => {
    // Manually create a user via db write
    const db = await connectToDb();
    const walletAddress = generateRandomEthAddress();
    const userId = randomUUID();
    const privyId = generateRandomPrivyId();
    const email = `bob@example.com`;
    const [row] = await db
      .insert(users)
      .values({
        id: userId,
        name: "Bob Test",
        email,
        privyId,
        walletAddress,
        embeddedWalletAddress: walletAddress,
        isSubscribed: false,
      })
      .returning();
    expect(row).toBeDefined();
    expect(row!.isSubscribed).toBe(false);

    // Create test user and RPC client
    const testUser = createTestPrivyUser({
      email,
      privyId,
      walletAddress,
    });
    const privyToken = await createMockPrivyToken(testUser);
    const rpcClient = await createTestRpcClient(privyToken);

    // Initial profile
    const profile = await rpcClient.user.getProfile();
    expect(profile.isSubscribed).toBe(false);

    // Subscribe
    const subResult = await rpcClient.user.subscribe();
    expect(subResult.isSubscribed).toBe(true);

    // Duplicate subscribe -> idempotent
    const dupResult = await rpcClient.user.subscribe();
    expect(dupResult.isSubscribed).toBe(true);
  });

  test("unsubscribes user and is idempotent on unsubscribe", async () => {
    // Create test user and RPC client
    const testUser = createTestPrivyUser();
    const privyToken = await createMockPrivyToken(testUser);
    const rpcClient = await createTestRpcClient(privyToken);

    // Login to create user
    await rpcClient.user.login();

    // Ensure subscribed first (this happens upon user creation)
    const profile = await rpcClient.user.getProfile();
    expect(profile.isSubscribed).toBe(true);

    // Unsubscribe
    const unsubResult = await rpcClient.user.unsubscribe();
    expect(unsubResult.isSubscribed).toBe(false);

    // Duplicate unsubscribe -> idempotent
    const dupUnsubResult = await rpcClient.user.unsubscribe();
    expect(dupUnsubResult.isSubscribed).toBe(false);
  });
});
