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
import { JoinCompetitionResponse } from "@/types";
import { ProfileResponse } from "@/types/profile";

/**
 * POST /api/sandbox/competitions/:compId/agents/:agentId
 */
async function handleJoinCompetition(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string; compId: string }> },
) {
  const { agentId, compId } = await params;

  // First, verify user's email is verified in production (defense in depth)
  const sessionCookie = extractSessionCookie(request);
  const profileData = await mainApiRequest<ProfileResponse>(
    "/user/profile",
    sessionCookie,
  );

  if (!profileData.user.isEmailVerified) {
    throw new Error("Email verification required to join sandbox competitions");
  }

  const result = await sandboxAdminRequest<JoinCompetitionResponse>(
    `/admin/competitions/${compId}/agents/${agentId}`,
    { method: "POST" },
  );
  return createSuccessResponse(result);
}

export const POST = withErrorHandling(handleJoinCompetition);
