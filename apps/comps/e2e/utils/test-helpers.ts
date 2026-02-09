/**
 * Comps app specific test helpers
 * Extends base test-utils with RPC client functionality
 */
import type { RouterClient } from "@orpc/server";

import { MockPrivyClient } from "@recallnet/services/lib";
import {
  registerUserAndAgentAndGetClient as baseRegisterUserAndAgentAndGetClient,
  createMockPrivyToken,
  createTestPrivyUser,
  generateRandomEthAddress,
  generateRandomPrivyId,
  generateTestHandle,
} from "@recallnet/test-utils";

import { router } from "../../rpc/router/index.js";
import { createTestRpcClient } from "./rpc-client-helpers.js";

/**
 * Create a test agent with automatic unique handle generation
 */
export async function createTestAgent(
  rpcClient: RouterClient<typeof router>,
  name: string,
  description?: string,
  imageUrl?: string,
  metadata?: Record<string, unknown>,
  handle?: string,
) {
  // Generate a unique handle if not provided
  const agentHandle =
    handle ||
    generateTestHandle(
      name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 8),
    );

  return rpcClient.user.createAgent({
    name,
    handle: agentHandle,
    description,
    imageUrl,
    metadata,
  });
}

/**
 * Register a user and agent via admin API, return both HTTP and RPC clients
 * Extends the base helper to include RPC client for comps tests
 */
export async function registerUserAndAgentAndGetRpcClient(params: {
  adminApiKey: string;
  userName?: string;
  userEmail?: string;
  agentName?: string;
  agentHandle?: string;
  walletAddress?: string;
  embeddedWalletAddress?: string;
  privyId?: string;
  agentDescription?: string;
  agentImageUrl?: string;
  agentMetadata?: Record<string, unknown>;
  agentWalletAddress?: string;
  userImageUrl?: string;
}) {
  // Call base helper to register via admin API
  const result = await baseRegisterUserAndAgentAndGetClient(params);

  // Create Privy token for the user
  const privyUser = createTestPrivyUser({
    privyId: result.user.privyId,
    name: result.user.name || undefined,
    email: result.user.email || undefined,
    walletAddress: result.user.walletAddress,
    provider: "email",
  });
  const privyToken = await createMockPrivyToken(privyUser);

  // Create RPC client with user's Privy token
  const rpcClient = await createTestRpcClient(privyToken);

  return {
    ...result,
    rpcClient,
  };
}

/**
 * Create a Privy-authenticated RPC client for testing user routes
 * Generates a unique test user and returns an RPC client with an active Privy session
 *
 * For wallet-first users, pass `provider: "wallet"`.
 * This simulates a user logging in with their external wallet (no email).
 */
export async function createPrivyAuthenticatedRpcClient(params: {
  userName?: string;
  userEmail?: string;
  walletAddress?: string;
  embeddedWalletAddress?: string;
  privyId?: string;
  provider?: "email" | "google" | "github" | "wallet";
}) {
  const provider = params.provider || "email";
  const isWalletFirst = provider === "wallet";
  const uniquePrivyId = params.privyId || generateRandomPrivyId();
  const timestamp = Date.now();

  // Wallet-first users don't have emails
  const uniqueUserEmail = isWalletFirst
    ? undefined
    : params.userEmail || `privy-user-${timestamp}@test.com`;

  // For wallet-first, walletAddress is their external wallet
  // For email-first, walletAddress defaults to embedded (unless linking external)
  const externalWallet = isWalletFirst
    ? params.walletAddress || generateRandomEthAddress()
    : params.walletAddress;

  const privyUser = createTestPrivyUser({
    privyId: uniquePrivyId,
    name: params.userName ?? undefined,
    email: uniqueUserEmail,
    walletAddress: externalWallet,
    provider,
  });
  const privyToken = await createMockPrivyToken(privyUser);
  const rpcClient = await createTestRpcClient(privyToken);
  let user = await rpcClient.user.login();

  if (params.userName) {
    user = await rpcClient.user.updateProfile({
      name: params.userName,
    });
  }

  // Link custom wallet if provided (only for non-wallet-first users)
  if (!isWalletFirst && params.walletAddress) {
    MockPrivyClient.linkWallet(uniquePrivyId, params.walletAddress);
    user = await rpcClient.user.linkWallet({
      walletAddress: params.walletAddress,
    });
  }

  const finalWalletAddress = user.walletAddress!;

  return {
    rpcClient,
    user: {
      id: user.id,
      walletAddress: finalWalletAddress,
      embeddedWalletAddress: user.embeddedWalletAddress,
      walletLastVerifiedAt: user.walletLastVerifiedAt,
      privyId: user.privyId,
      name: user.name || params.userName,
      email: user.email || uniqueUserEmail,
      imageUrl: user.imageUrl,
      status: user.status,
      metadata: user.metadata,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt || new Date().toISOString(),
    },
    wallet: finalWalletAddress,
  };
}
