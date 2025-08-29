import axios from "axios";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { beforeEach, describe, expect, test } from "vitest";

import { emailVerificationTokens } from "@recallnet/db-schema/core/defs";

import { config } from "@/config/index.js";
import { db } from "@/database/db.js";
import { findById as findAgentById } from "@/database/repositories/agent-repository.js";
import {
  createEmailVerificationToken,
  markTokenAsUsed,
} from "@/database/repositories/email-verification-repository.js";
import { findById as findUserById } from "@/database/repositories/user-repository.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
} from "@/e2e/utils/test-helpers.js";
import { ServiceRegistry } from "@/services/index.js";

describe("Email Verification API", () => {
  let adminApiKey: string;

  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
  });

  test("should verify a valid token for a user", async () => {
    // Register a user with email
    const userEmail = `user-${Date.now()}@example.com`;
    const { user } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      userEmail,
    });

    // Ensure user's email is not verified initially
    const initialUser = await findUserById(user.id);
    expect(initialUser?.isEmailVerified).toBe(false);

    // Get token by user id
    const tokens = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, user.id))
      .limit(1);

    const token = tokens[0]?.token;
    expect(token).toBeDefined();

    // Verify the token
    const verifyResponse = await axios.get(
      `${getBaseUrl()}/api/verify-email?token=${token}`,
      {
        maxRedirects: 0,
        validateStatus: null,
      },
    );

    // Should redirect to verify-email page with success message
    expect(verifyResponse.status).toBe(302);
    expect(verifyResponse.headers["location"]).toContain(
      `${config.app.url}/verify-email?success=true`,
    );
    expect(verifyResponse.headers["location"]).toContain(
      "message=Email%20verified%20successfully",
    );

    // Check that user's email is now verified
    const updatedUser = await findUserById(user.id);
    expect(updatedUser?.isEmailVerified).toBe(true);
  });

  test("should verify a valid token for an agent", async () => {
    // Register a user and agent
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });

    // Set agent email using agent manager service
    const agentEmail = `agent-${Date.now()}@example.com`;
    const agentManager = ServiceRegistry.getInstance().agentManager;

    const secondAgent = await agentManager.createAgent({
      ownerId: agent.ownerId,
      name: "Second Agent",
      handle: "second_agent",
      email: agentEmail,
    });

    // Ensure agent's email is not verified initially
    expect(secondAgent.isEmailVerified).toBe(false);

    const tokens = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.agentId, secondAgent.id))
      .limit(1);

    const token = tokens[0]?.token;
    expect(token).toBeDefined();

    // Verify the token
    const verifyResponse = await axios.get(
      `${getBaseUrl()}/api/verify-email?token=${token}`,
      {
        maxRedirects: 0,
        validateStatus: null,
      },
    );

    // Should redirect to verify-email page with success message
    expect(verifyResponse.status).toBe(302);
    expect(verifyResponse.headers["location"]).toContain(
      `${config.app.url}/verify-email?success=true`,
    );
    expect(verifyResponse.headers["location"]).toContain(
      "message=Email%20verified%20successfully",
    );

    // Check that agent's email is now verified
    const updatedAgent = await findAgentById(secondAgent.id);
    expect(updatedAgent?.isEmailVerified).toBe(true);
  });

  test("should handle invalid tokens", async () => {
    // Try to verify a non-existent token
    const invalidToken = "non-existent-token";
    const verifyResponse = await axios.get(
      `${getBaseUrl()}/api/verify-email?token=${invalidToken}`,
      {
        maxRedirects: 0,
        validateStatus: null,
      },
    );

    // Should redirect to verify-email page with error message
    expect(verifyResponse.status).toBe(302);
    expect(verifyResponse.headers["location"]).toContain(
      `${config.app.url}/verify-email?success=false`,
    );
    expect(verifyResponse.headers["location"]).toContain(
      "message=Invalid%20verification%20token",
    );
  });

  test("should handle expired tokens", async () => {
    // Register a user with email
    const userEmail = `expired-${Date.now()}@example.com`;
    const { user } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      userEmail,
    });

    // Create an expired verification token
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() - 1); // 1 hour in the past

    await createEmailVerificationToken({
      id: uuidv4(),
      userId: user.id,
      token,
      expiresAt,
    });

    // Try to verify the expired token
    const verifyResponse = await axios.get(
      `${getBaseUrl()}/api/verify-email?token=${token}`,
      {
        maxRedirects: 0,
        validateStatus: null,
      },
    );

    // Should redirect to verify-email page with error message
    expect(verifyResponse.status).toBe(302);
    expect(verifyResponse.headers["location"]).toContain(
      `${config.app.url}/verify-email?success=false`,
    );
    expect(verifyResponse.headers["location"]).toContain(
      "message=Token%20has%20expired",
    );

    // Check that user's email is still not verified
    const updatedUser = await findUserById(user.id);
    expect(updatedUser?.isEmailVerified).toBe(false);
  });

  test("should handle already used tokens", async () => {
    // Register a user with email
    const userEmail = `used-token-${Date.now()}@example.com`;
    const { user } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      userEmail,
    });

    // Get token by user id
    const tokens = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, user.id))
      .limit(1);

    // Mark the token as used
    await markTokenAsUsed(tokens[0]!.id);

    // Try to verify the used token
    const verifyResponse = await axios.get(
      `${getBaseUrl()}/api/verify-email?token=${tokens[0]!.token}`,
      {
        maxRedirects: 0,
        validateStatus: null,
      },
    );

    // Should redirect to verify-email page with error message
    expect(verifyResponse.status).toBe(302);
    expect(verifyResponse.headers["location"]).toContain(
      `${config.app.url}/verify-email?success=false`,
    );
    expect(verifyResponse.headers["location"]).toContain(
      "message=Token%20has%20already%20been%20used",
    );

    // Check that user's email is still not verified
    const updatedUser = await findUserById(user.id);
    expect(updatedUser?.isEmailVerified).toBe(false);
  });

  test("should handle token with no association", async () => {
    // Create a token with neither userId nor agentId
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours from now

    await createEmailVerificationToken({
      id: uuidv4(),
      token,
      expiresAt,
    });

    // Try to verify the token
    const verifyResponse = await axios.get(
      `${getBaseUrl()}/api/verify-email?token=${token}`,
      {
        maxRedirects: 0,
        validateStatus: null,
      },
    );

    // Should redirect to verify-email page with error message
    expect(verifyResponse.status).toBe(302);
    expect(verifyResponse.headers["location"]).toContain(
      `${config.app.url}/verify-email?success=false`,
    );
    expect(verifyResponse.headers["location"]).toContain(
      "message=Token%20is%20not%20associated%20with%20a%20user%20or%20agent",
    );
  });

  test("should handle missing token parameter", async () => {
    // Try to verify without providing a token
    const verifyResponse = await axios.get(`${getBaseUrl()}/api/verify-email`, {
      maxRedirects: 0,
      validateStatus: null,
    });

    // Should redirect to verify-email page with error message
    expect(verifyResponse.status).toBe(302);
    expect(verifyResponse.headers["location"]).toContain(
      `${config.app.url}/verify-email?success=false`,
    );
    expect(verifyResponse.headers["location"]).toContain(
      "message=Token%20is%20required",
    );
  });

  test("should send new verification email when user email is updated", async () => {
    // Register a user with initial email
    const initialEmail = `initial-${Date.now()}@example.com`;
    const { user } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      userEmail: initialEmail,
    });

    // Verify the initial email
    const initialTokens = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, user.id))
      .limit(1);

    const initialToken = initialTokens[0]?.token;
    expect(initialToken).toBeDefined();

    // Verify the initial token
    await axios.get(`${getBaseUrl()}/api/verify-email?token=${initialToken}`, {
      maxRedirects: 0,
      validateStatus: null,
    });

    // Check that user's email is now verified
    let updatedUser = await findUserById(user.id);
    expect(updatedUser?.isEmailVerified).toBe(true);

    // Update the user's email
    const newEmail = `updated-${Date.now()}@example.com`;
    const userManager = ServiceRegistry.getInstance().userManager;

    await userManager.updateUser({
      id: user.id,
      email: newEmail,
    });

    // Check that user's email verification status is reset
    updatedUser = await findUserById(user.id);
    expect(updatedUser?.email).toBe(newEmail);
    expect(updatedUser?.isEmailVerified).toBe(false);

    // Check that a new verification token was created
    const allTokens = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, user.id));

    // Sort tokens by createdAt in descending order and get the most recent one
    const sortedTokens = [...allTokens].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const newToken = sortedTokens[0]?.token;
    expect(newToken).toBeDefined();
    expect(newToken).not.toBe(initialToken);

    // Verify the new token
    const verifyResponse = await axios.get(
      `${getBaseUrl()}/api/verify-email?token=${newToken}`,
      {
        maxRedirects: 0,
        validateStatus: null,
      },
    );

    // Should redirect to verify-email page with success message
    expect(verifyResponse.status).toBe(302);
    expect(verifyResponse.headers["location"]).toContain(
      `${config.app.url}/verify-email?success=true`,
    );
    expect(verifyResponse.headers["location"]).toContain(
      "message=Email%20verified%20successfully",
    );

    // Check that user's email is verified again
    updatedUser = await findUserById(user.id);
    expect(updatedUser?.isEmailVerified).toBe(true);
  });

  test("should send new verification email when agent email is updated", async () => {
    // Register a user and agent
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });

    // Set agent email using agent manager service
    const initialEmail = `agent-initial-${Date.now()}@example.com`;
    const agentManager = ServiceRegistry.getInstance().agentManager;

    const testAgent = await agentManager.createAgent({
      ownerId: agent.ownerId,
      name: "Test Agent For Email Update",
      handle: "test_agentemail",
      email: initialEmail,
    });

    // Ensure agent's email is not verified initially
    expect(testAgent.isEmailVerified).toBe(false);

    // Get initial verification token
    const initialTokens = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.agentId, testAgent.id))
      .limit(1);

    const initialToken = initialTokens[0]?.token;
    expect(initialToken).toBeDefined();

    // Verify the initial token
    await axios.get(`${getBaseUrl()}/api/verify-email?token=${initialToken}`, {
      maxRedirects: 0,
      validateStatus: null,
    });

    // Check that agent's email is now verified
    let updatedAgent = await findAgentById(testAgent.id);
    expect(updatedAgent?.isEmailVerified).toBe(true);

    // Update the agent's email
    const newEmail = `agent-updated-${Date.now()}@example.com`;
    await agentManager.updateAgent({
      ...testAgent,
      email: newEmail,
    });

    // Check that agent's email verification status is reset
    updatedAgent = await findAgentById(testAgent.id);
    expect(updatedAgent?.email).toBe(newEmail);
    expect(updatedAgent?.isEmailVerified).toBe(false);

    // Check that a new verification token was created
    const allTokens = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.agentId, testAgent.id));

    // Sort tokens by createdAt in descending order and get the most recent one
    const sortedTokens = [...allTokens].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const newToken = sortedTokens[0]?.token;
    expect(newToken).toBeDefined();
    expect(newToken).not.toBe(initialToken);

    // Verify the new token
    const verifyResponse = await axios.get(
      `${getBaseUrl()}/api/verify-email?token=${newToken}`,
      {
        maxRedirects: 0,
        validateStatus: null,
      },
    );

    // Should redirect to verify-email page with success message
    expect(verifyResponse.status).toBe(302);
    expect(verifyResponse.headers["location"]).toContain(
      `${config.app.url}/verify-email?success=true`,
    );
    expect(verifyResponse.headers["location"]).toContain(
      "message=Email%20verified%20successfully",
    );

    // Check that agent's email is verified again
    updatedAgent = await findAgentById(testAgent.id);
    expect(updatedAgent?.isEmailVerified).toBe(true);
  });
});
