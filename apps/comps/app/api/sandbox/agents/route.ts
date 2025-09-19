import { NextRequest } from "next/server";

import { getPrivyUserFromCookie } from "@/app/api/sandbox/_lib/privy-utils";
import { sandboxAdminRequest } from "@/app/api/sandbox/_lib/sandbox-config";
import {
  createSuccessResponse,
  withErrorHandling,
} from "@/app/api/sandbox/_lib/sandbox-response";
import { AdminCreateAgentResponse, CreateAgentRequest } from "@/types";

/**
 * POST /api/sandbox/agents
 * Creates an agent in the sandbox environment by:
 * 1. Fetching user profile from the base API using session cookie to get walletAddress
 * 2. Creating agent in sandbox using the admin API
 */
async function handleCreateAgent(request: NextRequest) {
  // Extract privy ID from cookie and reject if fully unauthenticated
  const privyUser = await getPrivyUserFromCookie(request);
  if (!privyUser) {
    throw new Error("Unauthorized");
  }
  const { walletAddress } = privyUser;
  // Get the agent payload from the request body
  const agentPayload: CreateAgentRequest = await request.json();
  if (!agentPayload.name) {
    throw new Error("Agent name is required");
  }

  // Prepare payload for sandbox admin API
  // Note: this will also update the user if it already exists, effectively handling any "sync"
  // issues between the production<>sandbox database and user state.
  const sandboxPayload = {
    user: {
      // Note: this is either the user's custom linked wallet or their embedded wallet
      walletAddress,
    },
    agent: {
      name: agentPayload.name,
      handle: agentPayload.handle,
      description: agentPayload.description,
      imageUrl: agentPayload.imageUrl,
      email: agentPayload.email,
      metadata: agentPayload.metadata,
    },
  };

  // Create agent in sandbox
  const createData = await sandboxAdminRequest<AdminCreateAgentResponse>(
    "/admin/agents",
    {
      method: "POST",
      body: JSON.stringify(sandboxPayload),
    },
  );

  return createSuccessResponse(createData);
}

export const POST = withErrorHandling(handleCreateAgent);
