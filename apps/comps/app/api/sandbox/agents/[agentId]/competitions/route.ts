import { NextRequest } from "next/server";

import {
  isSandboxConfigured,
  sandboxAdminRequest,
} from "@/app/api/sandbox/_lib/sandbox-config";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
} from "@/app/api/sandbox/_lib/sandbox-response";
import { AgentCompetitionsResponse } from "@/types";

/**
 * GET /api/sandbox/agents/:agentId/competitions
 * Get competitions for a specific agent in sandbox
 */
async function handleGetAgentCompetitions(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  // Check if sandbox is configured
  if (!isSandboxConfigured()) {
    return createErrorResponse("Sandbox not configured", 503);
  }

  const { agentId } = await params;

  // Extract query parameters
  const { searchParams } = new URL(request.url);
  const queryString = searchParams.toString();
  const endpoint = `/agents/${agentId}/competitions${queryString ? `?${queryString}` : ""}`;

  const result = await sandboxAdminRequest<AgentCompetitionsResponse>(
    endpoint,
    { method: "GET" },
  );

  return createSuccessResponse(result);
}

export const GET = withErrorHandling(handleGetAgentCompetitions);
