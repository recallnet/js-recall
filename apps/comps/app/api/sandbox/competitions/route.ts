import {
  isSandboxConfigured,
  sandboxAdminRequest,
} from "@/app/api/sandbox/_lib/sandbox-config";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
} from "@/app/api/sandbox/_lib/sandbox-response";
import { CompetitionsResponse } from "@/types";

/**
 */
async function handleGetCompetitions() {
  // Check if sandbox is configured
  if (!isSandboxConfigured()) {
    return createErrorResponse("Sandbox not configured", 503);
  }

  const competitions = await sandboxAdminRequest<CompetitionsResponse>(
    `/competitions?status=active`,
  );

  return createSuccessResponse(competitions);
}

export const GET = withErrorHandling(handleGetCompetitions);
