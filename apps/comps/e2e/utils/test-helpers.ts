/**
 * Comps app specific test helpers
 * Extends base test-utils with RPC client functionality
 */
import type { RouterClient } from "@orpc/server";

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
 */
export async function createPrivyAuthenticatedRpcClient(params: {
  userName?: string;
  userEmail?: string;
  walletAddress?: string;
  embeddedWalletAddress?: string;
  privyId?: string;
}) {
  // Generate unique wallet and IDs
  const testEmbeddedWallet =
    params.embeddedWalletAddress || generateRandomEthAddress();
  const uniquePrivyId = params.privyId || generateRandomPrivyId();
  const timestamp = Date.now();
  const uniqueUserEmail =
    params.userEmail || `privy-user-${timestamp}@test.com`;

  // Create Privy user and token
  const privyUser = createTestPrivyUser({
    privyId: uniquePrivyId,
    name: params.userName ?? undefined,
    email: uniqueUserEmail,
    walletAddress: params.walletAddress || testEmbeddedWallet,
    provider: "email",
  });
  const privyToken = await createMockPrivyToken(privyUser);

  // Create RPC client with Privy auth
  const rpcClient = await createTestRpcClient(privyToken);

  // Login to create/update user
  let user = await rpcClient.user.login();

  // Update name if provided
  if (params.userName) {
    user = await rpcClient.user.updateProfile({ name: params.userName });
  }

  // Add a small delay to ensure session is properly saved
  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    rpcClient,
    user: {
      id: user.id,
      walletAddress: user.walletAddress || testEmbeddedWallet,
      embeddedWalletAddress: user.embeddedWalletAddress || testEmbeddedWallet,
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
    wallet: user.walletAddress || testEmbeddedWallet,
  };
}
