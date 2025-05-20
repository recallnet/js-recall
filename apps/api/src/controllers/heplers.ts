import { ApiError } from "@/middleware/errorHandler.js";
import { AuthenticatedRequest } from "@/types/index.js";

export function ensureReqTeam(
    req: AuthenticatedRequest,
    message: string
) {
    const teamId = req.teamId;

    // If no team ID, they can't be authenticated
    if (!teamId) {
      throw new ApiError(
        401,
        message,
      );
    }

    return teamId;
}
