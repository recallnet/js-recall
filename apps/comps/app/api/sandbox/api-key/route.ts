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
  UserAgentsResponse,
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

  // Get user's agents from the base API to validate ownership
  const userAgentsData = await mainApiRequest<UserAgentsResponse>(
    "/user/agents?limit=100",
    sessionCookie,
  );

  // Validate that the agent name belongs to the logged-in user
  const userAgent = userAgentsData.agents.find(
    (agent) => agent.name === agentName,
  );
  if (!userAgent) {
    throw new Error("Agent not found or does not belong to user");
  }

  // Find the agent's ID in the sandbox using its name
  const searchData = await sandboxAdminRequest<AdminSearchResult>(
    `/admin/search?name=${encodeURIComponent(agentName)}&searchType=agents`,
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
