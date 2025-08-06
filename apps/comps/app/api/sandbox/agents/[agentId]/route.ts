import { NextRequest } from "next/server";

import {
  extractSessionCookie,
  sandboxAdminRequest,
} from "@/app/api/sandbox/_lib/sandbox-config";
import {
  createSuccessResponse,
  withErrorHandling,
} from "@/app/api/sandbox/_lib/sandbox-response";
import { AdminAgentKeyResponse } from "@/types";

/**
 * PUT /api/sandbox/agents/[agentId]
 * Updates an agent in the sandbox environment using the admin API
 */
async function handleUpdateAgent(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  // Extract session cookie
  const sessionCookie = extractSessionCookie(request);
  if (!sessionCookie) {
    throw new Error("Authentication required");
  }

  // Get the agent ID from the route params
  const { agentId } = await params;

  // Get the update payload from the request body
  const updatePayload = await request.json();

  // Update agent in sandbox using the admin API
  const updateData = await sandboxAdminRequest<AdminAgentKeyResponse>(
    `/admin/agents/${agentId}`,
    {
      method: "PUT",
      body: JSON.stringify(updatePayload),
    },
  );

  return createSuccessResponse(updateData);
}

export const PUT = withErrorHandling(handleUpdateAgent);
