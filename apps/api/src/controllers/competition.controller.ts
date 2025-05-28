import { NextFunction, Response } from "express";

import { config } from "@/config/index.js";
import { isAgentInCompetition } from "@/database/repositories/agent-repository.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { ServiceRegistry } from "@/services/index.js";
import {
  AuthenticatedRequest,
  CompetitionStatus,
  CompetitionStatusSchema,
  PagingParamsSchema,
} from "@/types/index.js";

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
          console.log(
            `[CompetitionController] Admin accessing leaderboard for competition ${competitionId}.`,
          );
        } else {
          // Not an admin, an agentId is required
          if (!agentId) {
            throw new ApiError(
              401,
              "Authentication required to view leaderboard",
            );
          }
          // AgentId is present, verify participation
          const isAgentInCompetitionResult = await isAgentInCompetition(
            agentId,
            competitionId,
          );
          if (!isAgentInCompetitionResult) {
            throw new ApiError(
              403,
              "Forbidden: Your agent is not participating in this competition.",
            );
          }
        }

        // Get leaderboard
        const leaderboard =
          await services.competitionManager.getLeaderboard(competitionId);

        // Get all agents
        const agents = await services.agentManager.getAllAgents();

        // Create map of all agents
        const agentMap = new Map(agents.map((agent) => [agent.id, agent]));

        // Separate active and inactive agents
        const activeLeaderboard = [];
        const inactiveAgents = [];

        // Process each agent in the leaderboard
        for (const entry of leaderboard) {
          const agent = agentMap.get(entry.agentId);
          const isInactive = agent?.status !== "active";

          const leaderboardEntry = {
            agentId: entry.agentId,
            agentName: agent ? agent.name : "Unknown Agent",
            portfolioValue: entry.value,
            active: !isInactive,
            deactivationReason: isInactive ? agent?.deactivationReason : null,
          };

          if (isInactive) {
            // Add to inactive agents without rank
            inactiveAgents.push(leaderboardEntry);
          } else {
            // Add to active leaderboard
            activeLeaderboard.push(leaderboardEntry);
          }
        }

        // Assign ranks to active agents
        const rankedActiveLeaderboard = activeLeaderboard.map(
          (entry, index) => ({
            rank: index + 1,
            ...entry,
          }),
        );

        res.status(200).json({
          success: true,
          competition,
          leaderboard: rankedActiveLeaderboard,
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
          console.log("[CompetitionController] No active competition found");
          return res.status(200).json({
            success: true,
            active: false,
            competition: null,
            message: "No active competition found",
          });
        }
        console.log(
          `[CompetitionController] Found active competition: ${activeCompetition.id}`,
        );

        // Get agent ID from request (if authenticated)
        const agentId = req.agentId;
        const isAdmin = req.isAdmin === true;

        // If admin, return full status
        if (isAdmin) {
          console.log(
            `[CompetitionController] Admin ${agentId} accessing competition status`,
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
          externalLink: activeCompetition.externalLink,
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

        // Check if the agent is part of the competition
        const isAgentInCompetitionResult = await isAgentInCompetition(
          agentId,
          activeCompetition.id,
        );

        // If agent is not in competition and not an admin, return limited info
        if (!isAgentInCompetitionResult) {
          console.log(
            `[CompetitionController] Agent ${agentId} is not in competition ${activeCompetition.id}`,
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
        console.log(
          `[CompetitionController] Agent ${agentId} is participating in competition ${activeCompetition.id}`,
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
          console.log(
            `[CompetitionController] Admin accessing rules for competition ${activeCompetition.id}.`,
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
          if (activeCompetition.status !== CompetitionStatus.ACTIVE) {
            // This check might be redundant if getActiveCompetition already ensures this,
            // but keeping for safety to ensure agent is not trying to get rules for a non-active comp.
            throw new ApiError(
              400,
              "No active competition found to get rules for.",
            );
          }
          const isAgentInCompetitionResult = await isAgentInCompetition(
            agentId,
            activeCompetition.id,
          );
          if (!isAgentInCompetitionResult) {
            throw new ApiError(
              403,
              "Forbidden: Your agent is not participating in the active competition.",
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
        ];
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
        const portfolioSnapshots = {
          interval: `${config.portfolio.snapshotIntervalMs / 60000} minutes`,
        };

        // Assemble all rules
        const allRules = {
          tradingRules,
          rateLimits,
          availableChains,
          slippageFormula,
          portfolioSnapshots,
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
          console.log(
            `[CompetitionController] Admin ${agentId} requesting upcoming competitions`,
          );
        } else if (!agentId) {
          throw new ApiError(401, "Authentication required");
        } else {
          console.log(
            `[CompetitionController] Agent ${agentId} requesting upcoming competitions`,
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
          console.log(`[CompetitionController] Admin requesting competitions`);
        } else if (agentId) {
          console.log(
            `[CompetitionController] Agent ${agentId} requesting competitions`,
          );
        } else if (userId) {
          console.log(
            `[CompetitionController] User ${userId} requesting competitions`,
          );
        } else {
          throw new ApiError(401, "Authentication required");
        }

        // Get all competitions, or those with a given status from the query params
        // TODO: we allow for null status & set our default as "all" competitions—is this what we want?
        const status = req.query.status
          ? CompetitionStatusSchema.parse(req.query.status)
          : undefined;
        const pagingParams = PagingParamsSchema.parse(req.query);
        const competitions = await services.competitionManager.getCompetitions(
          status,
          pagingParams,
        );

        // Return the competitions
        res.status(200).json({
          success: true,
          competitions: competitions,
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
          console.log(
            `[CompetitionController] Admin requesting competition details`,
          );
        } else if (agentId) {
          console.log(
            `[CompetitionController] Agent ${agentId} requesting competition details`,
          );
        } else if (userId) {
          console.log(
            `[CompetitionController] User ${userId} requesting competition details`,
          );
        } else {
          throw new ApiError(401, "Authentication required");
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

        // Return the competition details
        res.status(200).json({
          success: true,
          competition: competition,
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
    async getCompetitionAgents(
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
          console.log(
            `[CompetitionController] Admin requesting competition agents`,
          );
        } else if (agentId) {
          console.log(
            `[CompetitionController] Agent ${agentId} requesting competition agents`,
          );
        } else if (userId) {
          console.log(
            `[CompetitionController] User ${userId} requesting competition agents`,
          );
        } else {
          throw new ApiError(401, "Authentication required");
        }

        // Get competition ID from path parameter
        const competitionId = req.params.competitionId;
        if (!competitionId) {
          throw new ApiError(400, "Competition ID is required");
        }

        // Check if competition exists
        const competition =
          await services.competitionManager.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Get leaderboard data for the competition
        const leaderboard =
          await services.competitionManager.getLeaderboard(competitionId);

        // Get all agents to get their details
        const agents = await services.agentManager.getAllAgents();
        const agentMap = new Map(agents.map((agent) => [agent.id, agent]));

        // Build the response with agent details and competition data
        const competitionAgents = leaderboard.map((entry, index) => {
          const agent = agentMap.get(entry.agentId);
          const isActive = agent?.status === "active";

          return {
            id: entry.agentId,
            name: agent ? agent.name : "Unknown Agent",
            description: agent?.description || null,
            imageUrl: agent?.imageUrl || null,
            score: entry.value,
            position: index + 1,
            portfolioValue: entry.value,
            active: isActive,
            deactivationReason: !isActive
              ? agent?.deactivationReason || null
              : null,
          };
        });

        // Return the competition agents
        res.status(200).json({
          success: true,
          competitionId: competitionId,
          agents: competitionAgents,
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
