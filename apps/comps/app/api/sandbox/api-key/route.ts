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
 * GET /api/sandbox/api-key?handle={agentHandle}
 * Retrieves an agent's API key from the sandbox by:
 * 1. Finding the agent's ID in the sandbox using its handle (globally unique)
 * 2. Verifying that the requester is the owner of the agent
 * 3. Getting the agent's API key
 */
async function handleGetAgentApiKey(request: NextRequest) {
  // Extract session cookie
  const sessionCookie = extractSessionCookie(request);
  if (!sessionCookie) {
    throw new Error("Authentication required");
  }

  // Fetch user profile from the base API
  const profileData = await mainApiRequest<ProfileResponse>(
    "/user/profile",
    sessionCookie,
  );
  const {
    user: { email, walletAddress },
  } = profileData;

  // Get agent handle from query parameters
  const { searchParams } = new URL(request.url);
  const agentHandle = searchParams.get("handle");
  if (!agentHandle) {
    throw new Error("Agent handle is required");
  }

  // Find the agent's ID in the sandbox using its handle
  // Note: We check if user already exists in sandbox with an email, else, wallet address. This helps
  // with Privy-related backwards compatibility. The user inclusion in the search query is
  // *important* to ensure that the requester is the owner of the agent, otherwise, the API key can
  // be leaked.
  let searchForUserWithAgent = await sandboxAdminRequest<AdminSearchResult>(
    `/admin/search?user.email=${encodeURIComponent(email)}&agent.handle=${agentHandle}&join=true`,
  );
  if (searchForUserWithAgent.results.agents.length === 0) {
    searchForUserWithAgent = await sandboxAdminRequest<AdminSearchResult>(
      `/admin/search?user.walletAddress=${walletAddress}&agent.handle=${agentHandle}&join=true`,
    );
  }
  // Since we used the `join=true` flag, we know that the user is the owner of the agent.
  if (!searchForUserWithAgent.results.agents.at(0)) {
    throw new Error("Agent not found in sandbox");
  }
  // Note: we can guarantee that the agent ID exists due to the check above
  const sandboxAgentId = searchForUserWithAgent.results.agents.at(0)?.id;

  // Get the agent's API key
  const apiKeyData = await sandboxAdminRequest<AdminAgentKeyResponse>(
    `/admin/agents/${sandboxAgentId}/key`,
  );

  return createSuccessResponse(apiKeyData);
}

export const GET = withErrorHandling(handleGetAgentApiKey);
