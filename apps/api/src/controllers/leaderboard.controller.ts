import { NextFunction, Request, Response } from "express";
import { LRUCache } from "lru-cache";

import { config } from "@/config/index.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { ServiceRegistry } from "@/services/index.js";
import { LeaderboardParamsSchema } from "@/types/index.js";

import { checkIsCacheEnabled } from "./request-helpers.js";

export function makeLeaderboardController(services: ServiceRegistry) {
  /**
   * Leaderboard Controller
   * Handles global leaderboard operations.
   */

  // Simple in-memory cache for public/unauthenticated reads used by landing page
  const leaderboardCache = new LRUCache<string, object>({
    max: config.cache.api.leaderboard.maxCacheSize,
    ttl: config.cache.api.leaderboard.ttlMs,
  });

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

        // Build cache key from query params, only when cache is enabled
        const isCacheEnabled = checkIsCacheEnabled();
        const cacheKey = isCacheEnabled
          ? `global:${JSON.stringify(data)}`
          : null;

        if (cacheKey) {
          const cached = leaderboardCache.get(cacheKey);
          if (cached) {
            return res.status(200).json(cached);
          }
        }

        // Get leaderboard data with sorting from service layer
        const result =
          await services.leaderboardService.getGlobalLeaderboardWithSorting(
            data,
          );

        const responseBody = {
          success: true,
          ...result,
        } as const;

        // Cache the response for a short duration
        if (cacheKey) {
          leaderboardCache.set(cacheKey, responseBody);
        }

        res.status(200).json(responseBody);
      } catch (error) {
        next(error);
      }
    },
  };
}

export type LeaderboardController = ReturnType<
  typeof makeLeaderboardController
>;
