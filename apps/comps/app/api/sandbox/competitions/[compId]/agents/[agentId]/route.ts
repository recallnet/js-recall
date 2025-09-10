import { NextRequest } from "next/server";

import { sandboxAdminRequest } from "@/app/api/sandbox/_lib/sandbox-config";
import {
  createSuccessResponse,
  withErrorHandling,
} from "@/app/api/sandbox/_lib/sandbox-response";
import { JoinCompetitionResponse } from "@/types";

/**
 * POST /api/sandbox/competitions/:compId/agents/:agentId
 */
async function handleJoinCompetition(
  _: NextRequest,
  { params }: { params: Promise<{ agentId: string; compId: string }> },
) {
  const { agentId, compId } = await params;

  const result = await sandboxAdminRequest<JoinCompetitionResponse>(
    `/admin/competitions/${compId}/agents/${agentId}`,
    { method: "POST" },
  );
  return createSuccessResponse(result);
}

export const POST = withErrorHandling(handleJoinCompetition);
