import { NextFunction, Response } from "express";

import { config } from "@/config/index.js";
import {
  getBatchVoteCounts,
  getEnrichedCompetitions,
} from "@/database/repositories/competition-repository.js";
import { SelectCompetitionReward } from "@/database/schema/core/types.js";
import { competitionLogger } from "@/lib/logger.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { ServiceRegistry } from "@/services/index.js";
import {
  AuthenticatedRequest,
  BucketParamSchema,
  COMPETITION_JOIN_ERROR_TYPES,
  CompetitionAgentParamsSchema,
  CompetitionJoinError,
  CompetitionStatusSchema,
  PagingParamsSchema,
} from "@/types/index.js";
import { AgentQuerySchema } from "@/types/sort/agent.js";

import {
  buildPaginationResponse,
  checkIsAdmin,
  ensureUuid,
} from "./request-helpers.js";

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
        // Get active competition or use competitionId from query
        const competitionId =
          (req.query.competitionId as string) ||
          (await services.competitionManager.getActiveCompetition())?.id;

        if (!competitionId) {
          throw new ApiError(
            400,
            "No active competition and no competitionId provided",
          );
        }

        // Check if competition exists
        const competition =
          await services.competitionManager.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Check if the agent is authenticated
        const agentId = req.agentId;
        const isAdmin = req.isAdmin === true;

        // Authentication and Authorization
        if (isAdmin) {
          // Admin access: Log and proceed
          competitionLogger.debug(
            `Admin accessing leaderboard for competition ${competitionId}.`,
          );
        } else {
          // Not an admin, an agentId is required
          if (!agentId) {
            throw new ApiError(
              401,
              "Authentication required to view leaderboard",
            );
          }
          // AgentId is present, verify active participation
          const isAgentActiveInCompetitionResult =
            await services.competitionManager.isAgentActiveInCompetition(
              competitionId,
              agentId,
            );
          if (!isAgentActiveInCompetitionResult) {
            throw new ApiError(
              403,
              "Forbidden: Your agent is not actively participating in this competition.",
            );
          }
        }

        // Get leaderboard data (active and inactive agents)
        const leaderboardData =
          await services.competitionManager.getLeaderboardWithInactiveAgents(
            competitionId,
          );

        // Get all agents for mapping IDs to names
        const agents = await services.agentManager.getAllAgents();
        const agentMap = new Map(agents.map((agent) => [agent.id, agent]));

        // Build active leaderboard with ranks
        const activeLeaderboard = leaderboardData.activeAgents.map(
          (entry, index) => {
            const agent = agentMap.get(entry.agentId);
            return {
              rank: index + 1,
              agentId: entry.agentId,
              agentName: agent ? agent.name : "Unknown Agent",
              agentHandle: agent ? agent.handle : "unknown_agent",
              portfolioValue: entry.value,
              active: true,
              deactivationReason: null,
            };
          },
        );

        // Build inactive agents list
        const inactiveAgents = leaderboardData.inactiveAgents.map((entry) => {
          const agent = agentMap.get(entry.agentId);
          return {
            agentId: entry.agentId,
            agentName: agent ? agent.name : "Unknown Agent",
            agentHandle: agent ? agent.handle : "unknown_agent",
            portfolioValue: entry.value,
            active: false,
            deactivationReason: entry.deactivationReason,
          };
        });

        res.status(200).json({
          success: true,
          competition,
          leaderboard: activeLeaderboard,
          inactiveAgents: inactiveAgents,
          hasInactiveAgents: inactiveAgents.length > 0,
        });
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
        // Get active competition
        const activeCompetition =
          await services.competitionManager.getActiveCompetition();

        // If no active competition, return null status
        if (!activeCompetition) {
          competitionLogger.debug("No active competition found");
          return res.status(200).json({
            success: true,
            active: false,
            competition: null,
            message: "No active competition found",
          });
        }
        competitionLogger.debug(
          `Found active competition: ${activeCompetition.id}`,
        );

        // Get agent ID from request (if authenticated)
        const agentId = req.agentId;
        const isAdmin = req.isAdmin === true;

        // If admin, return full status
        if (isAdmin) {
          competitionLogger.debug(
            `Admin ${agentId} accessing competition status`,
          );
          return res.status(200).json({
            success: true,
            active: true,
            competition: activeCompetition,
            isAdmin,
            participating: false,
          });
        }

        // If not authenticated, just return basic status
        const basicInfo = {
          id: activeCompetition.id,
          name: activeCompetition.name,
          status: activeCompetition.status,
          externalUrl: activeCompetition.externalUrl,
          imageUrl: activeCompetition.imageUrl,
        };
        if (!agentId) {
          return res.status(200).json({
            success: true,
            active: true,
            competition: basicInfo,
            message: "Authentication required to check participation status",
          });
        }

        // Check if the agent is actively participating in the competition
        const isAgentActiveInCompetitionResult =
          await services.competitionManager.isAgentActiveInCompetition(
            activeCompetition.id,
            agentId,
          );

        // If agent is not actively participating and not an admin, return limited info
        if (!isAgentActiveInCompetitionResult) {
          competitionLogger.debug(
            `Agent ${agentId} is not in competition ${activeCompetition.id}`,
          );

          return res.status(200).json({
            success: true,
            active: true,
            competition: {
              ...basicInfo,
              startDate: activeCompetition.startDate,
            },
            participating: false,
            message: "Your agent is not participating in this competition",
          });
        }

        // Agent is participating
        competitionLogger.debug(
          `Agent ${agentId} is participating in competition ${activeCompetition.id}`,
        );

        // Return full competition info
        res.status(200).json({
          success: true,
          active: true,
          competition: activeCompetition,
          participating: true,
        });
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
        // Check if the agent is authenticated
        const agentId = req.agentId;
        const isAdmin = req.isAdmin === true;

        // Get active competition first, as rules are always for the active one
        const activeCompetition =
          await services.competitionManager.getActiveCompetition();

        if (!activeCompetition) {
          throw new ApiError(
            404,
            "No active competition found to get rules for.",
          );
        }

        // Authentication and Authorization
        if (isAdmin) {
          // Admin access: Log and proceed
          competitionLogger.debug(
            `Admin accessing rules for competition ${activeCompetition.id}.`,
          );
        } else {
          // Not an admin, an agentId is required
          if (!agentId) {
            throw new ApiError(
              401,
              "Authentication required to view competition rules: Agent ID missing.",
            );
          }
          // AgentId is present, verify participation in the active competition
          if (activeCompetition.status !== "active") {
            // This check might be redundant if getActiveCompetition already ensures this,
            // but keeping for safety to ensure agent is not trying to get rules for a non-active comp.
            throw new ApiError(
              400,
              "No active competition found to get rules for.",
            );
          }
          const isAgentActiveInCompetitionResult =
            await services.competitionManager.isAgentActiveInCompetition(
              activeCompetition.id,
              agentId,
            );
          if (!isAgentActiveInCompetitionResult) {
            throw new ApiError(
              403,
              "Forbidden: Your agent is not actively participating in the active competition.",
            );
          }
        }

        // Build initial balances description based on config
        const initialBalanceDescriptions = [];

        // Chain-specific balances
        for (const chain of Object.keys(config.specificChainBalances)) {
          const chainBalances =
            config.specificChainBalances[
              chain as keyof typeof config.specificChainBalances
            ];
          const tokenItems = [];

          for (const token of Object.keys(chainBalances)) {
            const amount = chainBalances[token];
            if (amount && amount > 0) {
              tokenItems.push(`${amount} ${token.toUpperCase()}`);
            }
          }

          if (tokenItems.length > 0) {
            let chainName = chain;
            // Format chain name for better readability
            if (chain === "eth") chainName = "Ethereum";
            else if (chain === "svm") chainName = "Solana";
            else chainName = chain.charAt(0).toUpperCase() + chain.slice(1); // Capitalize

            initialBalanceDescriptions.push(
              `${chainName}: ${tokenItems.join(", ")}`,
            );
          }
        }

        // Get trading constraints for the active competition
        const tradingConstraints =
          await services.tradingConstraintsService.getConstraintsWithDefaults(
            activeCompetition.id,
          );

        // Define base rules
        const tradingRules = [
          "Trading is only allowed for tokens with valid price data",
          `All agents start with identical token balances: ${initialBalanceDescriptions.join("; ")}`,
          "Minimum trade amount: 0.000001 tokens",
          `Maximum single trade: ${config.maxTradePercentage}% of agent's total portfolio value`,
          "No shorting allowed (trades limited to available balance)",
          "Slippage is applied to all trades based on trade size",
          `Cross-chain trading type: ${activeCompetition.crossChainTradingType}`,
          "Transaction fees are not simulated",
          `Token eligibility requires minimum ${tradingConstraints.minimumPairAgeHours} hours of trading history`,
          `Token must have minimum 24h volume of $${tradingConstraints.minimum24hVolumeUsd.toLocaleString()} USD`,
          `Token must have minimum liquidity of $${tradingConstraints.minimumLiquidityUsd.toLocaleString()} USD`,
          `Token must have minimum FDV of $${tradingConstraints.minimumFdvUsd.toLocaleString()} USD`,
        ];

        // Add minimum trades per day rule if set
        if (tradingConstraints.minTradesPerDay !== null) {
          tradingRules.push(
            `Minimum trades per day requirement: ${tradingConstraints.minTradesPerDay} trades`,
          );
        }
        const rateLimits = [
          `${config.rateLimiting.maxRequests} requests per ${config.rateLimiting.windowMs / 1000} seconds per endpoint`,
          "100 requests per minute for trade operations",
          "300 requests per minute for price queries",
          "30 requests per minute for balance/portfolio checks",
          "3,000 requests per minute across all endpoints",
          "10,000 requests per hour per agent",
        ];
        const availableChains = {
          svm: true,
          evm: config.evmChains,
        };
        const slippageFormula =
          "baseSlippage = (tradeAmountUSD / 10000) * 0.05%, actualSlippage = baseSlippage * (0.9 + (Math.random() * 0.2))";

        // Assemble all rules
        const allRules = {
          tradingRules,
          rateLimits,
          availableChains,
          slippageFormula,
          tradingConstraints,
        };

        res.status(200).json({
          success: true,
          competition: activeCompetition,
          rules: allRules,
        });
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
        // Check if the agent is authenticated
        const agentId = req.agentId;
        const isAdmin = req.isAdmin === true;

        // If no agent ID, they can't be authenticated
        if (isAdmin) {
          competitionLogger.debug(
            `Admin ${agentId} requesting upcoming competitions`,
          );
        } else if (!agentId) {
          throw new ApiError(401, "Authentication required");
        } else {
          competitionLogger.debug(
            `Agent ${agentId} requesting upcoming competitions`,
          );
        }
        // Get upcoming competitions
        const upcomingCompetitions =
          await services.competitionManager.getUpcomingCompetitions();

        res.status(200).json({
          success: true,
          competitions: upcomingCompetitions,
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
        const agentId = req.agentId;
        const userId = req.userId;
        const isAdmin = req.isAdmin === true;
        if (isAdmin) {
          competitionLogger.debug(`Admin requesting competitions`);
        } else if (agentId) {
          competitionLogger.debug(`Agent ${agentId} requesting competitions`);
        } else if (userId) {
          competitionLogger.debug(`User ${userId} requesting competitions`);
        } else {
          competitionLogger.debug(
            `Unauthenticated request for competitions (public access)`,
          );
        }

        // Get all competitions, or those with a given status from the query params
        // TODO: we allow for null status & set our default as "all" competitions—is this what we want?
        const status = req.query.status
          ? CompetitionStatusSchema.parse(req.query.status)
          : undefined;
        const pagingParams = PagingParamsSchema.parse(req.query);
        const { competitions, total } =
          await services.competitionManager.getCompetitions(
            status,
            // Default limit 10, max 100. It's important we don't call this without a limit
            pagingParams,
          );

        // If user is authenticated, enrich competitions with voting information
        let enrichedCompetitions = competitions;
        if (userId) {
          const competitionIds = competitions.map((c) => c.id);

          // Fetch all data in parallel with batch queries
          const [enrichmentData, voteCountsMap] = await Promise.all([
            getEnrichedCompetitions(userId, competitionIds),
            getBatchVoteCounts(competitionIds),
          ]);

          // Create lookup maps for efficient access
          const enrichmentMap = new Map(
            enrichmentData.map((data) => [data.competitionId, data]),
          );

          enrichedCompetitions = competitions.map((competition) => {
            const enrichment = enrichmentMap.get(competition.id);
            if (!enrichment) {
              throw new ApiError(500, "invalid competition state");
            }

            const hasVoted = !!enrichment.userVoteAgentId;
            const compVotingStatus =
              services.voteManager.checkCompetitionVotingEligibility(
                competition,
              );

            const votingState = {
              canVote: compVotingStatus.canVote,
              reason: compVotingStatus.reason,
              info: {
                hasVoted,
                agentId: enrichment.userVoteAgentId || undefined,
                votedAt: enrichment.userVoteCreatedAt || undefined,
              },
            };

            const totalVotes =
              voteCountsMap.get(competition.id)?.totalVotes || 0;

            const tradingConstraints = {
              minimumPairAgeHours: enrichment.minimumPairAgeHours,
              minimum24hVolumeUsd: enrichment.minimum24hVolumeUsd,
              minimumLiquidityUsd: enrichment.minimumLiquidityUsd,
              minimumFdvUsd: enrichment.minimumFdvUsd,
              minTradesPerDay: enrichment.minTradesPerDay,
            };

            return {
              ...competition,
              tradingConstraints,
              votingEnabled: votingState.canVote || votingState.info.hasVoted,
              userVotingInfo: votingState,
              totalVotes,
            };
          });
        }

        // Calculate hasMore based on total and current page
        const hasMore = pagingParams.offset + pagingParams.limit < total;

        // Return the competitions with metadata
        res.status(200).json({
          success: true,
          competitions: enrichedCompetitions,
          pagination: {
            total: total,
            limit: pagingParams.limit,
            offset: pagingParams.offset,
            hasMore: hasMore,
          },
        });
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

        // Get competition ID from path parameter
        const competitionId = req.params.competitionId;
        if (!competitionId) {
          throw new ApiError(400, "Competition ID is required");
        }

        // Get competition details
        const competition =
          await services.competitionManager.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        const tradesResponse =
          await services.tradeSimulator.getCompetitionTrades(competitionId);

        // Get vote counts for this competition
        const voteCountsMap =
          await services.voteManager.getVoteCountsByCompetition(competitionId);
        const totalVotes = Array.from(voteCountsMap.values()).reduce(
          (sum, count) => sum + count,
          0,
        );

        // Get stats for this competition
        const stats = {
          totalTrades: tradesResponse.total,
          totalAgents: competition.registeredParticipants,
          totalVolume: tradesResponse.trades.reduce<number>(
            (acc, trade) => acc + trade.tradeAmountUsd,
            0,
          ),
          totalVotes,
          uniqueTokens: new Set([
            ...tradesResponse.trades.map((trade) => trade.fromToken),
            ...tradesResponse.trades.map((trade) => trade.toToken),
          ]).size,
        };

        const rewards =
          await services.competitionRewardService.getRewardsByCompetition(
            competitionId,
          );

        // If user is authenticated, get their voting state
        let userVotingInfo = undefined;
        let votingEnabled = false;
        if (userId) {
          try {
            const votingState =
              await services.voteManager.getCompetitionVotingState(
                userId,
                competitionId,
              );
            userVotingInfo = votingState;
            votingEnabled = votingState.canVote || votingState.info.hasVoted;
          } catch (error) {
            competitionLogger.warn(
              `Failed to get voting state for user ${userId} in competition ${competitionId}:`,
              error,
            );
          }
        }

        // Get trading constraints for this competition
        const tradingConstraints =
          await services.tradingConstraintsService.getConstraintsWithDefaults(
            competitionId,
          );

        // Return the competition details
        res.status(200).json({
          success: true,
          competition: {
            ...competition,
            stats,
            tradingConstraints,
            rewards: rewards.map((r: SelectCompetitionReward) => {
              return {
                rank: r.rank,
                reward: r.reward,
                agentId: r.agentId,
              };
            }),
            votingEnabled,
            userVotingInfo,
          },
        });
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

        // Get competition ID from path parameter
        const competitionId = ensureUuid(req.params.competitionId);

        // Parse query parameters
        const parseQueryParams = AgentQuerySchema.safeParse(req.query);
        if (!parseQueryParams.success) {
          throw new ApiError(400, "Invalid request format");
        }
        const queryParams = parseQueryParams.data;

        // Check if competition exists
        const competition =
          await services.competitionManager.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Get agents for the competition with pagination
        const { agents, total } =
          await services.competitionManager.getCompetitionAgentsWithMetrics(
            competitionId,
            queryParams,
          );

        // Return the competition agents with pagination metadata
        res.status(200).json({
          success: true,
          competitionId,
          registeredParticipants: competition.registeredParticipants,
          maxParticipants: competition.maxParticipants,
          agents,
          pagination: buildPaginationResponse(
            total,
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
          const agent = await services.agentManager.getAgent(agentId);
          if (!agent) {
            throw new ApiError(404, "Agent not found");
          }

          validatedUserId = agent.ownerId;
        } else if (req.userId) {
          // User session authentication - need to verify agent ownership
          const agent = await services.agentManager.getAgent(agentId);
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
        await services.competitionManager.joinCompetition(
          competitionId,
          agentId,
          validatedUserId,
        );

        res.status(200).json({
          success: true,
          message: "Successfully joined competition",
        });
      } catch (error) {
        // Handle typed competition join errors
        if (error && typeof error === "object" && "type" in error) {
          const joinError = error as CompetitionJoinError;
          switch (joinError.type) {
            case COMPETITION_JOIN_ERROR_TYPES.COMPETITION_NOT_FOUND:
            case COMPETITION_JOIN_ERROR_TYPES.AGENT_NOT_FOUND:
              next(new ApiError(404, joinError.message));
              break;
            case COMPETITION_JOIN_ERROR_TYPES.COMPETITION_ALREADY_STARTED:
            case COMPETITION_JOIN_ERROR_TYPES.AGENT_ALREADY_REGISTERED:
            case COMPETITION_JOIN_ERROR_TYPES.AGENT_NOT_ELIGIBLE:
            case COMPETITION_JOIN_ERROR_TYPES.JOIN_NOT_YET_OPEN:
            case COMPETITION_JOIN_ERROR_TYPES.JOIN_CLOSED:
            case COMPETITION_JOIN_ERROR_TYPES.PARTICIPANT_LIMIT_EXCEEDED:
              next(new ApiError(403, joinError.message));
              break;
            default:
              next(new ApiError(500, "Failed to join competition"));
          }
          return;
        }

        // Handle legacy string-based errors (fallback for existing code)
        if (error instanceof Error) {
          if (error.message.includes("not found")) {
            next(new ApiError(404, error.message));
          } else if (
            error.message.includes("does not belong to requesting user")
          ) {
            next(new ApiError(403, "Agent does not belong to requesting user"));
          } else if (error.message.includes("already started/ended")) {
            next(
              new ApiError(
                403,
                "Cannot join competition that has already started/ended",
              ),
            );
          } else if (error.message.includes("already actively registered")) {
            next(
              new ApiError(
                403,
                "Agent is already actively registered for this competition",
              ),
            );
          } else if (error.message.includes("not eligible")) {
            next(
              new ApiError(403, "Agent is not eligible to join competitions"),
            );
          } else {
            next(error);
          }
        } else {
          next(error);
        }
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
          const agent = await services.agentManager.getAgent(agentId);
          if (!agent) {
            throw new ApiError(404, "Agent not found");
          }

          validatedUserId = agent.ownerId;
        } else if (req.userId) {
          // User session authentication - need to verify agent ownership
          const agent = await services.agentManager.getAgent(agentId);
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
        await services.competitionManager.leaveCompetition(
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
        // Get competition ID from path parameter
        const competitionId = ensureUuid(req.params.competitionId);

        // Get and validate bucket parameter using zod schema
        const bucket = BucketParamSchema.parse(req.query.bucket);

        // Check if competition exists
        const competition =
          await services.competitionManager.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Get timeline data
        const rawData =
          await services.portfolioSnapshotter.getAgentPortfolioTimeline(
            competitionId,
            bucket,
          );

        // Transform into the required structure
        const agentsMap = new Map<
          string,
          {
            agentId: string;
            agentName: string;
            timeline: Array<{ timestamp: string; totalValue: number }>;
          }
        >();

        for (const item of rawData) {
          if (!agentsMap.has(item.agentId)) {
            agentsMap.set(item.agentId, {
              agentId: item.agentId,
              agentName: item.agentName,
              timeline: [],
            });
          }

          agentsMap.get(item.agentId)!.timeline.push({
            timestamp: item.timestamp,
            totalValue: item.totalValue,
          });
        }

        const transformedData = {
          success: true,
          competitionId,
          timeline: Array.from(agentsMap.values()),
        };

        res.status(200).json(transformedData);
      } catch (error) {
        console.error("OIII", error);
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
        // Get competition ID from path parameter
        const competitionId = req.params.competitionId;
        if (!competitionId) {
          throw new ApiError(400, "Competition ID is required");
        }

        // Get competition details
        const competition =
          await services.competitionManager.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Build initial balances description based on config
        const initialBalanceDescriptions = [];

        // Chain-specific balances
        for (const chain of Object.keys(config.specificChainBalances)) {
          const chainBalances =
            config.specificChainBalances[
              chain as keyof typeof config.specificChainBalances
            ];
          const tokenItems = [];

          for (const token of Object.keys(chainBalances)) {
            const amount = chainBalances[token];
            if (amount && amount > 0) {
              tokenItems.push(`${amount} ${token.toUpperCase()}`);
            }
          }

          if (tokenItems.length > 0) {
            let chainName = chain;
            // Format chain name for better readability
            if (chain === "eth") chainName = "Ethereum";
            else if (chain === "svm") chainName = "Solana";
            else chainName = chain.charAt(0).toUpperCase() + chain.slice(1); // Capitalize

            initialBalanceDescriptions.push(
              `${chainName}: ${tokenItems.join(", ")}`,
            );
          }
        }

        // Get trading constraints for the competition
        const tradingConstraints =
          await services.tradingConstraintsService.getConstraintsWithDefaults(
            competition.id,
          );

        // Define base rules (same logic as getRules but for specific competition)
        const tradingRules = [
          "Trading is only allowed for tokens with valid price data",
          `All agents start with identical token balances: ${initialBalanceDescriptions.join("; ")}`,
          "Minimum trade amount: 0.000001 tokens",
          `Maximum single trade: ${config.maxTradePercentage}% of agent's total portfolio value`,
          "No shorting allowed (trades limited to available balance)",
          "Slippage is applied to all trades based on trade size",
          `Cross-chain trading type: ${competition.crossChainTradingType}`,
          "Transaction fees are not simulated",
          `Token eligibility requires minimum ${tradingConstraints.minimumPairAgeHours} hours of trading history`,
          `Token must have minimum 24h volume of $${tradingConstraints.minimum24hVolumeUsd.toLocaleString()} USD`,
          `Token must have minimum liquidity of $${tradingConstraints.minimumLiquidityUsd.toLocaleString()} USD`,
          `Token must have minimum FDV of $${tradingConstraints.minimumFdvUsd.toLocaleString()} USD`,
        ];

        // Add minimum trades per day rule if set
        if (tradingConstraints.minTradesPerDay !== null) {
          tradingRules.push(
            `Minimum trades per day requirement: ${tradingConstraints.minTradesPerDay} trades`,
          );
        }

        const rateLimits = [
          `${config.rateLimiting.maxRequests} requests per ${config.rateLimiting.windowMs / 1000} seconds per endpoint`,
          "100 requests per minute for trade operations",
          "300 requests per minute for price queries",
          "30 requests per minute for balance/portfolio checks",
          "3,000 requests per minute across all endpoints",
          "10,000 requests per hour per agent",
        ];

        const availableChains = {
          svm: true,
          evm: config.evmChains,
        };

        const slippageFormula =
          "baseSlippage = (tradeAmountUSD / 10000) * 0.05%, actualSlippage = baseSlippage * (0.9 + (Math.random() * 0.2))";

        // Assemble all rules
        const allRules = {
          tradingRules,
          rateLimits,
          availableChains,
          slippageFormula,
          tradingConstraints,
        };

        res.status(200).json({
          success: true,
          competition,
          rules: allRules,
        });
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
        // Get competition ID from path parameter
        const competitionId = ensureUuid(req.params.competitionId);
        const pagingParams = PagingParamsSchema.parse(req.query);

        // Check if competition exists
        const competition =
          await services.competitionManager.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Get trades
        const { trades, total } =
          await services.tradeSimulator.getCompetitionTrades(
            competitionId,
            pagingParams.limit,
            pagingParams.offset,
          );

        res.status(200).json({
          success: true,
          trades,
          pagination: buildPaginationResponse(
            total,
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
        // Get competition ID from path parameter
        const { competitionId, agentId } = CompetitionAgentParamsSchema.parse(
          req.params,
        );
        const pagingParams = PagingParamsSchema.parse(req.query);

        // Check if competition exists
        const competition =
          await services.competitionManager.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Check if agent exists
        const agent = await services.agentManager.getAgent(agentId);
        if (!agent) {
          throw new ApiError(404, "Agent not found");
        }

        // Get trades
        const { trades, total } =
          await services.tradeSimulator.getAgentTradesInCompetition(
            competitionId,
            agentId,
            pagingParams.limit,
            pagingParams.offset,
          );

        res.status(200).json({
          success: true,
          trades,
          pagination: buildPaginationResponse(
            total,
            pagingParams.limit,
            pagingParams.offset,
          ),
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

export type CompetitionController = ReturnType<
  typeof makeCompetitionController
>;
