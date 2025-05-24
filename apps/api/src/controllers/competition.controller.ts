import { NextFunction, Response } from "express";

import { config } from "@/config/index.js";
import { ensureReqTeam } from "@/controllers/heplers.js";
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
        const { competitionId } = req.params;

        // Validate competition ID
        if (!competitionId) {
          throw new ApiError(400, "Competition ID is required");
        }

        // Check if competition exists
        const competition =
          await services.competitionManager.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Check if the agent is authenticated
        const agentId = req.agentId;
        const isAdmin = req.isAdmin || false;

        // Check if the agent is part of the competition
        // If no agent ID, they can't be in the competition
        if (!agentId) {
          throw new ApiError(401, "Authentication required");
        }

        // If not an admin, verify agent is part of the competition
        if (!isAdmin) {
          const isAgentInCompetitionResult = await isAgentInCompetition(
            agentId,
            competitionId,
          );

          if (!isAgentInCompetitionResult) {
            throw new ApiError(
              403,
              "Your agent is not participating in this competition",
            );
          }
        } else {
          console.log(
            `[CompetitionController] Admin ${agentId} accessing leaderboard for competition ${competitionId}`,
          );
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
            deactivationReason:
              isInactive && agent?.status ? `Status: ${agent.status}` : null,
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
          return res.status(200).json({
            success: true,
            competition: null,
            message: "No active competition",
          });
        }

        // Get agent ID from request (if authenticated)
        const agentId = req.agentId;
        const isAdmin = req.isAdmin || false;

        // If agent is not authenticated, return basic info only
        if (!agentId) {
          return res.status(200).json({
            success: true,
            competition: {
              id: activeCompetition.id,
              name: activeCompetition.name,
              description: activeCompetition.description,
              status: activeCompetition.status,
              startDate: activeCompetition.startDate,
              endDate: activeCompetition.endDate,
              externalLink: activeCompetition.externalLink,
              imageUrl: activeCompetition.imageUrl,
              crossChainTradingType: activeCompetition.crossChainTradingType,
            },
            participating: false,
            isAdmin: false,
            message: "Authentication required to check participation status",
          });
        }

        // Check if the agent is part of the competition
        const isAgentInCompetitionResult = await isAgentInCompetition(
          agentId,
          activeCompetition.id,
        );

        // Check if the agent is an admin
        const adminStatus = isAdmin;

        // If agent is not in competition and not an admin, return limited info
        if (!isAgentInCompetitionResult && !adminStatus) {
          console.log(
            `[CompetitionController] Agent ${agentId} is not in competition ${activeCompetition.id}`,
          );

          return res.status(200).json({
            success: true,
            competition: {
              id: activeCompetition.id,
              name: activeCompetition.name,
              description: activeCompetition.description,
              status: activeCompetition.status,
              startDate: activeCompetition.startDate,
              endDate: activeCompetition.endDate,
              externalLink: activeCompetition.externalLink,
              imageUrl: activeCompetition.imageUrl,
              crossChainTradingType: activeCompetition.crossChainTradingType,
            },
            participating: false,
            isAdmin: adminStatus,
            message: "Your agent is not participating in this competition",
          });
        }

        // Agent is either participating or is an admin
        if (adminStatus) {
          console.log(
            `[CompetitionController] Admin ${agentId} accessing competition status`,
          );
        } else {
          console.log(
            `[CompetitionController] Agent ${agentId} is participating in competition ${activeCompetition.id}`,
          );
        }

        // Return full competition info
        res.status(200).json({
          success: true,
          competition: activeCompetition,
          participating: isAgentInCompetitionResult,
          isAdmin: adminStatus,
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
        const isAdmin = req.isAdmin || false;

        // If no agent ID, they can't be authenticated
        if (!agentId) {
          throw new ApiError(401, "Authentication required");
        }

        // Get active competition
        const activeCompetition =
          await services.competitionManager.getActiveCompetition();

        if (!activeCompetition) {
          throw new ApiError(404, "No active competition found");
        }

        // If not an admin, verify agent is part of the active competition
        if (!isAdmin) {
          if (activeCompetition.status !== CompetitionStatus.ACTIVE) {
            throw new ApiError(400, "No active competition found");
          }

          const isAgentInCompetitionResult = await isAgentInCompetition(
            agentId,
            activeCompetition.id,
          );

          if (!isAgentInCompetitionResult) {
            throw new ApiError(
              403,
              "Your agent is not participating in the active competition",
            );
          }
        } else {
          console.log(
            `[CompetitionController] Admin ${agentId} accessing competition rules`,
          );
        }

        // Define base rules
        const baseRules = [
          "Competition Duration: The competition runs from the official start time until the official end time",
          "Objective: Maximize your total portfolio value through strategic trading",
          "All agents start with identical token balances",
          `Maximum single trade: ${config.maxTradePercentage}% of agent's total portfolio value`,
        ];

        // Cross-chain trading rules
        const crossChainRules = [];
        if (activeCompetition.crossChainTradingType === "disallowAll") {
          crossChainRules.push(
            "Cross-chain trading is disabled for this competition",
          );
        } else if (
          activeCompetition.crossChainTradingType === "disallowXParent"
        ) {
          crossChainRules.push(
            "Cross-chain trading is allowed within the same parent blockchain only",
          );
        } else {
          crossChainRules.push("Cross-chain trading is fully enabled");
        }

        const tradingRules = [
          "Rate Limiting: API requests are limited to ensure fair play",
          "10,000 requests per hour per agent",
          `Cross-chain trading type: ${activeCompetition.crossChainTradingType}`,
          ...crossChainRules,
        ];

        const complianceRules = [
          "Fair Play: Agents must operate independently without coordination",
          "API Usage: Only use the provided trading API endpoints",
          "Data Sources: Use only the price data provided by the platform",
          "Automated Trading: Agents can operate autonomously within the competition timeframe",
        ];

        // Assemble all rules
        const allRules = {
          baseRules,
          tradingRules,
          complianceRules,
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
    async getUpcoming(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        // Check if the agent is authenticated
        const agentId = req.agentId;

        // If no agent ID, they can't be authenticated
        if (!agentId) {
          throw new ApiError(401, "Authentication required");
        }

        console.log(
          `[CompetitionController] Agent ${agentId} requesting upcoming competitions`,
        );

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
     * @param req AuthenticatedRequest object with team authentication information
     * @param res Express response
     * @param next Express next function
     */
    async getCompetitions(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        // Check if the team is authenticated
        ensureReqTeam(req, "Authentication required to view competitions");

        console.log(
          `[CompetitionController] Agent ${req.agentId} requesting competitions`,
        );

        // Get all upcoming competitions
        const status = CompetitionStatusSchema.parse(req.query.status);
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
  };
}

export type CompetitionController = ReturnType<
  typeof makeCompetitionController
>;
