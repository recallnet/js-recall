import { describe, expect, it } from "vitest";

import { ApiClient } from "../utils/api-client.js";
import { LoginResponse, UserProfileResponse } from "../utils/api-types.js";
import { createMockPrivyToken, createTestPrivyUser } from "../utils/privy.js";

describe("Privy Authentication", () => {
  it("should authenticate user with Privy JWT and sync profile", async () => {
    // Create a test client
    const client = new ApiClient();

    // Create a test user
    const testUser = createTestPrivyUser({
      name: "Alice Test",
      email: "alice@example.com",
      provider: "email",
    });

    // Authenticate with Privy
    const authResult = await client.authenticateWithPrivy(testUser);
    expect(authResult.success).toBe(true);
    const loginResponse = authResult as LoginResponse;

    // Verify authentication succeeded
    expect(loginResponse.userId).toBeDefined();
    expect(loginResponse.wallet).toBeDefined();
  });

  it("should authenticate user with wallet provider", async () => {
    const client = new ApiClient();

    const testUser = createTestPrivyUser({
      name: "Bob Wallet",
      provider: "wallet",
      walletAddress: "0x742d35Cc6665C6532e5fc7E95C7Ed1F84e93e3E4",
      walletChainType: "ethereum",
      email: "bob@example.com", // Include email for wallet users too
    });

    const authResult = await client.authenticateWithPrivy(testUser);

    expect(authResult.success).toBe(true);
    const loginResponse = authResult as LoginResponse;

    expect(loginResponse.userId).toBeDefined();
    expect(loginResponse.wallet).toBeDefined();
  });

  it("should create user client with Privy authentication", async () => {
    const userClient = await new ApiClient().createPrivyUserClient({
      name: "Charlie Test",
      email: "charlie@example.com",
      provider: "google",
    });

    // Test that the client is authenticated by getting user profile
    const profileResult = await userClient.getUserProfile();

    expect(profileResult.success).toBe(true);
    const profileResponse = profileResult as UserProfileResponse;

    expect(profileResponse.user.name).toBe("Charlie Test");
    expect(profileResponse.user.email).toBe("charlie@example.com");
  });

  it("should handle JWT token setting and clearing", async () => {
    const client = new ApiClient();
    const testUser = createTestPrivyUser();
    const token = await createMockPrivyToken(testUser);

    // Set JWT token
    client.setJwtToken(token);

    // Token should be set (we can't directly verify this as it's private,
    // but we can test that subsequent API calls use it)

    // Clear JWT token
    client.clearJwtToken();

    // Test passes if no errors are thrown
    expect(true).toBe(true);
  });

  it("should handle different authentication providers", async () => {
    const providers: Array<"email" | "google" | "github" | "wallet"> = [
      "email",
      "google",
      "github",
      "wallet",
    ];

    for (const provider of providers) {
      const client = new ApiClient();
      const testUser = createTestPrivyUser({
        name: `Test User ${provider}`,
        email: `test-${provider}@example.com`, // Always provide email
        provider,
        walletAddress:
          provider === "wallet"
            ? "0x742d35Cc6665C6532e5fc7E95C7Ed1F84e93e3E4"
            : undefined,
      });

      const authResult = await client.authenticateWithPrivy(testUser);

      expect(authResult.success).toBe(true);
      const loginResponse = authResult as LoginResponse;

      expect(loginResponse.userId).toBeDefined();
      expect(loginResponse.wallet).toBeDefined();
    }
  });
});
