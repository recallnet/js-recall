import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import { agents, users } from "@recallnet/db/schema/core/defs";
import { UserRegistrationResponse } from "@recallnet/test-utils";
import { connectToDb } from "@recallnet/test-utils";
import {
  createMockPrivyToken,
  createTestClient,
  createTestPrivyUser,
  generateRandomEthAddress,
  getAdminApiKey,
} from "@recallnet/test-utils";

import { createTestRpcClient } from "../utils/rpc-client-helpers.js";
import { createPrivyAuthenticatedRpcClient } from "../utils/test-helpers.js";

describe("Privy Authentication", () => {
  test("should authenticate user with Privy JWT and sync profile", async () => {
    // Authenticate with Privy using RPC
    const { user } = await createPrivyAuthenticatedRpcClient({
      userName: "Alice Test",
      userEmail: "alice@example.com",
    });

    // Verify authentication succeeded
    expect(user.id).toBeDefined();
    expect(user.walletAddress).toBeDefined();
    expect(user.name).toBe("Alice Test");
    expect(user.email).toBe("alice@example.com");
  });

  test("should authenticate user with wallet provider", async () => {
    // Authenticate with Privy using RPC
    const { user } = await createPrivyAuthenticatedRpcClient({
      userName: "Bob Wallet",
      userEmail: "bob@example.com",
      walletAddress: "0x742d35Cc6665C6532e5fc7E95C7Ed1F84e93e3E4",
    });

    expect(user.id).toBeDefined();
    expect(user.walletAddress).toBeDefined();
  });

  test("should create user client with Privy authentication", async () => {
    // Create Privy-authenticated RPC client
    const { rpcClient } = await createPrivyAuthenticatedRpcClient({
      userName: "Charlie Test",
      userEmail: "charlie@example.com",
    });

    // Test that the client is authenticated by getting user profile
    const profile = await rpcClient.user.getProfile();

    expect(profile.name).toBe("Charlie Test");
    expect(profile.email).toBe("charlie@example.com");
  });

  test("should handle different authentication providers", async () => {
    const providers: Array<"email" | "google" | "github" | "wallet"> = [
      "email",
      "google",
      "github",
      "wallet",
    ];

    for (const provider of providers) {
      // Authenticate using RPC
      const { user } = await createPrivyAuthenticatedRpcClient({
        userName: `Test User ${provider}`,
        userEmail: `test-${provider}@example.com`,
        walletAddress:
          provider === "wallet"
            ? "0x742d35Cc6665C6532e5fc7E95C7Ed1F84e93e3E4"
            : undefined,
      });

      expect(user.id).toBeDefined();
      expect(user.walletAddress).toBeDefined();
    }
  });

  test("can link a privy wallet to a user", async () => {
    const { user } = await createPrivyAuthenticatedRpcClient({
      userName: "Wallet Linking Test User",
      userEmail: "wallet-linking-test@example.com",
    });
    // Simulate linking the wallet in Privy by creating a new JWT with the linked wallet
    const newWalletAddress = "0x1234567890123456789012345678901234567890";
    // Double check the existing wallet is not the same as the new one
    expect(user.walletAddress).not.toBe(newWalletAddress);

    // Create a new JWT token with the linked wallet
    const privyUser = createTestPrivyUser({
      privyId: user.privyId || undefined,
      name: user.name,
      email: user.email,
      walletAddress: user.walletAddress,
      provider: "email",
    });
    const updatedPrivyToken = await createMockPrivyToken(privyUser, {
      newLinkedWallets: [newWalletAddress],
    });

    // Update the client with the new token
    const updatedRpcClient = await createTestRpcClient(updatedPrivyToken);
    const linkedUser = await updatedRpcClient.user.linkWallet({
      walletAddress: newWalletAddress,
    });
    expect(linkedUser.walletAddress).toBe(newWalletAddress);
  });

  test("fails to link invalid privy wallet to a user", async () => {
    const { rpcClient, user } = await createPrivyAuthenticatedRpcClient({
      userName: "Wallet Linking Test User",
      userEmail: "wallet-linking-test@example.com",
    });
    // Double check the existing wallet is not the same as the new one
    const newWalletAddress = "0x1234567890123456789012345678901234567890";
    expect(user.walletAddress).not.toBe(newWalletAddress);

    // Attempt to link an invalid wallet (not in Privy)
    await expect(
      rpcClient.user.linkWallet({ walletAddress: newWalletAddress }),
    ).rejects.toThrow(/Wallet not linked to user/);
  });

  // Our middleware calls the `verifyPrivyIdentityTokenAndUpdateUser` function, which is used to
  // backfill users to Privy. This function is used to handle the following cases:
  // 1. Brand new users, which will have Privy-related information included from the get-go
  // 2. Users who have not logged in with Privy, which includes:
  //    - Users with wallet + email (i.e., they completed their legacy Loops signup)
  //    - Users with wallet but no email (i.e., they never verified their email, pre-Privy)
  describe("Backfilling users with Privy data", () => {
    let db: Awaited<ReturnType<typeof connectToDb>>;
    let adminApiKey: string;

    beforeAll(async () => {
      db = await connectToDb();
    });

    beforeEach(async () => {
      adminApiKey = await getAdminApiKey();
    });

    afterEach(async () => {
      await db.delete(users);
    });

    test("should create a new user with privy information", async () => {
      const { user } = await createPrivyAuthenticatedRpcClient({
        userName: "New Privy User",
        userEmail: "new-privy-user@example.com",
      });
      expect(user.privyId).toBeDefined();
      expect(user.name).toBe("New Privy User");
      expect(user.email).toBe("new-privy-user@example.com");
      expect(user.walletAddress).toBe(user.embeddedWalletAddress);
      expect(user.walletLastVerifiedAt).toBeDefined();
      expect(user.embeddedWalletAddress).toBeDefined();
    });

    test("should backfill pre-existing user with both a wallet and email", async () => {
      const walletAddress = generateRandomEthAddress();
      const email = "backfilled-privy-user@example.com";
      const name = "Backfilled Privy User";
      const id = randomUUID();
      const [row] = await db
        .insert(users)
        .values({
          id,
          name,
          email,
          walletAddress,
        })
        .returning();
      expect(row).toBeDefined();

      const { user } = await createPrivyAuthenticatedRpcClient({
        userEmail: email,
        walletAddress,
      });
      expect(user.privyId).toBeDefined();
      expect(user.name).toBe(name);
      expect(user.email).toBe(email);
      expect(user.walletAddress).toBe(walletAddress);
      // Wallet address is not verified yet, so we don't set it as verified
      expect(user.walletLastVerifiedAt).toBeNull();
      expect(user.embeddedWalletAddress).toBeDefined();
    });

    test("should backfill pre-existing user with only a wallet", async () => {
      const walletAddress = generateRandomEthAddress();
      const name = "Backfilled Privy User";
      const id = randomUUID();
      const [row] = await db
        .insert(users)
        .values({
          id,
          name,
          walletAddress,
        })
        .returning();
      expect(row).toBeDefined();

      const email = "user-with-only-wallet@example.com";
      const { user } = await createPrivyAuthenticatedRpcClient({
        userEmail: email, // Privy auth will always set an email
        walletAddress,
      });
      expect(user.privyId).toBeDefined();
      expect(user.name).toBe(name);
      expect(user.email).toBe(email);
      expect(user.walletAddress).toBe(walletAddress);
      // Wallet address is not verified yet, so we don't set it as verified
      expect(user.walletLastVerifiedAt).toBeNull();
      expect(user.embeddedWalletAddress).toBeDefined();
    });

    test("wallet-only user merges accounts: agents moved, old user deleted", async () => {
      // Admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // 1) Create legacy-ish user A with a known wallet and an agent
      const legacyWallet = generateRandomEthAddress();
      const legacyEmail = `legacy-${Date.now()}@example.com`;
      const legacyData = (await adminClient.registerUser({
        walletAddress: legacyWallet,
        name: "Legacy User",
        email: legacyEmail,
        agentName: "Legacy Agent",
      })) as UserRegistrationResponse;
      expect(legacyData.success).toBe(true);
      expect(legacyData.user.walletAddress).toBe(legacyWallet);
      expect(legacyData.user.email).toBe(legacyEmail);
      // Privy info should not exist
      expect(legacyData.user.privyId).toBeUndefined();

      const legacyUserId = legacyData.user.id;
      expect(legacyData.agent).toBeDefined();
      const legacyAgentId = legacyData.agent!.id;

      // 2) Create a new Privy-authenticated user B
      // This user will have the same wallet as the legacy user, but a different email
      const newEmail = `merge-target-${Date.now()}@example.com`;
      const { user: newUser } = await createPrivyAuthenticatedRpcClient({
        userName: "Privy Merge Target",
        userEmail: newEmail,
      });
      expect(newUser.email).toBe(newEmail);

      // 3) Simulate linking legacy wallet in Privy and call link endpoint
      const privyUser = createTestPrivyUser({
        privyId: newUser.privyId || undefined,
        name: newUser.name,
        email: newUser.email,
        walletAddress: newUser.walletAddress,
        provider: "email",
      });
      const updatedToken = await createMockPrivyToken(privyUser, {
        newLinkedWallets: [legacyWallet],
      });
      const updatedRpcClient = await createTestRpcClient(updatedToken);
      const linkedUser = await updatedRpcClient.user.linkWallet({
        walletAddress: legacyWallet,
      });
      expect(linkedUser.walletAddress).toBe(legacyWallet);

      // 4) Verify migrations
      // - Agent owner moved to new user
      const agentAfter = await db
        .select()
        .from(agents)
        .where(eq(agents.id, legacyAgentId));
      expect(agentAfter[0]).toBeDefined();
      expect(agentAfter[0]?.ownerId).toBe(linkedUser.id);

      // - Old user is deleted
      const oldUserRows = await db
        .select()
        .from(users)
        .where(eq(users.id, legacyUserId));
      expect(oldUserRows.length).toBe(0);
    });

    test("wallet + email user updates account: agents moved, old user deleted", async () => {
      // Admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // 1) Create legacy-ish user A with a known wallet and an agent
      const legacyWallet = generateRandomEthAddress();
      const legacyEmail = `legacy-${Date.now()}@example.com`;
      const legacyData = (await adminClient.registerUser({
        walletAddress: legacyWallet,
        name: "Legacy User",
        email: legacyEmail,
        agentName: "Legacy Agent",
      })) as UserRegistrationResponse;
      expect(legacyData.success).toBe(true);
      expect(legacyData.user.walletAddress).toBe(legacyWallet);
      expect(legacyData.user.email).toBe(legacyEmail);
      // Privy info should not exist
      expect(legacyData.user.privyId).toBeUndefined();

      const legacyUserId = legacyData.user.id;
      expect(legacyData.agent).toBeDefined();
      const legacyAgentId = legacyData.agent!.id;

      // 2) Create a new Privy-authenticated user B
      // This user will have the same wallet + email as the legacy user
      const { user: newUser } = await createPrivyAuthenticatedRpcClient({
        userName: "Privy Merge Target",
        userEmail: legacyEmail,
        walletAddress: legacyWallet,
      });
      expect(newUser.email).toBe(legacyEmail);
      expect(newUser.walletAddress).toBe(legacyWallet);

      // 3) Simulate linking legacy wallet in Privy and call link endpoint
      const privyUser = createTestPrivyUser({
        privyId: newUser.privyId || undefined,
        name: newUser.name,
        email: newUser.email,
        walletAddress: newUser.walletAddress,
        provider: "email",
      });
      const updatedToken = await createMockPrivyToken(privyUser, {
        newLinkedWallets: [legacyWallet],
      });
      const updatedRpcClient = await createTestRpcClient(updatedToken);
      const linkedUser = await updatedRpcClient.user.linkWallet({
        walletAddress: legacyWallet,
      });
      expect(linkedUser.walletAddress).toBe(legacyWallet);
      expect(linkedUser.id).toBe(legacyUserId);

      // 4) Verify migrations
      // - Agent owner moved to new user
      const agentAfter = await db
        .select()
        .from(agents)
        .where(eq(agents.id, legacyAgentId));
      expect(agentAfter[0]).toBeDefined();
      expect(agentAfter[0]?.ownerId).toBe(linkedUser.id);

      // - "Old" user is not deleted (it was updated instead)
      const oldUserRows = await db
        .select()
        .from(users)
        .where(eq(users.id, legacyUserId));
      expect(oldUserRows.length).toBe(1);
      expect(oldUserRows[0]?.id).toBe(legacyUserId);
    });
  });
});
