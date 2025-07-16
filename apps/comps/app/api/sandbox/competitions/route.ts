import {NextRequest} from "next/server";

import {
  sandboxAdminRequest,
} from "@/app/api/sandbox/_lib/sandbox-config";
import {
  createSuccessResponse,
  withErrorHandling,
} from "@/app/api/sandbox/_lib/sandbox-response";
import {
  CompetitionsResponse,
} from "@/types";

/**
 */
async function handleGetCompetitions(request: NextRequest) {
  const competitions = await sandboxAdminRequest<CompetitionsResponse>(
    `/competitions?status=active`
  );

  return createSuccessResponse(competitions);
}

export const GET = withErrorHandling(handleGetCompetitions);
