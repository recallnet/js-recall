import { NextFunction, Response } from "express";
import { LRUCache } from "lru-cache";

import { ParsingError } from "@recallnet/db/errors";
import {
  AgentQuerySchema,
  ApiError,
  BucketParamSchema,
  CompetitionAgentParamsSchema,
  CompetitionStatusSchema,
  PagingParamsSchema,
} from "@recallnet/services/types";

import { config } from "@/config/index.js";
import { competitionLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";
import { AuthenticatedRequest } from "@/types/index.js";

import {
  buildPaginationResponse,
  checkShouldCacheResponse,
  generateCacheKey,
} from "./request-helpers.js";
import { checkIsAdmin, ensureUuid } from "./request-helpers.js";

export function makeCompetitionController(services: ServiceRegistry) {
  /**
   * Competition Controller
   * Handles competition-related operations
   */

  const caches = {
    list: new LRUCache<string, object>({
      max: config.cache.api.competitions.maxCacheSize,
      ttl: config.cache.api.competitions.ttlMs,
    }),
    rules: new LRUCache<string, object>({
      max: config.cache.api.competitions.maxCacheSize,
      ttl: config.cache.api.competitions.ttlMs,
    }),
    byId: new LRUCache<string, object>({
      max: config.cache.api.competitions.maxCacheSize,
      ttl: config.cache.api.competitions.ttlMs,
    }),
    agents: new LRUCache<string, object>({
      max: config.cache.api.competitions.maxCacheSize,
      ttl: config.cache.api.competitions.ttlMs,
    }),
    timeline: new LRUCache<string, object>({
      max: config.cache.api.competitions.maxCacheSize,
      ttl: config.cache.api.competitions.ttlMs,
    }),
    trades: new LRUCache<string, object>({
      max: config.cache.api.competitions.maxCacheSize,
      ttl: config.cache.api.competitions.ttlMs,
    }),
    agentTrades: new LRUCache<string, object>({
      max: config.cache.api.competitions.maxCacheSize,
      ttl: config.cache.api.competitions.ttlMs,
    }),
    leaderboard: new LRUCache<string, object>({
      max: config.cache.api.competitions.maxCacheSize,
      ttl: config.cache.api.competitions.ttlMs,
    }),
    perpsStats: new LRUCache<string, object>({
      max: config.cache.api.competitions.maxCacheSize,
      ttl: config.cache.api.competitions.ttlMs,
    }),
  };

  return {
    /**
     * Get competition leaderboard
     * Available to admins and competition participants
     * @param req AuthenticatedRequest object with agent authentication information
     * @param res Express response object
     * @param next Express next function
     */
    async getLeaderboard(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const competitionId = req.query.competitionId as string;
        const agentId = req.agentId;
        const isAdmin = req.isAdmin === true;

        // Check cache
        const shouldCacheResponse = checkShouldCacheResponse(req);
        const cacheKey = generateCacheKey(req, "leaderboard", {
          competitionId: competitionId || "active",
        });

        if (shouldCacheResponse) {
          const cached = caches.leaderboard.get(cacheKey);
          if (cached) {
            res.status(200).json(cached);
            return;
          }
        }

        const result =
          await services.competitionService.getLeaderboardWithAuthorization({
            competitionId,
            agentId,
            isAdmin,
          });

        // Cache the result
        if (shouldCacheResponse) {
          caches.leaderboard.set(cacheKey, result);
        }

        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get competition status (if there's an active competition)
     * @param req AuthenticatedRequest object with agent authentication information
     * @param res Express response object
     * @param next Express next function
     */
    async getStatus(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const agentId = req.agentId;
        const isAdmin = req.isAdmin === true;

        const result = await services.competitionService.getCompetitionStatus(
          agentId,
          isAdmin,
        );

        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get competition rules
     * @param req AuthenticatedRequest object with agent authentication information
     * @param res Express response object
     * @param next Express next function
     */
    async getRules(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const agentId = req.agentId;
        const isAdmin = req.isAdmin === true;

        // Check cache
        const shouldCacheResponse = checkShouldCacheResponse(req);
        const cacheKey = generateCacheKey(req, "rules", {});

        if (shouldCacheResponse) {
          const cached = caches.rules.get(cacheKey);
          if (cached) {
            res.status(200).json(cached);
            return;
          }
        }

        const result = await services.competitionService.getCompetitionRules({
          agentId,
          isAdmin,
        });

        // Cache the result
        if (shouldCacheResponse) {
          caches.rules.set(cacheKey, result);
        }

        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get upcoming competitions
     * @param req AuthenticatedRequest object with agent authentication information
     * @param res Express response object
     * @param next Express next function
     */
    async getUpcomingCompetitions(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const agentId = req.agentId;
        const isAdmin = req.isAdmin === true;

        const competitions =
          await services.competitionService.getUpcomingCompetitionsWithAuth(
            agentId,
            isAdmin,
          );

        res.status(200).json({
          success: true,
          competitions,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get competitions
     * @param req AuthenticatedRequest object with agent authentication information
     * @param res Express response
     * @param next Express next function
     */
    async getCompetitions(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const userId = req.userId;

        const status = req.query.status
          ? CompetitionStatusSchema.parse(req.query.status)
          : undefined;
        const pagingParams = PagingParamsSchema.parse(req.query);

        // Check cache
        const shouldCacheResponse = checkShouldCacheResponse(req);
        const cacheKey = generateCacheKey(req, "list", {
          status,
          ...pagingParams,
          // Include userId in cache key since response includes user-specific voting data
          ...(userId && { userId }),
        });

        if (shouldCacheResponse) {
          const cached = caches.list.get(cacheKey);
          if (cached) {
            res.status(200).json(cached);
            return;
          }
        }

        const result =
          await services.competitionService.getEnrichedCompetitions({
            status,
            pagingParams,
            userId,
          });

        // Cache the result
        if (shouldCacheResponse) {
          caches.list.set(cacheKey, result);
        }

        res.status(200).json(result);
      } catch (error) {
        next(
          error instanceof ParsingError
            ? new ApiError(400, error.message)
            : error,
        );
      }
    },

    /**
     * Get competition by ID
     * @param req AuthenticatedRequest object with agent authentication information
     * @param res Express response
     * @param next Express next function
     */
    async getCompetitionById(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const agentId = req.agentId;
        const userId = req.userId;
        const isAdmin = req.isAdmin === true;
        const competitionId = ensureUuid(req.params.competitionId);

        if (!competitionId) {
          throw new ApiError(400, "Competition ID is required");
        }

        // Authentication check
        if (isAdmin) {
          competitionLogger.debug(`Admin requesting competition details`);
        } else if (agentId) {
          competitionLogger.debug(
            `Agent ${agentId} requesting competition details`,
          );
        } else if (userId) {
          competitionLogger.debug(
            `User ${userId} requesting competition details`,
          );
        } else {
          competitionLogger.debug(
            `Unauthenticated request for competition details (public access)`,
          );
        }

        // Check cache
        const shouldCacheResponse = checkShouldCacheResponse(req);
        const cacheKey = generateCacheKey(req, "byId", {
          competitionId,
          // Include userId in cache key since response includes user-specific voting data
          ...(userId && { userId }),
        });

        if (shouldCacheResponse) {
          const cached = caches.byId.get(cacheKey);
          if (cached) {
            res.status(200).json(cached);
            return;
          }
        }

        const result = await services.competitionService.getCompetitionById({
          competitionId,
          userId,
          agentId,
          isAdmin,
        });

        // Cache the result
        if (shouldCacheResponse) {
          caches.byId.set(cacheKey, result);
        }

        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get agents participating in a competition
     * @param req AuthenticatedRequest object with agent authentication information
     * @param res Express response
     * @param next Express next function
     */
    // TODO: There are problems with post-processing sorting by rank or score: https://github.com/recallnet/js-recall/issues/620
    async getCompetitionAgents(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const agentId = req.agentId;
        const userId = req.userId;
        const isAdmin = checkIsAdmin(req);
        const competitionId = ensureUuid(req.params.competitionId);

        // Parse query parameters
        const parseQueryParams = AgentQuerySchema.safeParse(req.query);
        if (!parseQueryParams.success) {
          throw new ApiError(400, "Invalid request format");
        }
        const queryParams = parseQueryParams.data;

        // Authentication check
        if (isAdmin) {
          competitionLogger.debug(`Admin requesting competition agents`);
        } else if (agentId) {
          competitionLogger.debug(
            `Agent ${agentId} requesting competition agents`,
          );
        } else if (userId) {
          competitionLogger.debug(
            `User ${userId} requesting competition agents`,
          );
        } else {
          competitionLogger.debug(
            `Unauthenticated request for competition agents (public access)`,
          );
        }

        const result = await services.competitionService.getCompetitionAgents({
          competitionId,
          queryParams,
        });

        res.status(200).json({
          ...result,
          pagination: buildPaginationResponse(
            result.total,
            queryParams.limit,
            queryParams.offset,
          ),
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Join an agent to a competition
     * @param req AuthenticatedRequest with competitionId and agentId params
     * @param res Express response object
     * @param next Express next function
     */
    async joinCompetition(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        // Parse and validate URL parameters
        const params = CompetitionAgentParamsSchema.parse(req.params);
        const { competitionId, agentId } = params;

        // Call the service layer with authentication info
        await services.competitionService.joinCompetition(
          competitionId,
          agentId,
          req.userId,
          req.agentId,
        );

        // Clear the agents cache since the participant list has changed
        caches.agents.clear();

        res.status(200).json({
          success: true,
          message: "Successfully joined competition",
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Leave a competition
     * @param req AuthenticatedRequest with competitionId and agentId params
     * @param res Express response object
     * @param next Express next function
     */
    async leaveCompetition(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        // Parse and validate URL parameters
        const params = CompetitionAgentParamsSchema.parse(req.params);
        const { competitionId, agentId } = params;

        // Call the service layer with authentication info
        await services.competitionService.leaveCompetition(
          competitionId,
          agentId,
          req.userId,
          req.agentId,
        );

        // Clear the agents cache since the participant list has changed
        caches.agents.clear();

        res.status(200).json({
          success: true,
          message: "Successfully left competition",
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get competition timeline
     * @param req Request
     * @param res Express response object
     * @param next Express next function
     */
    async getCompetitionTimeline(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const competitionId = ensureUuid(req.params.competitionId);
        // Parse and validate bucket parameter (convert string to number)
        const bucket = BucketParamSchema.parse(req.query.bucket);

        const result = await services.competitionService.getCompetitionTimeline(
          competitionId,
          bucket,
        );

        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get competition rules by competition ID
     * Public endpoint that returns rules for any competition
     * @param req AuthenticatedRequest object (authentication optional)
     * @param res Express response object
     * @param next Express next function
     */
    async getCompetitionRules(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const competitionId = ensureUuid(req.params.competitionId);
        if (!competitionId) {
          throw new ApiError(400, "Competition ID is required");
        }

        const result =
          await services.competitionService.getRulesForSpecificCompetition(
            competitionId,
          );

        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get trades for a competition
     * @param req Request
     * @param res Express response object
     * @param next Express next function
     */
    async getCompetitionTrades(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const competitionId = ensureUuid(req.params.competitionId);
        const pagingParams = PagingParamsSchema.parse(req.query);

        const result = await services.competitionService.getCompetitionTrades({
          competitionId,
          pagingParams,
        });

        res.status(200).json({
          ...result,
          pagination: buildPaginationResponse(
            result.total,
            pagingParams.limit,
            pagingParams.offset,
          ),
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get trades for an agent in a competition
     * @param req Request
     * @param res Express response object
     * @param next Express next function
     */
    async getAgentTradesInCompetition(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const { competitionId, agentId } = CompetitionAgentParamsSchema.parse(
          req.params,
        );
        const pagingParams = PagingParamsSchema.parse(req.query);

        const result =
          await services.competitionService.getAgentTradesInCompetition({
            competitionId,
            agentId,
            pagingParams,
          });

        res.status(200).json({
          ...result,
          pagination: buildPaginationResponse(
            result.total,
            pagingParams.limit,
            pagingParams.offset,
          ),
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get perps positions for an agent in a competition
     * @param req Request
     * @param res Express response object
     * @param next Express next function
     */
    async getAgentPerpsPositionsInCompetition(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        // Get competition ID and agent ID from path parameters
        const { competitionId, agentId } = CompetitionAgentParamsSchema.parse(
          req.params,
        );

        // Check if competition exists
        const competition =
          await services.competitionService.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Check if this is a perps competition
        if (competition.type !== "perpetual_futures") {
          throw new ApiError(
            400,
            "This endpoint is only available for perpetual futures competitions. " +
              "Use GET /api/competitions/{id}/agents/{agentId}/trades for paper trading competitions.",
          );
        }

        // Check if agent exists
        const agent = await services.agentService.getAgent(agentId);
        if (!agent) {
          throw new ApiError(404, "Agent not found");
        }

        // Check if the agent is in the competition
        const agentInCompetition =
          await services.competitionService.isAgentInCompetition(
            competitionId,
            agentId,
          );

        if (!agentInCompetition) {
          throw new ApiError(
            404,
            "Agent is not participating in this competition",
          );
        }

        // Get positions from the perps data processor
        const positions = await services.perpsDataProcessor.getAgentPositions(
          agentId,
          competitionId,
        );

        // Convert to match the same format as all-positions endpoint for consistency
        const formattedPositions = positions.map((position) => ({
          id: position.id,
          competitionId: position.competitionId,
          agentId: position.agentId,
          positionId: position.providerPositionId || null,
          marketId: position.asset || null,
          marketSymbol: position.asset || null,
          asset: position.asset,
          isLong: position.isLong,
          leverage: Number(position.leverage || 0),
          size: Number(position.positionSize),
          collateral: Number(position.collateralAmount),
          averagePrice: Number(position.entryPrice),
          markPrice: Number(position.currentPrice || 0),
          liquidationPrice: position.liquidationPrice
            ? Number(position.liquidationPrice)
            : null,
          unrealizedPnl: Number(position.pnlUsdValue || 0),
          pnlPercentage: Number(position.pnlPercentage || 0),
          realizedPnl: 0,
          status: position.status || "Open",
          openedAt: position.createdAt.toISOString(),
          closedAt: position.closedAt ? position.closedAt.toISOString() : null,
          timestamp: position.lastUpdatedAt
            ? position.lastUpdatedAt.toISOString()
            : position.createdAt.toISOString(),
        }));

        const responseBody = {
          success: true,
          competitionId,
          agentId,
          positions: formattedPositions,
        } as const;

        res.status(200).json(responseBody);
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get perps competition summary statistics
     * @param req Request
     * @param res Express response object
     * @param next Express next function
     */
    async getPerpsCompetitionSummary(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        // Get competition ID from path parameter
        const competitionId = ensureUuid(req.params.competitionId);

        // Check if competition exists
        const competition =
          await services.competitionService.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Check if this is a perps competition
        if (competition.type !== "perpetual_futures") {
          throw new ApiError(
            400,
            "This endpoint is only available for perpetual futures competitions.",
          );
        }

        // Cache only public (unauthenticated or authenticated user) requests (and disable in test/dev mode)
        const shouldCacheResponse = checkShouldCacheResponse(req);
        const cacheKey = generateCacheKey(req, "perpsCompetitionSummary", {
          competitionId,
        });
        if (shouldCacheResponse) {
          const cached = caches.perpsStats.get(cacheKey);
          if (cached) {
            return res.status(200).json(cached);
          }
        }

        // Get stats from the perps data processor
        const stats =
          await services.perpsDataProcessor.getCompetitionStats(competitionId);

        const responseBody = {
          success: true,
          competitionId,
          summary: {
            totalAgents: stats.totalAgents,
            totalPositions: stats.totalPositions,
            totalVolume: stats.totalVolume,
            averageEquity: stats.averageEquity,
          },
          timestamp: new Date().toISOString(),
        };

        // Cache the response for 1 minute (60 seconds)
        if (shouldCacheResponse) {
          caches.perpsStats.set(cacheKey, responseBody, { ttl: 60 * 1000 });
        }

        return res.status(200).json(responseBody);
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get all perps positions for a competition with pagination
     * Similar to getCompetitionTrades but for perps positions
     * @param req Request with competitionId param and pagination query params
     * @param res Express response object
     * @param next Express next function
     */
    async getCompetitionPerpsPositions(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        // Get competition ID from path parameter
        const competitionId = ensureUuid(req.params.competitionId);
        const pagingParams = PagingParamsSchema.parse(req.query);

        // Optional status filter (defaults to "Open" in repository)
        const statusFilter = req.query.status as string | undefined;

        // Check if competition exists
        const competition =
          await services.competitionService.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Check if this is a perps competition
        if (competition.type !== "perpetual_futures") {
          throw new ApiError(
            400,
            "This endpoint is only available for perpetual futures competitions. " +
              "Use GET /api/competitions/{id}/trades for paper trading competitions.",
          );
        }

        // Cache only public requests (similar to getCompetitionTrades)
        const shouldCacheResponse = checkShouldCacheResponse(req);
        const cacheKey = generateCacheKey(req, "competitionPerpsPositions", {
          competitionId,
          ...pagingParams,
          statusFilter,
        });
        if (shouldCacheResponse) {
          const cached = caches.trades.get(cacheKey); // Reuse trades cache
          if (cached) {
            return res.status(200).json(cached);
          }
        }

        // Get positions from perps data processor
        const { positions, total } =
          await services.perpsDataProcessor.getCompetitionPerpsPositions(
            competitionId,
            pagingParams.limit,
            pagingParams.offset,
            statusFilter,
          );

        // Map the response to match EXACT same format as agent.controller.ts
        const mappedPositions = positions.map((pos) => ({
          id: pos.id,
          competitionId: pos.competitionId,
          agentId: pos.agentId,
          agent: pos.agent, // Embedded agent info
          positionId: pos.providerPositionId || null,
          marketId: pos.asset || null, // Same as agent controller
          marketSymbol: pos.asset || null, // Same as agent controller
          asset: pos.asset,
          isLong: pos.isLong,
          leverage: Number(pos.leverage || 0),
          size: Number(pos.positionSize),
          collateral: Number(pos.collateralAmount),
          averagePrice: Number(pos.entryPrice),
          markPrice: Number(pos.currentPrice || 0),
          liquidationPrice: pos.liquidationPrice
            ? Number(pos.liquidationPrice)
            : null,
          unrealizedPnl: Number(pos.pnlUsdValue || 0),
          pnlPercentage: Number(pos.pnlPercentage || 0),
          realizedPnl: 0, // Not tracked in our schema
          status: pos.status,
          openedAt: pos.createdAt.toISOString(),
          closedAt: pos.closedAt ? pos.closedAt.toISOString() : null,
          timestamp: pos.lastUpdatedAt
            ? pos.lastUpdatedAt.toISOString()
            : pos.createdAt.toISOString(),
        }));

        const responseBody = {
          success: true,
          positions: mappedPositions,
          pagination: buildPaginationResponse(
            total,
            pagingParams.limit,
            pagingParams.offset,
          ),
        } as const;

        if (shouldCacheResponse) {
          caches.trades.set(cacheKey, responseBody); // 1 minute TTL by default
        }

        res.status(200).json(responseBody);
      } catch (error) {
        next(error);
      }
    },
  };
}

export type CompetitionController = ReturnType<
  typeof makeCompetitionController
>;
