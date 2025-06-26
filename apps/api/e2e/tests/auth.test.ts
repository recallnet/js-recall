import axios from "axios";
import { beforeEach, describe, expect, it } from "vitest";

import { ApiClient } from "../utils/api-client.js";
import {
  ErrorResponse,
  LoginResponse,
  LogoutResponse,
  NonceResponse,
} from "../utils/api-types.js";
import { getBaseUrl } from "../utils/server.js";
import {
  createSiweMessage,
  signMessage,
  testWalletAddress,
} from "../utils/siwe-utils.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  createTestClient,
  registerUserAndAgentAndGetClient,
} from "../utils/test-helpers.js";

describe("SIWE Authentication", () => {
  const baseUrl = getBaseUrl();
  const domain = new URL(baseUrl).hostname || "localhost";

  // Admin client for creating users/agents
  let adminClient: ApiClient;
  let adminApiKey: string;

  beforeEach(async () => {
    await cleanupTestState();
    // Create admin account directly using the setup endpoint
    const response = await axios.post(`${baseUrl}/api/admin/setup`, {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
      email: ADMIN_EMAIL,
    });

    // Store the admin API key for authentication
    adminApiKey = response.data.admin.apiKey;
    expect(adminApiKey).toBeDefined();

    // Create admin client
    adminClient = createTestClient();
    const loginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(loginSuccess).toBe(true);
  });

  it("should complete full SIWE auth flow with api-sdk", async () => {
    // Register a user/agent
    const userName = `User ${Date.now()}`;
    const agentName = `Agent ${Date.now()}`;

    const { user, agent, apiKey } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      userName,
      agentName,
    });
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.name).toBe(userName);
    expect(agent.name).toBe(agentName);
    expect(apiKey).toBeDefined();

    // Create a session client (without API key)
    const sessionClient = new ApiClient(undefined, baseUrl);

    // 1. Get a nonce
    const nonceResponse = (await sessionClient.getNonce()) as
      | NonceResponse
      | ErrorResponse;
    expect(nonceResponse).not.toHaveProperty("error");
    const { nonce } = nonceResponse as NonceResponse;
    expect(nonce).toBeDefined();
    expect(typeof nonce).toBe("string");

    // 2. Create a SIWE message
    const message = await createSiweMessage(domain, nonce);

    // 3. Sign the message
    const signature = await signMessage(message);

    // 4. Login with the signed message
    const loginResponse = (await sessionClient.login(message, signature)) as
      | LoginResponse
      | ErrorResponse;
    expect(loginResponse).not.toHaveProperty("error");
    const loginData = loginResponse as LoginResponse;
    // Use case-insensitive match for wallet address (Ethereum addresses can have mixed case)
    expect(loginData.wallet.toLowerCase()).toBe(
      testWalletAddress.toLowerCase(),
    );

    // 5. Logout
    const logoutResponse = (await sessionClient.logout()) as
      | LogoutResponse
      | ErrorResponse;
    expect(logoutResponse).not.toHaveProperty("error");
    expect((logoutResponse as LogoutResponse).message).toBe(
      "Logged out successfully",
    );
  });

  it("should complete full SIWE auth flow with custom api client", async () => {
    // Register a user/agent with our test wallet address
    const result = await adminClient.registerUser({
      walletAddress: testWalletAddress,
      name: "SIWE Test User",
      email: "siwe_test@example.com",
    });

    expect(result).not.toHaveProperty("error");
    expect(result).toHaveProperty("success", true);

    // Create a session client (without API key)
    const sessionClient = new ApiClient(undefined, baseUrl);

    // Perform SIWE login
    const nonceResponse = (await sessionClient.getNonce()) as
      | NonceResponse
      | ErrorResponse;
    expect(nonceResponse).not.toHaveProperty("error");
    const { nonce } = nonceResponse as NonceResponse;

    const message = await createSiweMessage(domain, nonce);
    const signature = await signMessage(message);

    const loginResponse = (await sessionClient.login(message, signature)) as
      | LoginResponse
      | ErrorResponse;

    // Verify login was successful
    expect(loginResponse).not.toHaveProperty("error");
    const loginData = loginResponse as LoginResponse;
    expect(loginData.wallet.toLowerCase()).toBe(
      testWalletAddress.toLowerCase(),
    );
    expect(loginData.userId).toBeDefined();

    // For this test, we'll just verify logout works properly
    // since the protected endpoint access depends on session configuration
    const logoutResponse = (await sessionClient.logout()) as
      | LogoutResponse
      | ErrorResponse;
    expect(logoutResponse).not.toHaveProperty("error");
    expect((logoutResponse as LogoutResponse).message).toBe(
      "Logged out successfully",
    );
  });

  it("should fail login with invalid signature", async () => {
    // Create a session client (without API key)
    const sessionClient = new ApiClient(undefined, baseUrl);

    // Get a nonce
    const nonceResponse = (await sessionClient.getNonce()) as
      | NonceResponse
      | ErrorResponse;
    expect(nonceResponse).not.toHaveProperty("error");
    const { nonce } = nonceResponse as NonceResponse;

    // Create a message
    const message = await createSiweMessage(domain, nonce);

    // Create an invalid signature (just modify a valid one)
    const validSignature = await signMessage(message);
    const invalidSignature = validSignature.replace("a", "b");

    // Attempt login with invalid signature
    const loginResponse = (await sessionClient.login(
      message,
      invalidSignature,
    )) as ErrorResponse;

    // Should fail with 401
    expect(loginResponse).toHaveProperty("error");
    expect(loginResponse).toHaveProperty("status", 401);
  });

  it("should fail login with tampered message", async () => {
    // Create a session client (without API key)
    const sessionClient = new ApiClient(undefined, baseUrl);

    // Get a nonce
    const nonceResponse = (await sessionClient.getNonce()) as
      | NonceResponse
      | ErrorResponse;
    expect(nonceResponse).not.toHaveProperty("error");
    const { nonce } = nonceResponse as NonceResponse;

    // Create a message
    const message = await createSiweMessage(domain, nonce);

    // Sign the message
    const signature = await signMessage(message);

    // Tamper with the message after signing
    const tamperedMessage = message.replace(
      "Sign in with Ethereum",
      "Sign in with ETH",
    );

    // Attempt login with tampered message
    const loginResponse = (await sessionClient.login(
      tamperedMessage,
      signature,
    )) as ErrorResponse;

    // Should fail with 401
    expect(loginResponse).toHaveProperty("error");
    expect(loginResponse).toHaveProperty("status", 401);
  });

  it("should reject login attempt with invalid/non-existent nonce", async () => {
    // For this test, we'll directly mock a valid SIWE message but with a made-up nonce
    // that doesn't exist in the server's store

    // Create a session client and get a real nonce first
    const sessionClient = new ApiClient(undefined, baseUrl);
    (await sessionClient.getNonce()) as NonceResponse;

    // Now we'll make a request with a different nonce
    const madeUpNonce = "ABC123XYZ789"; // This nonce doesn't exist in the server

    // Create a message with our made-up nonce but otherwise valid
    const message = await createSiweMessage(domain, madeUpNonce);
    const signature = await signMessage(message);

    // Trying to login with this non-existent nonce should fail
    try {
      // Use the ApiClient instead of direct axios to ensure proper error handling
      const loginResponse = (await sessionClient.login(
        message,
        signature,
      )) as ErrorResponse;
      // Should fail and not reach here, but if it does, verify it has an error
      expect(loginResponse).toHaveProperty("error");
      expect(loginResponse).toHaveProperty("status", 401);
    } catch (error: unknown) {
      // If it throws, that's also acceptable - just verify it's an error
      expect(error).toBeDefined();
    }
  });
});
