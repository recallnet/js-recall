import { NextFunction, Request, Response } from "express";

import { ApiError } from "@/middleware/errorHandler.js";
import { ServiceRegistry } from "@/services/index.js";
import { LeaderboardParamsSchema } from "@/types/index.js";

export function makeLeaderboardController(services: ServiceRegistry) {
  /**
   * Leaderboard Controller
   * Handles global leaderboard operations.
   */

  return {
    /**
     * Get global leaderboard across all relevant competitions.
     * This endpoint is publicly accessible for read-only purposes.
     * @param req Request object (authentication is optional for this endpoint)
     * @param res Express response object
     * @param next Express next function
     */
    async getGlobalLeaderboard(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      try {
        // Validate query parameters
        const { success, data, error } = LeaderboardParamsSchema.safeParse(
          req.query,
        );
        if (!success) {
          throw new ApiError(400, `Invalid request format: ${error.message}`);
        }

        // Get leaderboard data with sorting from service layer
        const result =
          await services.leaderboardService.getGlobalLeaderboardWithSorting(
            data,
          );

        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },
  };
}

export type LeaderboardController = ReturnType<
  typeof makeLeaderboardController
>;
