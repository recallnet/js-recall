/**
 * Comps app specific test helpers
 * Extends base test-utils with RPC client functionality
 */
import {
  registerUserAndAgentAndGetClient as baseRegisterUserAndAgentAndGetClient,
  createMockPrivyToken,
  createTestPrivyUser,
} from "@recallnet/test-utils";

import { createTestRpcClient } from "./rpc-client-helpers.js";

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
