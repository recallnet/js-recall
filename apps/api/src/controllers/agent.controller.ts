import { NextFunction, Request, Response } from "express";

import {
  AgentFilterSchema,
  ApiError,
  PagingParamsSchema,
  UpdateAgentProfileSchema,
  UuidSchema,
} from "@recallnet/services/types";

import { ServiceRegistry } from "@/services/index.js";
import { AuthenticatedRequest } from "@/types/index.js";

import {
  buildPaginationResponse,
  ensureAgentCompetitionFilters,
  ensurePaging,
  ensureUuid,
} from "./request-helpers.js";

/**
 * Agent Controller
 * Handles agent-specific trading operations with agent API key authentication
 * Sets req.agentId from agent API key validation
 */
export function makeAgentController(services: ServiceRegistry) {
  return {
    /**
     * Get profile for the authenticated agent and its owner
     * @param req Express request with agentId from API key
     * @param res Express response
     * @param next Express next function
     */
    async getProfile(req: Request, res: Response, next: NextFunction) {
      try {
        const agentId = req.agentId as string;

        // Get the agent using the service
        const agent = await services.agentService.getAgent(agentId);

        if (!agent) {
          throw new ApiError(404, "Agent not found");
        }

        // Get the owner user information
        const owner = await services.userService.getUser(agent.ownerId);

        if (!owner) {
          throw new ApiError(404, "Agent owner not found");
        }

        // Return the agent profile with owner information
        // TODO: we can clean this up with better types that help omit the api key
        res.status(200).json({
          success: true,
          agent: services.agentService.sanitizeAgent(agent),
          owner: {
            id: owner.id,
            walletAddress: owner.walletAddress,
            name: owner.name,
            email: owner.email,
            imageUrl: owner.imageUrl,
            metadata: owner.metadata,
            status: owner.status,
            createdAt: owner.createdAt,
            updatedAt: owner.updatedAt,
          },
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Update profile for the authenticated agent
     * Limited to description and imageUrl only (agent self-service)
     * @param req Express request with agentId from API key
     * @param res Express response
     * @param next Express next function
     */
    async updateProfile(req: Request, res: Response, next: NextFunction) {
      try {
        const { success, data, error } = UpdateAgentProfileSchema.safeParse({
          agentId: req.agentId,
          body: req.body,
        });
        if (!success) {
          throw new ApiError(400, `Invalid request format: ${error.message}`);
        }
        const {
          agentId,
          body: { description, imageUrl },
        } = data;

        // Get the current agent
        const agent = await services.agentService.getAgent(agentId);
        if (!agent) {
          throw new ApiError(404, "Agent not found");
        }

        // Prepare update data with only allowed fields
        const updateData = {
          id: agentId,
          description,
          imageUrl,
        };

        const updatedAgent = await services.agentService.updateAgent({
          ...agent,
          ...updateData,
        });

        if (!updatedAgent) {
          throw new ApiError(500, "Failed to update agent profile");
        }

        res.status(200).json({
          success: true,
          agent: services.agentService.sanitizeAgent(updatedAgent),
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get agents with sorting, filtering, and pagination
     * @param req Express request with querystring containing filter, sort, and paging
     * @param res Express response
     * @param next Express next function
     */
    async getAgents(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const pagingParams = PagingParamsSchema.parse(req.query);
        const filter = req.query.filter
          ? AgentFilterSchema.parse(req.query.filter)
          : undefined;
        const agents = await services.agentService.getAgents({
          filter,
          pagingParams,
        });
        const totalCount = await services.agentService.countAgents(filter);
        const { limit, offset } = pagingParams;

        // Return the agents
        res.status(200).json({
          success: true,
          pagination: buildPaginationResponse(totalCount, limit, offset),
          agents: agents.map(
            services.agentService.sanitizeAgent.bind(services.agentService),
          ),
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * Get an agent with the given agent id
     * @param req Express request with agent id in url path
     * @param res Express response
     * @param next Express next function
     */
    async getAgent(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const { success, data: agentId } = UuidSchema.safeParse(
          req.params.agentId,
        );
        if (!success) {
          throw new ApiError(400, "Invalid Agent ID");
        }

        // Get the agent using the service
        const agent = await services.agentService.getAgent(agentId);

        if (!agent) {
          throw new ApiError(404, "Agent not found");
        }

        // Get the owner user information
        const owner = await services.userService.getUser(agent.ownerId);

        // Prepare owner info for public display (null if user not found)
        const ownerInfo = owner
          ? {
              id: owner.id,
              name: owner.name || null,
              walletAddress: owner.walletAddress,
            }
          : null;

        const sanitizedAgent = services.agentService.sanitizeAgent(agent);
        const computedAgent =
          await services.agentService.attachAgentMetrics(sanitizedAgent);

        // Return the agent with owner information
        res.status(200).json({
          success: true,
          agent: computedAgent,
          owner: ownerInfo,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * Get balances for the authenticated agent
     * @param req Express request with agentId from API key
     * @param res Express response
     * @param next Express next function
     */
    async getBalances(req: Request, res: Response, next: NextFunction) {
      try {
        const agentId = req.agentId as string;
        const { competitionId } = req.query;

        // Validate competitionId parameter
        if (!competitionId || typeof competitionId !== "string") {
          throw new ApiError(
            400,
            "Missing required parameter: competitionId. Use GET /api/agent/balances?competitionId=xxx",
          );
        }

        // Verify competition exists and get its type
        const competition =
          await services.competitionService.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Check if it's a perps competition
        if (competition.type === "perpetual_futures") {
          throw new ApiError(
            400,
            "This endpoint is not available for perpetual futures competitions. " +
              "Use GET /api/agent/perps/account for account summary.",
          );
        }

        // Get enhanced balances for the specified competition
        const enhancedBalances =
          await services.agentService.getEnhancedBalances(
            agentId,
            competitionId,
          );

        // Return the balances
        res.status(200).json({
          success: true,
          agentId,
          competitionId,
          balances: enhancedBalances,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get trade history for the authenticated agent
     * @param req Express request with agentId from API key
     * @param res Express response
     * @param next Express next function
     */
    async getTrades(req: Request, res: Response, next: NextFunction) {
      try {
        const agentId = req.agentId as string;
        const { competitionId } = req.query;

        // Validate competitionId is provided
        if (!competitionId || typeof competitionId !== "string") {
          throw new ApiError(
            400,
            "Missing required parameter: competitionId. Use GET /api/agent/trades?competitionId=xxx",
          );
        }

        // Get and validate competition
        const competition =
          await services.competitionService.getCompetition(competitionId);

        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Check if this is a perps competition
        if (competition.type === "perpetual_futures") {
          throw new ApiError(
            400,
            "This endpoint is not available for perpetual futures competitions. " +
              "Use GET /api/agent/perps/positions for current positions.",
          );
        }

        // Get the trades for this agent in this competition
        const result =
          await services.tradeSimulatorService.getAgentTradesInCompetition(
            competitionId,
            agentId,
          );

        // Return the trades
        res.status(200).json({
          success: true,
          agentId,
          trades: result.trades,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Reset the API key for the authenticated agent
     * @param req Express request with agentId from API key
     * @param res Express response
     * @param next Express next function
     */
    async resetApiKey(req: Request, res: Response, next: NextFunction) {
      try {
        const agentId = req.agentId as string;

        // Use the AgentManager service to reset the API key
        const result = await services.agentService.resetApiKey(agentId);

        // Return the new API key
        res.status(200).json({
          success: true,
          apiKey: result.apiKey,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get competitions associated with the url param agent
     * @param req Express request with agentId from API key
     * @param res Express response
     * @param next Express next function
     */
    async getCompetitions(req: Request, res: Response, next: NextFunction) {
      try {
        const agentId = ensureUuid(req.params.agentId);
        const filters = ensureAgentCompetitionFilters(req);
        const paging = ensurePaging(req);

        // Fetch all competitions associated with the agent
        const results = await services.agentService.getCompetitionsForAgent(
          agentId,
          filters,
          paging,
        );

        res.status(200).json({
          success: true,
          competitions: results.competitions,
          pagination: buildPaginationResponse(
            results.total,
            paging.limit,
            paging.offset,
          ),
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get perps positions for the authenticated agent
     * @param req Express request with agentId from API key
     * @param res Express response
     * @param next Express next function
     */
    async getPerpsPositions(req: Request, res: Response, next: NextFunction) {
      try {
        const agentId = req.agentId as string;
        const { competitionId } = req.query;

        // Validate competitionId parameter
        if (!competitionId || typeof competitionId !== "string") {
          throw new ApiError(
            400,
            "Missing required parameter: competitionId. Use GET /api/agent/perps/positions?competitionId=xxx",
          );
        }

        // Get and validate competition
        const competition =
          await services.competitionService.getCompetition(competitionId);

        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        if (competition.type !== "perpetual_futures") {
          throw new ApiError(
            400,
            "This endpoint is only available for perpetual futures competitions. " +
              "Use GET /api/agent/trades for paper trading positions.",
          );
        }

        // Check if agent is registered in the competition
        const isRegistered =
          await services.competitionService.isAgentActiveInCompetition(
            competitionId,
            agentId,
          );

        if (!isRegistered) {
          throw new ApiError(
            403,
            "Agent is not registered in this competition",
          );
        }

        // Get positions from the service
        const positions = await services.perpsDataProcessor.getAgentPositions(
          agentId,
          competitionId,
        );

        // Return the positions with consistent format across all endpoints
        res.status(200).json({
          success: true,
          agentId,
          positions: positions.map((pos) => ({
            id: pos.id,
            competitionId: pos.competitionId,
            agentId: pos.agentId,
            positionId: pos.providerPositionId || null,
            marketId: pos.asset || null,
            marketSymbol: pos.asset || null,
            asset: pos.asset,
            isLong: pos.isLong,
            leverage: pos.leverage !== null ? Number(pos.leverage) : null,
            size: Number(pos.positionSize),
            collateral:
              pos.collateralAmount !== null
                ? Number(pos.collateralAmount)
                : null,
            averagePrice:
              pos.entryPrice !== null ? Number(pos.entryPrice) : null,
            markPrice: Number(pos.currentPrice || 0),
            liquidationPrice: pos.liquidationPrice
              ? Number(pos.liquidationPrice)
              : null,
            unrealizedPnl: Number(pos.pnlUsdValue || 0),
            pnlPercentage:
              pos.pnlPercentage !== null ? Number(pos.pnlPercentage) : null,
            realizedPnl: 0, // Not tracked in current schema
            status: pos.status || "Open",
            openedAt: pos.createdAt.toISOString(),
            closedAt: pos.closedAt ? pos.closedAt.toISOString() : null,
            timestamp: pos.lastUpdatedAt
              ? pos.lastUpdatedAt.toISOString()
              : pos.createdAt.toISOString(),
          })),
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get perps account summary for the authenticated agent
     * @param req Express request with agentId from API key
     * @param res Express response
     * @param next Express next function
     */
    async getPerpsAccount(req: Request, res: Response, next: NextFunction) {
      try {
        const agentId = req.agentId as string;
        const { competitionId } = req.query;

        // Validate competitionId parameter
        if (!competitionId || typeof competitionId !== "string") {
          throw new ApiError(
            400,
            "Missing required parameter: competitionId. Use GET /api/agent/perps/account?competitionId=xxx",
          );
        }

        // Get and validate competition
        const competition =
          await services.competitionService.getCompetition(competitionId);

        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        if (competition.type !== "perpetual_futures") {
          throw new ApiError(
            400,
            "This endpoint is only available for perpetual futures competitions. " +
              "Use GET /api/agent/balances for paper trading account.",
          );
        }

        // Check if agent is registered in the competition
        const isRegistered =
          await services.competitionService.isAgentActiveInCompetition(
            competitionId,
            agentId,
          );

        if (!isRegistered) {
          throw new ApiError(
            403,
            "Agent is not registered in this competition",
          );
        }

        // Get latest account summary from the service
        const summary =
          await services.perpsDataProcessor.getAgentAccountSummary(
            agentId,
            competitionId,
          );

        if (!summary) {
          // No data yet - return default values
          res.status(200).json({
            success: true,
            agentId,
            account: {
              id: "",
              agentId,
              competitionId: competitionId,
              accountId: "",
              totalEquity: "0",
              availableBalance: "0",
              marginUsed: "0",
              totalPnl: "0",
              totalVolume: "0",
              openPositions: 0,
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }

        // Return the account summary
        res.status(200).json({
          success: true,
          agentId,
          account: {
            id: summary.id,
            agentId: summary.agentId,
            competitionId: summary.competitionId,
            accountId: "", // Not tracked in current schema
            totalEquity: summary.totalEquity || "0",
            availableBalance: summary.availableBalance || "0",
            marginUsed: summary.marginUsed || "0",
            totalPnl: summary.totalPnl || "0",
            totalVolume: summary.totalVolume || "0",
            openPositions: summary.openPositionsCount || 0,
            timestamp:
              summary.timestamp?.toISOString() || new Date().toISOString(),
          },
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

/**
 * Type definition for AgentController
 */
export type AgentController = ReturnType<typeof makeAgentController>;
