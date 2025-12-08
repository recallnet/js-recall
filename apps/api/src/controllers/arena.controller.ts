import { NextFunction, Request, Response } from "express";
import { LRUCache } from "lru-cache";

import { ApiError, PagingParamsSchema } from "@recallnet/services/types";

import { config } from "@/config/index.js";
import { ServiceRegistry } from "@/services/index.js";

import {
  checkShouldCacheResponse,
  generateCacheKey,
} from "./request-helpers.js";

/**
 * Cache for arena endpoints
 */
const caches = {
  list: new LRUCache<string, object>({
    max: config.cache.api.competitions.maxCacheSize,
    ttl: config.cache.api.competitions.ttlMs,
  }),
  byId: new LRUCache<string, object>({
    max: config.cache.api.competitions.maxCacheSize,
    ttl: config.cache.api.competitions.ttlMs,
  }),
};

export function makeArenaController(services: ServiceRegistry) {
  /**
   * Arena Controller
   * Handles public arena operations
   */

  return {
    /**
     * List all arenas with pagination
     * @param req Request object
     * @param res Express response
     * @param next Express next function
     */
    async listArenas(req: Request, res: Response, next: NextFunction) {
      try {
        const pagingParams = PagingParamsSchema.parse(req.query);
        const nameFilter = req.query.name ? String(req.query.name) : undefined;

        // Check cache
        const shouldCacheResponse = checkShouldCacheResponse(req);
        const cacheKey = generateCacheKey(req, "arenaList", {
          ...pagingParams,
          name: nameFilter,
        });

        if (shouldCacheResponse) {
          const cached = caches.list.get(cacheKey);
          if (cached) {
            res.status(200).json(cached);
            return;
          }
        }

        const result = await services.arenaService.findAll(
          pagingParams,
          nameFilter,
        );

        const responseBody = {
          success: true,
          arenas: result.arenas,
          pagination: result.pagination,
        } as const;

        if (shouldCacheResponse) {
          caches.list.set(cacheKey, responseBody);
        }

        res.status(200).json(responseBody);
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get arena by ID
     * @param req Request object
     * @param res Express response
     * @param next Express next function
     */
    async getArena(req: Request, res: Response, next: NextFunction) {
      try {
        const arenaId = req.params.id;
        if (!arenaId) {
          throw new ApiError(400, "Arena ID is required");
        }

        // Check cache
        const shouldCacheResponse = checkShouldCacheResponse(req);
        const cacheKey = generateCacheKey(req, "arenaById", { id: arenaId });

        if (shouldCacheResponse) {
          const cached = caches.byId.get(cacheKey);
          if (cached) {
            res.status(200).json(cached);
            return;
          }
        }

        const arena = await services.arenaService.findById(arenaId);

        const responseBody = {
          success: true,
          arena,
        } as const;

        if (shouldCacheResponse) {
          caches.byId.set(cacheKey, responseBody);
        }

        res.status(200).json(responseBody);
      } catch (error) {
        next(error);
      }
    },
  };
}

export type ArenaController = ReturnType<typeof makeArenaController>;

/**
 * Clear all arena API caches
 */
export function clearArenaApiCaches() {
  for (const cache of Object.values(caches)) cache.clear();
}
