import { NextRequest } from "next/server";

import { sandboxAdminRequest } from "@/app/api/sandbox/_lib/sandbox-config";
import {
  createSuccessResponse,
  withErrorHandling,
} from "@/app/api/sandbox/_lib/sandbox-response";
import { AdminCreateAgentRequest, AdminCreateAgentResponse } from "@/types";

/**
 * POST /api/sandbox/agents
 * Creates an agent in the sandbox environment using the provided user and agent data
 */
async function handleCreateAgent(request: NextRequest) {
  // Get the payload from the request body
  const payload: AdminCreateAgentRequest = await request.json();

  // Validate the payload structure
  if (!payload.user?.walletAddress) {
    throw new Error("User wallet address is required");
  }
  if (!payload.agent?.name) {
    throw new Error("Agent name is required");
  }

  // Create agent in sandbox
  const createData = await sandboxAdminRequest<AdminCreateAgentResponse>(
    "/admin/agents",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  return createSuccessResponse(createData);
}

export const POST = withErrorHandling(handleCreateAgent);
