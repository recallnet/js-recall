import { NextFunction, Request, Response } from "express";

import { addAgentToCompetition } from "@/database/repositories/competition-repository.js";
import { flatParse } from "@/lib/flat-parse.js";
import { adminLogger } from "@/lib/logger.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { ServiceRegistry } from "@/services/index.js";
import {
  ActorStatus,
  AdminCreateAgentSchema,
  Agent,
  AgentPublic,
  User,
  toApiAgent,
  toApiUser,
} from "@/types/index.js";

import {
  AdminAddAgentToCompetitionParamsSchema,
  AdminCreateCompetitionSchema,
  AdminDeactivateAgentBodySchema,
  AdminDeactivateAgentParamsSchema,
  AdminDeleteAgentParamsSchema,
  AdminEndCompetitionSchema,
  AdminGetAgentApiKeyParamsSchema,
  AdminGetAgentParamsSchema,
  AdminGetCompetitionSnapshotsParamsSchema,
  AdminGetCompetitionSnapshotsQuerySchema,
  AdminGetCompetitionTransferViolationsParamsSchema,
  AdminGetPerformanceReportsQuerySchema,
  AdminListAllAgentsQuerySchema,
  AdminReactivateAgentInCompetitionParamsSchema,
  AdminReactivateAgentParamsSchema,
  AdminRegisterUserSchema,
  AdminRemoveAgentFromCompetitionBodySchema,
  AdminRemoveAgentFromCompetitionParamsSchema,
  AdminSetupSchema,
  AdminStartCompetitionSchema,
  AdminUpdateAgentBodySchema,
  AdminUpdateAgentParamsSchema,
  AdminUpdateCompetitionParamsSchema,
  AdminUpdateCompetitionSchema,
} from "./admin.schema.js";
import { parseAdminSearchQuery } from "./request-helpers.js";

// TODO: need user deactivation logic

interface AdminUserRegistrationResponse {
  success: boolean;
  user: User;
  agent?: Agent;
  agentError?: string;
}

interface AdminAgentRegistrationResponse {
  success: boolean;
  agent: Agent;
  agentError?: string;
}

interface AdminSearchResults {
  users: User[];
  agents: AgentPublic[];
}

export interface AdminSearchUsersAndAgentsResponse {
  success: boolean;
  join: boolean;
  results: AdminSearchResults;
}

export function makeAdminController(services: ServiceRegistry) {
  /**
   * Admin Controller
   * Handles administrative operations
   */
  return {
    /**
     * Setup the initial admin account
     * This endpoint is only available when no admin exists in the system
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async setupAdmin(req: Request, res: Response, next: NextFunction) {
      try {
        // Validate request body using flatParse
        const result = flatParse(AdminSetupSchema, req.body);
        if (!result.success) {
          throw new ApiError(400, `Invalid request format: ${result.error}`);
        }

        const { username, password, email } = result.data;

        // Setup the initial admin using AdminService
        const adminResult = await services.adminService.setupInitialAdmin(
          username,
          password,
          email,
        );

        // Return success with admin information
        res.status(201).json({
          success: true,
          message: "Admin account created successfully",
          admin: {
            id: adminResult.id,
            username: adminResult.username,
            email: adminResult.email,
            createdAt: adminResult.createdAt,
            apiKey: adminResult.apiKey,
          },
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Register a new user and optionally create their first agent
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async registerUser(req: Request, res: Response, next: NextFunction) {
      try {
        // Validate request body using flatParse
        const result = flatParse(AdminRegisterUserSchema, req.body);
        if (!result.success) {
          return res.status(400).json({
            success: false,
            error: `Invalid request format: ${result.error}`,
          });
        }

        // Delegate business logic to service
        const { user, agent, agentError } =
          await services.adminService.registerUserAndAgent(result.data);

        // Handle case where agent creation failed but user was created successfully
        if (agentError) {
          return res.status(201).json({
            success: true,
            user: toApiUser(user),
            agentError,
          });
        }

        // Return success with created user and agent
        const response: AdminUserRegistrationResponse = {
          success: true,
          user: toApiUser(user),
        };

        if (agent) {
          response.agent = toApiAgent(agent);
        }

        return res.status(201).json(response);
      } catch (error) {
        next(error);
      }
    },

    /**
     * Register a new agent
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async registerAgent(req: Request, res: Response, next: NextFunction) {
      try {
        const result = flatParse(AdminCreateAgentSchema, req.body);
        if (!result.success) {
          throw new ApiError(400, `Invalid request format: ${result.error}`);
        }
        const { user, agent } = result.data;

        // Create agent using service method that handles user resolution
        const createdAgent = await services.agentService.createAgentForOwner(
          { userId: user.id, walletAddress: user.walletAddress },
          agent,
        );

        const response: AdminAgentRegistrationResponse = {
          success: true,
          agent: toApiAgent(createdAgent),
        };

        return res.status(201).json(response);
      } catch (error) {
        next(error);
      }
    },

    /**
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async createCompetition(req: Request, res: Response, next: NextFunction) {
      try {
        // Validate request body using flatParse
        const result = flatParse(AdminCreateCompetitionSchema, req.body);
        if (!result.success) {
          throw new ApiError(400, `Invalid request format: ${result.error}`);
        }

        const {
          name,
          description,
          tradingType,
          sandboxMode,
          externalUrl,
          imageUrl,
          type,
          startDate,
          endDate,
          votingStartDate,
          votingEndDate,
          joinStartDate,
          joinEndDate,
          maxParticipants,
          tradingConstraints,
          rewards,
          perpsProvider,
        } = result.data;

        // Create a new competition
        const competition = await services.competitionService.createCompetition(
          {
            name,
            description,
            tradingType,
            sandboxMode,
            externalUrl,
            imageUrl,
            type,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            votingStartDate: votingStartDate
              ? new Date(votingStartDate)
              : undefined,
            votingEndDate: votingEndDate ? new Date(votingEndDate) : undefined,
            joinStartDate: joinStartDate ? new Date(joinStartDate) : undefined,
            joinEndDate: joinEndDate ? new Date(joinEndDate) : undefined,
            maxParticipants,
            tradingConstraints,
            rewards,
            perpsProvider,
          },
        );

        // Return the created competition
        res.status(201).json({
          success: true,
          competition,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async startCompetition(req: Request, res: Response, next: NextFunction) {
      try {
        // Validate request body
        const result = flatParse(AdminStartCompetitionSchema, req.body);
        if (!result.success) {
          throw new ApiError(400, `Invalid request format: ${result.error}`);
        }

        const {
          competitionId,
          agentIds,
          tradingConstraints,
          // Fields for creating new competition
          name,
          description,
          tradingType,
          sandboxMode,
          externalUrl,
          imageUrl,
          type,
          startDate,
          endDate,
          votingStartDate,
          votingEndDate,
          joinStartDate,
          joinEndDate,
          rewards,
          perpsProvider,
        } = result.data;

        // Call service method with creation params only if no competitionId
        const competition =
          await services.competitionService.startOrCreateCompetition({
            competitionId,
            agentIds,
            tradingConstraints,
            creationParams: competitionId
              ? undefined
              : {
                  name: name!,
                  description,
                  tradingType,
                  sandboxMode,
                  externalUrl,
                  imageUrl,
                  type,
                  startDate,
                  endDate,
                  votingStartDate,
                  votingEndDate,
                  joinStartDate,
                  joinEndDate,
                  rewards,
                  perpsProvider,
                },
          });

        // Return the started competition
        res.status(200).json({
          success: true,
          competition,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async endCompetition(req: Request, res: Response, next: NextFunction) {
      try {
        // Validate request body using flatParse
        const result = flatParse(AdminEndCompetitionSchema, req.body);
        if (!result.success) {
          throw new ApiError(400, `Invalid request format: ${result.error}`);
        }

        const { competitionId } = result.data;

        // End the competition
        const endedCompetition =
          await services.competitionService.endCompetition(competitionId);

        // Get final leaderboard
        const leaderboard =
          await services.competitionService.getLeaderboard(competitionId);

        // Assign winners to the rewards
        await services.competitionRewardService.assignWinnersToRewards(
          competitionId,
          leaderboard,
        );

        adminLogger.info(
          `Successfully ended competition, id: ${competitionId}`,
        );

        // Return the ended competition with leaderboard
        res.status(200).json({
          success: true,
          competition: endedCompetition,
          leaderboard,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async updateCompetition(req: Request, res: Response, next: NextFunction) {
      try {
        // Validate params using flatParse
        const paramsResult = flatParse(
          AdminUpdateCompetitionParamsSchema,
          req.params,
        );
        if (!paramsResult.success) {
          throw new ApiError(400, `Invalid parameters: ${paramsResult.error}`);
        }

        const { competitionId } = paramsResult.data;
        const bodyResult = flatParse(AdminUpdateCompetitionSchema, req.body);
        if (!bodyResult.success) {
          throw new ApiError(
            400,
            `Invalid request format: ${bodyResult.error}`,
          );
        }

        // Extract rewards, tradingConstraints, and perpsProvider from the validated data
        const {
          rewards,
          tradingConstraints,
          perpsProvider,
          ...competitionUpdates
        } = bodyResult.data;
        const updates = competitionUpdates;

        // Check if there are any updates to apply
        if (
          Object.keys(updates).length === 0 &&
          !rewards &&
          !tradingConstraints &&
          !perpsProvider
        ) {
          throw new ApiError(400, "No valid fields provided for update");
        }

        // Update the competition atomically
        const { competition: updatedCompetition, updatedRewards } =
          await services.competitionService.updateCompetition(
            competitionId,
            updates,
            tradingConstraints,
            rewards,
            perpsProvider,
          );

        // Return the updated competition
        res.status(200).json({
          success: true,
          competition: {
            ...updatedCompetition,
            rewards: updatedRewards.map((reward) => ({
              rank: reward.rank,
              reward: reward.reward,
            })),
          },
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async getPerformanceReports(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      try {
        // Validate query using flatParse
        const queryResult = flatParse(
          AdminGetPerformanceReportsQuerySchema,
          req.query,
        );
        if (!queryResult.success) {
          throw new ApiError(
            400,
            `Invalid query parameters: ${queryResult.error}`,
          );
        }
        const { competitionId } = queryResult.data;

        // Get the competition
        const competition =
          await services.competitionService.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Get leaderboard
        const leaderboard =
          await services.competitionService.getLeaderboard(competitionId);

        // Get all users for agent owner names
        const users = await services.userService.getAllUsers();

        // Map agent IDs to owner names
        const userMap = new Map(
          users.map((user) => [user.id, user.name || "Unknown User"]),
        );

        // Get only agents in this competition to map agent IDs to agent names and owners
        const agentIds = leaderboard.map((entry) => entry.agentId);
        const agents = await services.agentService.getAgentsByIds(agentIds);
        const agentMap = new Map(
          agents.map((agent) => [
            agent.id,
            {
              name: agent.name,
              handle: agent.handle,
              ownerName: userMap.get(agent.ownerId) || "Unknown Owner",
            },
          ]),
        );

        // Format leaderboard with agent and owner names
        const formattedLeaderboard = leaderboard.map((entry, index) => ({
          rank: index + 1,
          agentId: entry.agentId,
          agentName: agentMap.get(entry.agentId)?.name || "Unknown Agent",
          agentHandle: agentMap.get(entry.agentId)?.handle || "unknown_agent",
          ownerName: agentMap.get(entry.agentId)?.ownerName || "Unknown Owner",
          portfolioValue: entry.value,
        }));

        // Return performance report
        res.status(200).json({
          success: true,
          competition,
          leaderboard: formattedLeaderboard,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * List all users
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async listAllUsers(req: Request, res: Response, next: NextFunction) {
      try {
        // Get all users (non-admin users only)
        const users = await services.userService.getAllUsers();

        // Format the response to match the expected structure
        const formattedUsers = users.map(toApiUser);

        // Return the users
        res.status(200).json({
          success: true,
          users: formattedUsers,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async getCompetitionSnapshots(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      try {
        // Validate params using flatParse
        const paramsResult = flatParse(
          AdminGetCompetitionSnapshotsParamsSchema,
          req.params,
        );
        if (!paramsResult.success) {
          throw new ApiError(400, `Invalid parameters: ${paramsResult.error}`);
        }
        const { competitionId } = paramsResult.data;

        // Validate query using flatParse
        const queryResult = flatParse(
          AdminGetCompetitionSnapshotsQuerySchema,
          req.query,
        );
        if (!queryResult.success) {
          throw new ApiError(
            400,
            `Invalid query parameters: ${queryResult.error}`,
          );
        }
        const { agentId } = queryResult.data;

        // Check if the competition exists
        const competition =
          await services.competitionService.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Get snapshots based on whether an agent ID was provided
        let snapshots;
        if (agentId) {
          // Check if the agent exists
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
              400,
              "Agent is not participating in this competition",
            );
          }

          // Get snapshots for the specific agent
          snapshots =
            await services.portfolioSnapshotterService.getAgentPortfolioSnapshots(
              competitionId,
              agentId,
            );
        } else {
          // Get snapshots for all agents in the competition (including inactive ones)
          const agents =
            await services.competitionService.getAllCompetitionAgents(
              competitionId,
            );
          snapshots = [];

          for (const agentId of agents) {
            const agentSnapshots =
              await services.portfolioSnapshotterService.getAgentPortfolioSnapshots(
                competitionId,
                agentId,
              );
            snapshots.push(...agentSnapshots);
          }
        }

        // Return the snapshots
        res.status(200).json({
          success: true,
          snapshots,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Search for users and agents based on various criteria
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async searchUsersAndAgents(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      try {
        // Note: special parsing is required to support nested query params
        const { user, agent, join } = parseAdminSearchQuery(req.url);
        const results: AdminSearchResults = {
          users: [],
          agents: [],
        };

        // Search users if requested
        if (user) {
          const users = await services.userService.searchUsers(user);

          results.users = users.map(toApiUser);
        }

        // Search agents if requested
        if (agent) {
          results.agents = await services.agentService.searchAgents(agent);
        }

        if (join) {
          const userMap = new Map(results.users.map((user) => [user.id, user]));

          results.agents = results.agents
            .map((agent) => {
              const user = userMap.get(agent.ownerId);
              if (!user) return null;
              return {
                ...agent,
              };
            })
            .filter((entry) => entry !== null);
        }

        // Return the search results
        res.status(200).json({
          success: true,
          join,
          results,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * List all agents
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async listAllAgents(req: Request, res: Response, next: NextFunction) {
      try {
        // Parse and validate pagination parameters
        const queryResult = flatParse(AdminListAllAgentsQuerySchema, req.query);
        if (!queryResult.success) {
          throw new ApiError(
            400,
            `Invalid query parameters: ${queryResult.error}`,
          );
        }
        const {
          limit = 50,
          offset = 0,
          sort = "-createdAt",
        } = queryResult.data;

        // Get agents from the database with pagination
        const agents = await services.agentService.getAgents({
          pagingParams: { limit, offset, sort },
        });

        // Get total count for pagination metadata
        const totalCount = await services.agentService.countAgents();

        // Format the agents for the response
        const formattedAgents = agents.map(toApiAgent);

        // Return the agents with pagination metadata
        res.status(200).json({
          success: true,
          agents: formattedAgents,
          pagination: {
            limit,
            offset,
            total: totalCount,
            hasMore: offset + agents.length < totalCount,
          },
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Delete an agent
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async deleteAgent(req: Request, res: Response, next: NextFunction) {
      try {
        // Validate params using flatParse
        const paramsResult = flatParse(
          AdminDeleteAgentParamsSchema,
          req.params,
        );
        if (!paramsResult.success) {
          return res.status(400).json({
            success: false,
            error: `Invalid parameters: ${paramsResult.error}`,
          });
        }

        const { agentId } = paramsResult.data;

        // Get the agent first to check if it exists
        const agent = await services.agentService.getAgent(agentId);

        if (!agent) {
          return res.status(404).json({
            success: false,
            error: "Agent not found",
          });
        }

        // Delete the agent
        const deleted = await services.agentService.deleteAgent(agentId);

        if (deleted) {
          return res.status(200).json({
            success: true,
            message: "Agent successfully deleted",
          });
        } else {
          return res.status(500).json({
            success: false,
            error: "Failed to delete agent",
          });
        }
      } catch (error) {
        adminLogger.error("Error deleting agent:", error);
        next(error);
      }
    },

    /**
     * Deactivate an agent
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async deactivateAgent(req: Request, res: Response, next: NextFunction) {
      try {
        // Validate params using flatParse
        const paramsResult = flatParse(
          AdminDeactivateAgentParamsSchema,
          req.params,
        );
        if (!paramsResult.success) {
          return res.status(400).json({
            success: false,
            error: `Invalid parameters: ${paramsResult.error}`,
          });
        }

        // Validate body using flatParse
        const bodyResult = flatParse(AdminDeactivateAgentBodySchema, req.body);
        if (!bodyResult.success) {
          return res.status(400).json({
            success: false,
            error: `Invalid request body: ${bodyResult.error}`,
          });
        }

        const { agentId } = paramsResult.data;
        const { reason } = bodyResult.data;

        // Get the agent first to check if it exists
        const agent = await services.agentService.getAgent(agentId);

        if (!agent) {
          return res.status(404).json({
            success: false,
            error: "Agent not found",
          });
        }

        // Check if agent is already inactive
        if (agent.status !== "active") {
          return res.status(400).json({
            success: false,
            error: "Agent is already inactive",
            agent: {
              id: agent.id,
              name: agent.name,
              handle: agent.handle,
              status: agent.status,
            },
          });
        }

        // Deactivate the agent
        const deactivatedAgent = await services.agentService.deactivateAgent(
          agentId,
          reason,
        );

        if (!deactivatedAgent) {
          return res.status(500).json({
            success: false,
            error: "Failed to deactivate agent",
          });
        }

        // Return the updated agent info
        res.status(200).json({
          success: true,
          agent: {
            id: deactivatedAgent.id,
            name: deactivatedAgent.name,
            status: deactivatedAgent.status,
            deactivationReason: deactivatedAgent.deactivationReason,
            deactivationDate: deactivatedAgent.deactivationDate,
          },
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Reactivate an agent
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async reactivateAgent(req: Request, res: Response, next: NextFunction) {
      try {
        // Validate params using flatParse
        const paramsResult = flatParse(
          AdminReactivateAgentParamsSchema,
          req.params,
        );
        if (!paramsResult.success) {
          return res.status(400).json({
            success: false,
            error: `Invalid parameters: ${paramsResult.error}`,
          });
        }

        const { agentId } = paramsResult.data;

        // Get the agent first to check if it exists and is actually inactive
        const agent = await services.agentService.getAgent(agentId);

        if (!agent) {
          return res.status(404).json({
            success: false,
            error: "Agent not found",
          });
        }

        // Check if agent is already active
        if (agent.status === "active") {
          return res.status(400).json({
            success: false,
            error: "Agent is already active",
            agent: {
              id: agent.id,
              name: agent.name,
              handle: agent.handle,
              status: agent.status,
            },
          });
        }

        // Reactivate the agent
        const reactivatedAgent =
          await services.agentService.reactivateAgent(agentId);

        if (!reactivatedAgent) {
          return res.status(500).json({
            success: false,
            error: "Failed to reactivate agent",
          });
        }

        // Return the updated agent info
        res.status(200).json({
          success: true,
          agent: {
            id: reactivatedAgent.id,
            name: reactivatedAgent.name,
            status: reactivatedAgent.status,
          },
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get an agent by ID
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async getAgent(req: Request, res: Response, next: NextFunction) {
      try {
        // Validate params using flatParse
        const paramsResult = flatParse(AdminGetAgentParamsSchema, req.params);
        if (!paramsResult.success) {
          return res.status(400).json({
            success: false,
            error: `Invalid parameters: ${paramsResult.error}`,
          });
        }

        const { agentId } = paramsResult.data;

        // Get the agent
        const agent = await services.agentService.getAgent(agentId);

        if (!agent) {
          return res.status(404).json({
            success: false,
            error: "Agent not found",
          });
        }

        // Format the response
        const formattedAgent = {
          id: agent.id,
          ownerId: agent.ownerId,
          walletAddress: agent.walletAddress,
          name: agent.name,
          handle: agent.handle,
          email: agent.email,
          description: agent.description,
          status: agent.status as ActorStatus,
          imageUrl: agent.imageUrl,
          metadata: agent.metadata,
          createdAt: agent.createdAt,
          updatedAt: agent.updatedAt,
        };

        // Return the agent
        res.status(200).json({
          success: true,
          agent: formattedAgent,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Update an agent by ID
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async updateAgent(req: Request, res: Response, next: NextFunction) {
      try {
        // Validate params using flatParse
        const paramsResult = flatParse(
          AdminUpdateAgentParamsSchema,
          req.params,
        );
        if (!paramsResult.success) {
          return res.status(400).json({
            success: false,
            error: `Invalid parameters: ${paramsResult.error}`,
          });
        }

        // Validate body using flatParse
        const bodyResult = flatParse(AdminUpdateAgentBodySchema, req.body);
        if (!bodyResult.success) {
          return res.status(400).json({
            success: false,
            error: `Invalid request body: ${bodyResult.error}`,
          });
        }

        const { agentId } = paramsResult.data;
        const { name, handle, description, imageUrl, email, metadata } =
          bodyResult.data;

        // Get the current agent
        const agent = await services.agentService.getAgent(agentId);
        if (!agent) {
          return res.status(404).json({
            success: false,
            error: "Agent not found",
          });
        }

        // Prepare update data with only provided fields
        const updateData = {
          id: agentId,
          name: name ?? agent.name,
          handle: handle ?? agent.handle,
          description: description ?? agent.description,
          imageUrl: imageUrl ?? agent.imageUrl,
          email: email ?? agent.email,
          metadata: metadata ?? agent.metadata,
        };

        const updatedAgent = await services.agentService.updateAgent({
          ...agent,
          ...updateData,
        });

        if (!updatedAgent) {
          return res.status(500).json({
            success: false,
            error: "Failed to update agent",
          });
        }

        // Format the response
        const formattedAgent = {
          id: updatedAgent.id,
          ownerId: updatedAgent.ownerId,
          walletAddress: updatedAgent.walletAddress,
          name: updatedAgent.name,
          email: updatedAgent.email,
          description: updatedAgent.description,
          status: updatedAgent.status as ActorStatus,
          imageUrl: updatedAgent.imageUrl,
          metadata: updatedAgent.metadata,
          createdAt: updatedAgent.createdAt,
          updatedAt: updatedAgent.updatedAt,
        };

        res.status(200).json({
          success: true,
          agent: formattedAgent,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Remove an agent from a specific competition
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async removeAgentFromCompetition(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      try {
        // Validate params using flatParse
        const paramsResult = flatParse(
          AdminRemoveAgentFromCompetitionParamsSchema,
          req.params,
        );
        if (!paramsResult.success) {
          return res.status(400).json({
            success: false,
            error: `Invalid parameters: ${paramsResult.error}`,
          });
        }

        // Validate body using flatParse
        const bodyResult = flatParse(
          AdminRemoveAgentFromCompetitionBodySchema,
          req.body,
        );
        if (!bodyResult.success) {
          return res.status(400).json({
            success: false,
            error: `Invalid request body: ${bodyResult.error}`,
          });
        }

        const { competitionId, agentId } = paramsResult.data;
        const { reason } = bodyResult.data;

        // Check if competition exists
        const competition =
          await services.competitionService.getCompetition(competitionId);
        if (!competition) {
          return res.status(404).json({
            success: false,
            error: "Competition not found",
          });
        }

        // Check if agent exists
        const agent = await services.agentService.getAgent(agentId);
        if (!agent) {
          return res.status(404).json({
            success: false,
            error: "Agent not found",
          });
        }

        // Check if agent is in the competition
        const isInCompetition =
          await services.competitionService.isAgentInCompetition(
            competitionId,
            agentId,
          );
        if (!isInCompetition) {
          return res.status(400).json({
            success: false,
            error: "Agent is not participating in this competition",
          });
        }

        // Remove agent from competition using service method
        await services.competitionService.removeAgentFromCompetition(
          competitionId,
          agentId,
          `Admin removal: ${reason}`,
        );

        // Return success response
        res.status(200).json({
          success: true,
          message: `Agent ${agent.name} removed from competition ${competition.name}`,
          agent: {
            id: agent.id,
            name: agent.name,
            handle: agent.handle,
          },
          competition: {
            id: competition.id,
            name: competition.name,
          },
          reason,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Reactivate an agent in a specific competition
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async reactivateAgentInCompetition(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      try {
        // Validate params using flatParse
        const paramsResult = flatParse(
          AdminReactivateAgentInCompetitionParamsSchema,
          req.params,
        );
        if (!paramsResult.success) {
          return res.status(400).json({
            success: false,
            error: `Invalid parameters: ${paramsResult.error}`,
          });
        }

        const { competitionId, agentId } = paramsResult.data;

        // Check if competition exists
        const competition =
          await services.competitionService.getCompetition(competitionId);
        if (!competition) {
          return res.status(404).json({
            success: false,
            error: "Competition not found",
          });
        }

        // Check if agent exists
        const agent = await services.agentService.getAgent(agentId);
        if (!agent) {
          return res.status(404).json({
            success: false,
            error: "Agent not found",
          });
        }

        // Check if competition is still active
        if (competition.status === "ended") {
          return res.status(400).json({
            success: false,
            error: "Cannot reactivate agent in ended competition",
          });
        }

        // Check if agent is in the competition
        const isInCompetition =
          await services.competitionService.isAgentInCompetition(
            competitionId,
            agentId,
          );
        if (!isInCompetition) {
          return res.status(400).json({
            success: false,
            error: "Agent is not in this competition",
          });
        }

        // Reactivate agent in competition using service method
        await services.competitionService.reactivateAgentInCompetition(
          competitionId,
          agentId,
        );

        // Return success response
        res.status(200).json({
          success: true,
          message: `Agent ${agent.name} reactivated in competition ${competition.name}`,
          agent: {
            id: agent.id,
            name: agent.name,
            handle: agent.handle,
          },
          competition: {
            id: competition.id,
            name: competition.name,
          },
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Add an agent to a competition
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async addAgentToCompetition(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      try {
        // Validate params using flatParse
        const paramsResult = flatParse(
          AdminAddAgentToCompetitionParamsSchema,
          req.params,
        );
        if (!paramsResult.success) {
          return res.status(400).json({
            success: false,
            error: `Invalid parameters: ${paramsResult.error}`,
          });
        }

        const { competitionId, agentId } = paramsResult.data;

        // Check if competition exists
        const competition =
          await services.competitionService.getCompetition(competitionId);
        if (!competition) {
          return res.status(404).json({
            success: false,
            error: "Competition not found",
          });
        }

        // Check if agent exists
        const agent = await services.agentService.getAgent(agentId);
        if (!agent) {
          return res.status(404).json({
            success: false,
            error: "Agent not found",
          });
        }

        // Check if agent owner's email is verified (security layer)
        const owner = await services.userService.getUser(agent.ownerId);
        if (!owner) {
          return res.status(404).json({
            success: false,
            error: "Agent owner not found",
          });
        }

        // Check if agent is already in the competition
        const isInCompetition =
          await services.competitionService.isAgentInCompetition(
            competitionId,
            agentId,
          );
        if (isInCompetition) {
          return res.status(400).json({
            success: false,
            error: "Agent is already participating in this competition",
          });
        }

        // Check if competition is ended
        if (competition.status === "ended") {
          return res.status(400).json({
            success: false,
            error: "Cannot add agent to ended competition",
          });
        }

        // HARD RULE: Cannot add agents to active non-sandbox competitions
        if (competition.status === "active" && !competition.sandboxMode) {
          return res.status(400).json({
            success: false,
            error:
              "Cannot add agents to active non-sandbox competitions - this would be unfair to existing participants",
          });
        }

        // In sandbox mode, we need to reset the agent's balances to starting values when the agent
        // joins the always on competition, since we can't rely on 'startCompetition' to do so.
        // For non-sandbox mode, we must *not* do this, since agents can join competitions before
        // they've started, when they might be in another ongoing competition as well, and we don't
        // want to reset their balances in the middle of the ongoing competition. So in that case
        // wait for the new competition to start and let 'startCompetition' do the reset.
        if (competition.sandboxMode) {
          adminLogger.info(
            `Resetting agent balance as part of applying sandbox mode logic for admin adding agent ${agentId} to competition ${competitionId}`,
          );

          await services.balanceService.resetAgentBalances(
            agentId,
            competition.type,
          );
        }

        // Add agent to competition using repository method
        try {
          await addAgentToCompetition(competitionId, agentId);
        } catch (error) {
          // Handle specific error for participant limit
          if (
            error instanceof Error &&
            error.message.includes("maximum participant limit")
          ) {
            throw new ApiError(409, error.message);
          }
          // Re-throw other errors
          throw error;
        }

        // In sandbox mode, we need to take the initial portfolio snapshot when the agent joins
        // the always on competition, since we can't rely on 'startCompetition' to do so.
        if (competition.sandboxMode) {
          await services.portfolioSnapshotterService.takePortfolioSnapshotForAgent(
            competitionId,
            agentId,
          );

          adminLogger.info(`Sandbox mode logic completed for agent ${agentId}`);
        }

        // Return success response
        res.status(200).json({
          success: true,
          message: `Agent ${agent.name} successfully added to competition ${competition.name}`,
          agent: {
            id: agent.id,
            name: agent.name,
            handle: agent.handle,
            ownerId: agent.ownerId,
          },
          competition: {
            id: competition.id,
            name: competition.name,
            status: competition.status,
          },
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get an agent's API key
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async getAgentApiKey(req: Request, res: Response, next: NextFunction) {
      try {
        // Validate params using flatParse
        const paramsResult = flatParse(
          AdminGetAgentApiKeyParamsSchema,
          req.params,
        );
        if (!paramsResult.success) {
          throw new ApiError(400, `Invalid parameters: ${paramsResult.error}`);
        }

        const { agentId } = paramsResult.data;

        // Get the decrypted API key using the agent manager
        const result =
          await services.agentService.getDecryptedApiKeyById(agentId);

        if (!result.success) {
          // If there was an error, use the error code and message from the service
          throw new ApiError(
            result.errorCode || 500,
            result.errorMessage || "Unknown error",
          );
        }

        // Return the agent with the decrypted API key
        res.status(200).json({
          success: true,
          agent: {
            id: result.agent?.id || agentId,
            name: result.agent?.name || "Unknown",
            apiKey: result.apiKey,
          },
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get competition transfer violations
     * Returns agents who have made transfers during the competition
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async getCompetitionTransferViolations(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      try {
        // Validate params using flatParse
        const result = flatParse(
          AdminGetCompetitionTransferViolationsParamsSchema,
          req.params,
        );
        if (!result.success) {
          throw new ApiError(400, `Invalid parameters: ${result.error}`);
        }
        const { competitionId } = result.data;

        // Get transfer violations from service
        const violations =
          await services.competitionService.getCompetitionTransferViolations(
            competitionId,
          );

        res.json({
          success: true,
          violations,
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

export type AdminController = ReturnType<typeof makeAdminController>;
