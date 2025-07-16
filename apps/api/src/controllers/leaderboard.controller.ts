import { NextFunction, Request, Response } from "express";

import { flatParse } from "@/lib/flat-parse.js";
import { ServiceRegistry } from "@/services/index.js";

import { LeaderboardParamsSchema } from "./leaderboard.schema.js";

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
        const params = flatParse(LeaderboardParamsSchema, req.query, "query");

        // Get leaderboard data with sorting from service layer
        const result =
          await services.leaderboardService.getGlobalLeaderboardWithSorting(
            params,
          );

        res.status(200).json({
          success: true,
          ...result,
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

export type LeaderboardController = ReturnType<
  typeof makeLeaderboardController
>;
