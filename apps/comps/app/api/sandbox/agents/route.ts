import { NextRequest } from "next/server";

import {
  extractSessionCookie,
  isSandboxConfigured,
  mainApiRequest,
  sandboxAdminRequest,
} from "@/app/api/sandbox/_lib/sandbox-config";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
} from "@/app/api/sandbox/_lib/sandbox-response";
import {
  AdminCreateAgentResponse,
  CreateAgentRequest,
  ProfileResponse,
} from "@/types";

/**
 * POST /api/sandbox/agents
 * Creates an agent in the sandbox environment by:
 * 1. Fetching user profile from the base API using session cookie to get walletAddress
 * 2. Creating agent in sandbox using the admin API
 */
async function handleCreateAgent(request: NextRequest) {
  // Check if sandbox is configured
  if (!isSandboxConfigured()) {
    return createErrorResponse("Sandbox not configured", 503);
  }

  // Extract session cookie
  const sessionCookie = extractSessionCookie(request);

  // Fetch user profile from the base API to get walletAddress
  const profileData = await mainApiRequest<ProfileResponse>(
    "/user/profile",
    sessionCookie,
  );
  const { walletAddress } = profileData.user;

  // Get the agent payload from the request body
  const agentPayload: CreateAgentRequest = await request.json();
  if (!agentPayload.name) {
    throw new Error("Agent name is required");
  }

  // Prepare payload for sandbox admin API
  const sandboxPayload = {
    user: {
      walletAddress,
    },
    agent: {
      name: agentPayload.name,
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
