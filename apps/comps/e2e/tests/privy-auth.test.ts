import { describe, expect, test } from "vitest";

import {
  createMockPrivyToken,
  createTestPrivyUser,
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
});
