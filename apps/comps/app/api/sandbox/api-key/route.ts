import { NextRequest } from "next/server";

import {
  extractSessionCookie,
  mainApiRequest,
  sandboxAdminRequest,
} from "@/app/api/sandbox/_lib/sandbox-config";
import {
  createSuccessResponse,
  withErrorHandling,
} from "@/app/api/sandbox/_lib/sandbox-response";
import {
  AdminAgentKeyResponse,
  AdminSearchResult,
  ProfileResponse,
} from "@/types";

/**
 * GET /api/sandbox/api-key?name={agentName}
 * Retrieves an agent's API key from the sandbox by:
 * 1. Validating the agent name belongs to the logged-in user
 * 2. Finding the agent's ID in the sandbox using its name
 * 3. Getting the agent's API key
 */
async function handleGetAgentApiKey(request: NextRequest) {
  // Extract session cookie
  const sessionCookie = extractSessionCookie(request);

  // Get agent name from query parameters
  const { searchParams } = new URL(request.url);
  const agentName = searchParams.get("name");
  if (!agentName) {
    throw new Error("Agent name is required");
  }

  // Fetch user profile from the base API
  const profileData = await mainApiRequest<ProfileResponse>(
    "/user/profile",
    sessionCookie,
  );
  const { user } = profileData;
  const { walletAddress } = user;

  // Find the agent's ID in the sandbox using its name
  const searchData = await sandboxAdminRequest<AdminSearchResult>(
    `/admin/search?user.walletAddress=${walletAddress}&agent.name=${encodeURIComponent(agentName)}&join=true`,
  );

  // Check if agent exists in sandbox
  if (!searchData.results?.agents || searchData.results.agents.length === 0) {
    throw new Error("Agent not found in sandbox");
  }

  const sandboxAgent = searchData.results.agents[0];
  if (!sandboxAgent) {
    throw new Error("Agent not found in sandbox");
  }

  const agentId = sandboxAgent.id;

  // Get the agent's API key
  const apiKeyData = await sandboxAdminRequest<AdminAgentKeyResponse>(
    `/admin/agents/${agentId}/key`,
  );

  return createSuccessResponse(apiKeyData);
}

export const GET = withErrorHandling(handleGetAgentApiKey);
