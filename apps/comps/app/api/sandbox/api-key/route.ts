import { NextRequest } from "next/server";

import {
  extractSessionCookie,
  sandboxAdminRequest,
} from "@/app/api/sandbox/_lib/sandbox-config";
import {
  createSuccessResponse,
  withErrorHandling,
} from "@/app/api/sandbox/_lib/sandbox-response";
import { AdminAgentKeyResponse, AdminSearchResult } from "@/types";

/**
 * GET /api/sandbox/api-key?name={agentName}
 * Retrieves an agent's API key from the sandbox by:
 * 1. Finding the agent's ID in the sandbox using its handle (globally unique)
 * 2. Getting the agent's API key
 */
async function handleGetAgentApiKey(request: NextRequest) {
  // Extract session cookie
  const sessionCookie = extractSessionCookie(request);
  if (!sessionCookie) {
    throw new Error("Authentication required");
  }

  // Get agent handle from query parameters
  const { searchParams } = new URL(request.url);
  const agentHandle = searchParams.get("handle");
  if (!agentHandle) {
    throw new Error("Agent handle is required");
  }

  // Find the agent's ID in the sandbox using its handle
  const searchData = await sandboxAdminRequest<AdminSearchResult>(
    `/admin/search?agent.handle=${encodeURIComponent(agentHandle)}`,
  );

  // Check if agent exists in sandbox
  if (searchData.results.agents.length === 0) {
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
