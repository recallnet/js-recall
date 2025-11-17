import { v7 as uuidv7 } from "uuid";
import { describe, expect, test } from "vitest";

import { users } from "@recallnet/db/schema/core/defs";
import {
  ApiClient,
  UserProfileResponse,
  UserSubscriptionResponse,
  connectToDb,
  createTestPrivyUser,
  generateRandomEthAddress,
  generateRandomPrivyId,
} from "@recallnet/test-utils";

describe("email subscription", () => {
  test("should subscribe user to email list upon user creation", async () => {
    const client = new ApiClient();
    const testUser = createTestPrivyUser({
      name: "Alice Test",
      email: "alice@example.com",
    });
    const { name, email, privyId } = testUser;
    const authResult = await client.authenticateWithPrivy(testUser);
    expect(authResult.success).toBe(true);

    const { user, success } =
      (await client.getUserProfile()) as UserProfileResponse;
    expect(success).toBe(true);
    expect(user.name).toBe(name);
    expect(user.email).toBe(email);
    expect(user.privyId).toBe(privyId);
    expect(user.isSubscribed).toBe(true);
  });

  test("subscribes user and is idempotent on subscribe", async () => {
    const client = new ApiClient();

    // Manually create a user via db write
    const db = await connectToDb();
    const walletAddress = generateRandomEthAddress();
    const userId = uuidv7();
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
    const userClient = await client.createPrivyUserClient({
      email,
      privyId,
      walletAddress,
    });

    // Initial profile
    const profile = (await userClient.getUserProfile()) as UserProfileResponse;
    expect(profile.success).toBe(true);
    expect(profile.user.isSubscribed).toBe(false);

    // Subscribe
    const sub =
      (await userClient.subscribeToMailingList()) as UserSubscriptionResponse;
    expect(sub.success).toBe(true);
    expect(sub.isSubscribed).toBe(true);

    // Duplicate subscribe -> idempotent 200
    const dup =
      (await userClient.subscribeToMailingList()) as UserSubscriptionResponse;
    expect(dup.success).toBe(true);
    expect(dup.isSubscribed).toBe(true);
  });

  test("unsubscribes user and is idempotent on unsubscribe", async () => {
    const client = new ApiClient();
    const userClient = await client.createPrivyUserClient();

    // Ensure subscribed first (this happens upon user creation)
    const profile = (await userClient.getUserProfile()) as UserProfileResponse;
    expect(profile.success).toBe(true);
    expect(profile.user.isSubscribed).toBe(true);

    // Unsubscribe
    const unsub =
      (await userClient.unsubscribeFromMailingList()) as UserSubscriptionResponse;
    expect(unsub.success).toBe(true);
    expect(unsub.isSubscribed).toBe(false);

    // Duplicate unsubscribe -> idempotent 200
    const dupUnsub =
      (await userClient.unsubscribeFromMailingList()) as UserSubscriptionResponse;
    expect(dupUnsub.success).toBe(true);
    expect(dupUnsub.isSubscribed).toBe(false);
  });
});
