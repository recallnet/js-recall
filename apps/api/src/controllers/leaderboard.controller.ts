import { NextFunction, Request, Response } from "express";
import { LRUCache } from "lru-cache";

import { ApiError, LeaderboardParamsSchema } from "@recallnet/services/types";

import { config } from "@/config/index.js";
import { ServiceRegistry } from "@/services/index.js";

import {
  checkShouldCacheResponse,
  generateCacheKey,
} from "./request-helpers.js";

/**
 * Cache for the `/leaderboard` endpoint (unauthenticated or authenticated user requests)
 */
const caches = {
  // Used for: `/leaderboard` (global leaderboard)
  global: new LRUCache<string, object>({
    max: config.cache.api.leaderboard.maxCacheSize,
    ttl: config.cache.api.leaderboard.ttlMs,
  }),
};

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

        // Cache only public (unauthenticated or authenticated user) requests
        const shouldCacheResponse = checkShouldCacheResponse(req);
        const cacheKey = generateCacheKey(req, "globalLeaderboard", {
          ...data,
        });
        if (shouldCacheResponse) {
          const cached = caches.global.get(cacheKey);
          if (cached) {
            return res.status(200).json(cached);
          }
        }

        // Get leaderboard data from service layer
        const result =
          await services.leaderboardService.getGlobalLeaderboardForType(data);

        const responseBody = {
          success: true,
          ...result,
        } as const;

        if (shouldCacheResponse) {
          caches.global.set(cacheKey, responseBody);
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

/**
 * Clear all leaderboard API caches
 */
export function clearLeaderboardApiCaches() {
  for (const cache of Object.values(caches)) cache.clear();
}
