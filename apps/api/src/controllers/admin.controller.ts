import { NextFunction, Request, Response } from "express";

import {
  ActorStatus,
  AdminCreateAgentSchema,
  Agent,
  AgentPublic,
  ApiError,
  User,
  toApiAgent,
  toApiUser,
} from "@recallnet/services/types";

import { flatParse } from "@/lib/flat-parse.js";
import { adminLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

import {
  AdminAddAgentToCompetitionParamsSchema,
  AdminAddBonusBoostSchema,
  AdminAddPartnerToCompetitionSchema,
  AdminArenaParamsSchema,
  AdminCompetitionParamsSchema,
  AdminCompetitionPartnerParamsSchema,
  AdminCreateArenaSchema,
  AdminCreateCompetitionSchema,
  AdminCreatePartnerSchema,
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
  AdminListArenasQuerySchema,
  AdminListPartnersQuerySchema,
  AdminPartnerParamsSchema,
  AdminReactivateAgentInCompetitionParamsSchema,
  AdminReactivateAgentParamsSchema,
  AdminRegisterUserSchema,
  AdminRemoveAgentFromCompetitionBodySchema,
  AdminRemoveAgentFromCompetitionParamsSchema,
  AdminReplaceCompetitionPartnersSchema,
  AdminRevokeBonusBoostSchema,
  AdminRewardsAllocationSchema,
  AdminSetupSchema,
  AdminStartCompetitionSchema,
  AdminUpdateAgentBodySchema,
  AdminUpdateAgentParamsSchema,
  AdminUpdateArenaSchema,
  AdminUpdateCompetitionParamsSchema,
  AdminUpdateCompetitionSchema,
  AdminUpdatePartnerPositionSchema,
  AdminUpdatePartnerSchema,
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
        const { username, password, email } = flatParse(
          AdminSetupSchema,
          req.body,
        );

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
        const result = flatParse(AdminRegisterUserSchema, req.body);

        // Delegate business logic to service
        const { user, agent, agentError } =
          await services.adminService.registerUserAndAgent(result);

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
        const { user, agent } = flatParse(AdminCreateAgentSchema, req.body);

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
     * Create a new arena
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async createArena(req: Request, res: Response, next: NextFunction) {
      try {
        const arenaData = flatParse(AdminCreateArenaSchema, req.body);

        const arena = await services.arenaService.createArena(arenaData);

        res.status(201).json({
          success: true,
          arena,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get an arena by ID
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async getArena(req: Request, res: Response, next: NextFunction) {
      try {
        const { id } = flatParse(AdminArenaParamsSchema, req.params);

        const arena = await services.arenaService.findById(id);

        res.status(200).json({
          success: true,
          arena,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * List all arenas with pagination
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async listArenas(req: Request, res: Response, next: NextFunction) {
      try {
        const { limit, offset, sort, nameFilter } = flatParse(
          AdminListArenasQuerySchema,
          req.query,
        );

        const result = await services.arenaService.findAll(
          { limit, offset, sort },
          nameFilter,
        );

        res.status(200).json({
          success: true,
          arenas: result.arenas,
          pagination: result.pagination,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Update an arena
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async updateArena(req: Request, res: Response, next: NextFunction) {
      try {
        const { id } = flatParse(AdminArenaParamsSchema, req.params);
        const updateData = flatParse(AdminUpdateArenaSchema, req.body);

        const arena = await services.arenaService.update(id, updateData);

        res.status(200).json({
          success: true,
          arena,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Delete an arena
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async deleteArena(req: Request, res: Response, next: NextFunction) {
      try {
        const { id } = flatParse(AdminArenaParamsSchema, req.params);

        await services.arenaService.delete(id);

        res.status(200).json({
          success: true,
          message: `Arena ${id} deleted successfully`,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Create a new partner
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async createPartner(req: Request, res: Response, next: NextFunction) {
      try {
        const partnerData = flatParse(AdminCreatePartnerSchema, req.body);

        const partner =
          await services.partnerService.createPartner(partnerData);

        res.status(201).json({
          success: true,
          partner,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get a partner by ID
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async getPartner(req: Request, res: Response, next: NextFunction) {
      try {
        const { id } = flatParse(AdminPartnerParamsSchema, req.params);

        const partner = await services.partnerService.findById(id);

        res.status(200).json({
          success: true,
          partner,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * List all partners with pagination
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async listPartners(req: Request, res: Response, next: NextFunction) {
      try {
        const { limit, offset, sort, nameFilter } = flatParse(
          AdminListPartnersQuerySchema,
          req.query,
        );

        const result = await services.partnerService.findAll(
          { limit, offset, sort },
          nameFilter,
        );

        res.status(200).json({
          success: true,
          partners: result.partners,
          pagination: result.pagination,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Update a partner
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async updatePartner(req: Request, res: Response, next: NextFunction) {
      try {
        const { id } = flatParse(AdminPartnerParamsSchema, req.params);
        const updateData = flatParse(AdminUpdatePartnerSchema, req.body);

        const partner = await services.partnerService.update(id, updateData);

        res.status(200).json({
          success: true,
          partner,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Delete a partner
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async deletePartner(req: Request, res: Response, next: NextFunction) {
      try {
        const { id } = flatParse(AdminPartnerParamsSchema, req.params);

        await services.partnerService.delete(id);

        res.status(200).json({
          success: true,
          message: `Partner ${id} deleted successfully`,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get partners for a competition
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async getCompetitionPartners(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const { competitionId } = flatParse(
          AdminCompetitionParamsSchema,
          req.params,
        );

        const partners =
          await services.partnerService.findByCompetition(competitionId);

        res.status(200).json({
          success: true,
          partners,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Add partner to competition
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async addPartnerToCompetition(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const { competitionId } = flatParse(
          AdminCompetitionParamsSchema,
          req.params,
        );
        const { partnerId, position } = flatParse(
          AdminAddPartnerToCompetitionSchema,
          req.body,
        );

        const association = await services.partnerService.addToCompetition({
          competitionId,
          partnerId,
          position,
        });

        res.status(201).json({
          success: true,
          association,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Update partner position in competition
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async updatePartnerPosition(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const { competitionId, partnerId } = flatParse(
          AdminCompetitionPartnerParamsSchema,
          req.params,
        );
        const { position } = flatParse(
          AdminUpdatePartnerPositionSchema,
          req.body,
        );

        const association = await services.partnerService.updatePosition(
          competitionId,
          partnerId,
          position,
        );

        res.status(200).json({
          success: true,
          association,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Remove partner from competition
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async removePartnerFromCompetition(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const { competitionId, partnerId } = flatParse(
          AdminCompetitionPartnerParamsSchema,
          req.params,
        );

        await services.partnerService.removeFromCompetition(
          competitionId,
          partnerId,
        );

        res.status(200).json({
          success: true,
          message: `Partner removed from competition successfully`,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Replace all partners for a competition
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async replaceCompetitionPartners(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const { competitionId } = flatParse(
          AdminCompetitionParamsSchema,
          req.params,
        );
        const { partners } = flatParse(
          AdminReplaceCompetitionPartnersSchema,
          req.body,
        );

        const associations =
          await services.partnerService.replaceCompetitionPartners(
            competitionId,
            partners,
          );

        res.status(200).json({
          success: true,
          partners: associations,
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
    async createCompetition(req: Request, res: Response, next: NextFunction) {
      try {
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
          boostStartDate,
          boostEndDate,
          joinStartDate,
          joinEndDate,
          maxParticipants,
          minimumStake,
          tradingConstraints,
          rewards,
          evaluationMetric,
          perpsProvider,
          prizePools,
          rewardsIneligible,
          arenaId,
          engineId,
          engineVersion,
          vips,
          allowlist,
          blocklist,
          minRecallRank,
          allowlistOnly,
          agentAllocation,
          agentAllocationUnit,
          boosterAllocation,
          boosterAllocationUnit,
          rewardRules,
          rewardDetails,
          displayState,
        } = flatParse(AdminCreateCompetitionSchema, req.body);

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
            boostStartDate: boostStartDate
              ? new Date(boostStartDate)
              : undefined,
            boostEndDate: boostEndDate ? new Date(boostEndDate) : undefined,
            joinStartDate: joinStartDate ? new Date(joinStartDate) : undefined,
            joinEndDate: joinEndDate ? new Date(joinEndDate) : undefined,
            maxParticipants,
            minimumStake,
            tradingConstraints,
            rewards,
            evaluationMetric,
            perpsProvider,
            prizePools,
            rewardsIneligible,
            arenaId,
            engineId,
            engineVersion,
            vips,
            allowlist,
            blocklist,
            minRecallRank,
            allowlistOnly,
            agentAllocation,
            agentAllocationUnit,
            boosterAllocation,
            boosterAllocationUnit,
            rewardRules,
            rewardDetails,
            displayState,
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
          boostStartDate,
          boostEndDate,
          joinStartDate,
          joinEndDate,
          rewards,
          evaluationMetric,
          perpsProvider,
          prizePools,
          rewardsIneligible,
          arenaId,
          engineId,
          engineVersion,
          vips,
          allowlist,
          blocklist,
          minRecallRank,
          allowlistOnly,
          agentAllocation,
          agentAllocationUnit,
          boosterAllocation,
          boosterAllocationUnit,
          rewardRules,
          rewardDetails,
          displayState,
        } = flatParse(AdminStartCompetitionSchema, req.body);

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
                  boostStartDate,
                  boostEndDate,
                  joinStartDate,
                  joinEndDate,
                  rewards,
                  evaluationMetric,
                  perpsProvider,
                  prizePools,
                  rewardsIneligible,
                  arenaId: arenaId!, // Guaranteed by Zod refinement when creating new competition
                  engineId,
                  engineVersion,
                  vips,
                  allowlist,
                  blocklist,
                  minRecallRank,
                  allowlistOnly,
                  agentAllocation,
                  agentAllocationUnit,
                  boosterAllocation,
                  boosterAllocationUnit,
                  rewardRules,
                  rewardDetails,
                  displayState,
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
        const { competitionId } = flatParse(
          AdminEndCompetitionSchema,
          req.body,
        );

        // End the competition
        const { competition: endedCompetition, leaderboard } =
          await services.competitionService.endCompetition(competitionId);

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
        const { competitionId } = flatParse(
          AdminUpdateCompetitionParamsSchema,
          req.params,
        );

        const {
          rewards,
          tradingConstraints,
          evaluationMetric,
          perpsProvider,
          prizePools,
          ...competitionUpdates
        } = flatParse(AdminUpdateCompetitionSchema, req.body);
        // Extract rewards, tradingConstraints, evaluationMetric, and perpsProvider from the validated data
        const updates = competitionUpdates;

        // Check if there are any updates to apply
        if (
          Object.keys(updates).length === 0 &&
          !rewards &&
          !tradingConstraints &&
          !evaluationMetric &&
          !perpsProvider &&
          !prizePools
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
            evaluationMetric,
            perpsProvider,
            prizePools,
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
        const { competitionId } = flatParse(
          AdminGetPerformanceReportsQuerySchema,
          req.query,
        );

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
        const { competitionId } = flatParse(
          AdminGetCompetitionSnapshotsParamsSchema,
          req.params,
        );

        // Validate query using flatParse
        const { agentId } = flatParse(
          AdminGetCompetitionSnapshotsQuerySchema,
          req.query,
        );

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
        const {
          limit = 50,
          offset = 0,
          sort = "-createdAt",
        } = flatParse(AdminListAllAgentsQuerySchema, req.query);

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
        const { agentId } = flatParse(AdminDeleteAgentParamsSchema, req.params);

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
        adminLogger.error({ error }, "Error deleting agent");
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
        const { agentId } = flatParse(
          AdminDeactivateAgentParamsSchema,
          req.params,
        );
        const { reason } = flatParse(AdminDeactivateAgentBodySchema, req.body);

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
        const { agentId } = flatParse(
          AdminReactivateAgentParamsSchema,
          req.params,
        );

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
        const { agentId } = flatParse(AdminGetAgentParamsSchema, req.params);

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
          isRewardsIneligible: agent.isRewardsIneligible,
          rewardsIneligibilityReason: agent.rewardsIneligibilityReason,
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
        const { agentId } = flatParse(AdminUpdateAgentParamsSchema, req.params);
        const {
          name,
          handle,
          description,
          imageUrl,
          email,
          metadata,
          isRewardsIneligible,
          rewardsIneligibilityReason,
        } = flatParse(AdminUpdateAgentBodySchema, req.body);

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
          isRewardsIneligible: isRewardsIneligible ?? agent.isRewardsIneligible,
          rewardsIneligibilityReason:
            rewardsIneligibilityReason ?? agent.rewardsIneligibilityReason,
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
          isRewardsIneligible: updatedAgent.isRewardsIneligible,
          rewardsIneligibilityReason: updatedAgent.rewardsIneligibilityReason,
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
        const { competitionId, agentId } = flatParse(
          AdminRemoveAgentFromCompetitionParamsSchema,
          req.params,
        );
        const { reason } = flatParse(
          AdminRemoveAgentFromCompetitionBodySchema,
          req.body,
        );

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
        const { competitionId, agentId } = flatParse(
          AdminReactivateAgentInCompetitionParamsSchema,
          req.params,
        );

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
        const { competitionId, agentId } = flatParse(
          AdminAddAgentToCompetitionParamsSchema,
          req.params,
        );

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

        // Validate wallet address for perps competitions
        if (competition.type === "perpetual_futures" && !agent.walletAddress) {
          return res.status(400).json({
            success: false,
            error:
              "Agent must have a wallet address to participate in perpetual futures competitions",
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
            competitionId,
            competition.type,
          );
        }

        // Add agent to competition using repository method
        try {
          await services.competitionRepository.addAgentToCompetition(
            competitionId,
            agentId,
          );
        } catch (error) {
          // Handle specific error for participant limit
          if (
            error instanceof Error &&
            error.message.includes("maximum participant limit")
          ) {
            throw new ApiError(409, error.message);
          }
          // Handle one-agent-per-user error
          if (
            error instanceof Error &&
            error.message.includes("already has an agent registered")
          ) {
            throw new ApiError(
              409,
              "This user already has another agent registered in this competition. Each user can only register one agent per competition.",
            );
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
        const { agentId } = flatParse(
          AdminGetAgentApiKeyParamsSchema,
          req.params,
        );

        // Get the decrypted API key using the agent manager
        const result =
          await services.agentService.getDecryptedApiKeyById(agentId);

        // Return the agent with the decrypted API key
        res.status(200).json({
          success: true,
          agent: {
            id: result.agent.id,
            name: result.agent.name,
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
     *
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
        const { competitionId } = flatParse(
          AdminGetCompetitionTransferViolationsParamsSchema,
          req.params,
        );

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

    /**
     * Allocate rewards for a competition
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async allocateRewards(req: Request, res: Response, next: NextFunction) {
      try {
        const { competitionId, startTimestamp } = flatParse(
          AdminRewardsAllocationSchema,
          req.body,
        );

        await services.rewardsService.calculateAndAllocate(
          competitionId,
          startTimestamp,
        );

        res.status(200).json({
          success: true,
          message: "Rewards allocated successfully",
          competitionId,
        });
      } catch (error) {
        adminLogger.error({ error }, "Error allocating rewards");
        next(error);
      }
    },

    /**
     * Add bonus boost to users
     * Stubbed endpoint - returns 501 Not Implemented
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async addBonusBoost(req: Request, res: Response, next: NextFunction) {
      try {
        // Validate request body
        const { boosts } = flatParse(AdminAddBonusBoostSchema, req.body);

        // Stubbed endpoint - return 501 Not Implemented
        res.status(501).json({
          success: false,
          error: "Not Implemented",
          message:
            "This endpoint is stubbed for API contract validation. Full implementation pending.",
          data: {
            requestedCount: boosts.length,
            note: "When implemented, this will process all boosts in the batch and return results for each item.",
          },
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Revoke bonus boost
     * Stubbed endpoint - returns 501 Not Implemented
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async revokeBonusBoost(req: Request, res: Response, next: NextFunction) {
      try {
        // Validate request body
        const { boostIds } = flatParse(AdminRevokeBonusBoostSchema, req.body);

        // Stubbed endpoint - return 501 Not Implemented
        res.status(501).json({
          success: false,
          error: "Not Implemented",
          message:
            "This endpoint is stubbed for API contract validation. Full implementation pending.",
          data: {
            requestedCount: boostIds.length,
            note: "When implemented, this will revoke all specified boosts and return results for each item.",
          },
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

export type AdminController = ReturnType<typeof makeAdminController>;
