import { NextFunction, Response } from "express";

import { competitionLogger } from "@/lib/logger.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { ServiceRegistry } from "@/services/index.js";
import {
  AuthenticatedRequest,
  BucketParamSchema,
  CompetitionAgentParamsSchema,
  CompetitionStatusSchema,
  PagingParamsSchema,
} from "@/types/index.js";
import { AgentQuerySchema } from "@/types/sort/agent.js";

import { checkIsAdmin, ensureUuid } from "./request-helpers.js";

export function makeCompetitionController(services: ServiceRegistry) {
  /**
   * Competition Controller
   * Handles competition-related operations
   */

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

        const result =
          await services.competitionService.getLeaderboardWithAuthorization({
            competitionId,
            agentId,
            isAdmin,
          });

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

        const result = await services.competitionService.getCompetitionRules({
          agentId,
          isAdmin,
        });

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

        // Use the service method which handles caching
        const result =
          await services.competitionService.getEnrichedCompetitions({
            status,
            pagingParams,
            userId,
          });

        res.status(200).json(result);
      } catch (error) {
        next(error);
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

        // Note: The service method handles caching and all business logic
        const result = await services.competitionService.getCompetitionById({
          competitionId,
          userId,
          agentId,
          isAdmin,
        });

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

        res.status(200).json(result);
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

        // Authentication handling
        const authenticatedAgentId = req.agentId;

        let validatedUserId: string;

        if (authenticatedAgentId) {
          // Agent API key authentication: verify agent matches URL parameter
          if (authenticatedAgentId !== agentId) {
            throw new ApiError(
              403,
              "Agent API key does not match agent ID in URL",
            );
          }

          // Get agent to find the owner
          const agent = await services.agentService.getAgent(agentId);
          if (!agent) {
            throw new ApiError(404, "Agent not found");
          }

          validatedUserId = agent.ownerId;
        } else if (req.userId) {
          // User session authentication - need to verify agent ownership
          const agent = await services.agentService.getAgent(agentId);
          if (!agent) {
            throw new ApiError(404, "Agent not found");
          }
          if (agent.ownerId !== req.userId) {
            throw new ApiError(403, "Access denied: You do not own this agent");
          }

          validatedUserId = req.userId;
        } else {
          throw new ApiError(401, "Authentication required");
        }

        // Call the service layer
        await services.competitionService.leaveCompetition(
          competitionId,
          agentId,
          validatedUserId,
        );

        res.status(200).json({
          success: true,
          message: "Successfully left competition",
        });
      } catch (error) {
        // Convert service layer errors to appropriate HTTP errors
        if (error instanceof Error) {
          if (error.message.includes("not found")) {
            next(new ApiError(404, error.message));
          } else if (
            error.message.includes("does not belong to requesting user")
          ) {
            next(new ApiError(403, "Agent does not belong to requesting user"));
          } else if (error.message.includes("already ended")) {
            next(
              new ApiError(
                403,
                "Cannot leave competition that has already ended",
              ),
            );
          } else if (error.message.includes("not in this competition")) {
            next(new ApiError(403, "Agent is not in this competition"));
          } else {
            next(error);
          }
        } else {
          next(error);
        }
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

        const result =
          await services.competitionService.getCompetitionTimelineWithAuth(
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
          await services.competitionService.getCompetitionRulesWithAuth(
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

        const result =
          await services.competitionService.getCompetitionTradesWithAuth({
            competitionId,
            pagingParams,
          });

        res.status(200).json(result);
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
          await services.competitionService.getAgentCompetitionTradesWithAuth({
            competitionId,
            agentId,
            pagingParams,
          });

        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },
  };
}

export type CompetitionController = ReturnType<
  typeof makeCompetitionController
>;

/**
 * Clear all competition APIs caches
 */
export function clearCompetitionsApiCaches() {
  for (const cache of Object.values(caches)) cache.clear();
}
