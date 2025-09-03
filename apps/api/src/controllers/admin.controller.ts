import * as crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";

import {
  SelectCompetitionReward,
  UpdateCompetition,
} from "@recallnet/db-schema/core/types";

import { reloadSecurityConfig } from "@/config/index.js";
import { addAgentToCompetition } from "@/database/repositories/competition-repository.js";
import { flatParse } from "@/lib/flat-parse.js";
import { generateHandleFromName } from "@/lib/handle-utils.js";
import { adminLogger } from "@/lib/logger.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { ServiceRegistry } from "@/services/index.js";
import {
  ActorStatus,
  AdminCreateAgentSchema,
  User,
  UserMetadata,
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
import {
  checkUserUniqueConstraintViolation,
  parseAdminSearchQuery,
} from "./request-helpers.js";

// TODO: need user deactivation logic

// TODO: unify interfaces since these enforce "null" values vs `@/types/index.js` that uses undefined
// Also, types aren't really used anywhere else, so we should probably remove them?
interface Agent {
  id: string;
  ownerId: string;
  walletAddress: string | null;
  name: string;
  handle: string;
  description: string | null;
  imageUrl: string | null;
  apiKey: string;
  metadata: unknown;
  email: string | null;
  status: ActorStatus;
  createdAt: Date;
  updatedAt: Date;
}

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
  agents: Omit<Agent, "apiKey">[];
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
        // Check if any admin already exists
        const admins = await services.adminManager.getAllAdmins();
        const adminExists = admins.length > 0;

        if (adminExists) {
          throw new ApiError(
            403,
            "Admin setup is not allowed - an admin account already exists",
          );
        }

        // Validate request body using flatParse
        const result = flatParse(AdminSetupSchema, req.body);
        if (!result.success) {
          throw new ApiError(400, `Invalid request format: ${result.error}`);
        }

        const { username, password, email } = result.data;

        // Ensure that ROOT_ENCRYPTION_KEY exists in .env file
        try {
          // Find the correct .env file based on environment
          const envFile =
            process.env.NODE_ENV === "test" ? ".env.test" : ".env";
          const envPath = path.resolve(process.cwd(), envFile);
          adminLogger.info(`Checking for ${envFile} file at: ${envPath}`);

          if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, "utf8");
            const rootKeyPattern = /ROOT_ENCRYPTION_KEY=.*$/m;

            // Check if ROOT_ENCRYPTION_KEY already exists and is not the default
            const keyMatch = rootKeyPattern.exec(envContent);
            let needsNewKey = true;

            if (keyMatch) {
              const currentValue = keyMatch[0].split("=")[1];
              if (
                currentValue &&
                currentValue.length >= 32 &&
                !currentValue.includes("default_encryption_key") &&
                !currentValue.includes("your_") &&
                !currentValue.includes("dev_") &&
                !currentValue.includes("test_") &&
                !currentValue.includes("replace_in_production")
              ) {
                // Key exists and seems to be a proper key already
                adminLogger.info("ROOT_ENCRYPTION_KEY already exists in .env");
                needsNewKey = false;
              }
            }

            if (needsNewKey) {
              // Generate a new secure encryption key
              const newEncryptionKey = crypto.randomBytes(32).toString("hex");
              adminLogger.info("Generated new ROOT_ENCRYPTION_KEY");

              // Update the .env file
              let updatedEnvContent = envContent;

              if (keyMatch) {
                // Replace existing key
                updatedEnvContent = envContent.replace(
                  rootKeyPattern,
                  `ROOT_ENCRYPTION_KEY=${newEncryptionKey}`,
                );
              } else {
                // Add new key
                updatedEnvContent =
                  envContent.trim() +
                  `\n\nROOT_ENCRYPTION_KEY=${newEncryptionKey}\n`;
              }

              fs.writeFileSync(envPath, updatedEnvContent);
              adminLogger.info(
                `Updated ROOT_ENCRYPTION_KEY in ${envFile} file`,
              );

              // We need to update the process.env with the new key for it to be used immediately
              process.env.ROOT_ENCRYPTION_KEY = newEncryptionKey;

              // Reload the configuration to pick up the new encryption key
              reloadSecurityConfig();

              adminLogger.info(
                "✅ Configuration reloaded with new encryption key",
              );
            }
          } else {
            adminLogger.error(`${envFile} file not found at expected location`);
          }
        } catch (envError) {
          adminLogger.error("Error updating ROOT_ENCRYPTION_KEY:", envError);
          // Continue with admin setup even if the env update fails
        }

        // Setup the initial admin using AdminManager
        const adminResult = await services.adminManager.setupInitialAdmin(
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

        const {
          walletAddress,
          embeddedWalletAddress,
          privyId,
          name,
          email,
          userImageUrl,
          userMetadata,
          agentName,
          agentHandle,
          agentDescription,
          agentImageUrl,
          agentMetadata,
          agentWalletAddress,
        } = result.data;

        try {
          // Create the user
          const user = await services.userManager.registerUser(
            walletAddress,
            name,
            email,
            userImageUrl,
            userMetadata,
            privyId,
            embeddedWalletAddress,
          );

          let agent = null;

          // If agent details are provided, create an agent for this user
          if (agentName) {
            try {
              agent = await services.agentManager.createAgent({
                ownerId: user.id,
                name: agentName,
                handle: agentHandle ?? generateHandleFromName(agentName), // Auto-generate from name
                description: agentDescription,
                imageUrl: agentImageUrl,
                metadata: agentMetadata,
                walletAddress: agentWalletAddress,
              });
            } catch (agentError) {
              adminLogger.error("Error creating agent for user:", agentError);
              // If agent creation fails, we still return the user but note the agent error
              return res.status(201).json({
                success: true,
                user: {
                  id: user.id,
                  walletAddress: user.walletAddress,
                  walletLastVerifiedAt: user.walletLastVerifiedAt,
                  embeddedWalletAddress: user.embeddedWalletAddress,
                  name: user.name,
                  email: user.email,
                  isSubscribed: user.isSubscribed,
                  privyId: user.privyId,
                  imageUrl: user.imageUrl,
                  metadata: user.metadata,
                  status: user.status,
                  createdAt: user.createdAt,
                  updatedAt: user.updatedAt,
                  lastLoginAt: user.lastLoginAt,
                },
                agentError:
                  agentError instanceof Error
                    ? agentError.message
                    : "Failed to create agent",
              });
            }
          }

          // Return success with created user and agent
          const response: AdminUserRegistrationResponse = {
            success: true,
            user: {
              id: user.id,
              name: user.name ?? undefined,
              email: user.email ?? undefined,
              isSubscribed: user.isSubscribed,
              privyId: user.privyId ?? undefined,
              walletAddress: user.walletAddress,
              embeddedWalletAddress: user.embeddedWalletAddress ?? "",
              walletLastVerifiedAt: user.walletLastVerifiedAt ?? undefined,
              imageUrl: user.imageUrl ?? undefined,
              metadata: user.metadata
                ? (user.metadata as UserMetadata)
                : undefined,
              status: user.status as ActorStatus,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
              lastLoginAt: user.lastLoginAt ?? undefined,
            },
          };

          if (agent) {
            response.agent = {
              id: agent.id,
              ownerId: agent.ownerId,
              walletAddress: agent.walletAddress,
              name: agent.name,
              handle: agent.handle ?? generateHandleFromName(agent.name),
              description: agent.description,
              imageUrl: agent.imageUrl,
              apiKey: agent.apiKey,
              metadata: agent.metadata,
              status: agent.status as ActorStatus,
              email: agent.email,
              createdAt: agent.createdAt,
              updatedAt: agent.updatedAt,
            };
          }

          return res.status(201).json(response);
        } catch (error) {
          adminLogger.error("Error registering user:", error);

          // Check if this is an invalid wallet address error
          if (
            error instanceof Error &&
            (error.message.includes("Wallet address is required") ||
              error.message.includes("Invalid Ethereum address"))
          ) {
            return res.status(400).json({
              success: false,
              error: error.message,
            });
          }

          // Unique constraint violations → 409 Conflict with friendly message
          const violatedField = checkUserUniqueConstraintViolation(error);
          if (violatedField) {
            return res.status(409).json({
              success: false,
              error: `A user with this ${violatedField} already exists`,
            });
          }

          // Handle other errors
          return res.status(500).json({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Unknown error registering user",
          });
        }
      } catch (error) {
        adminLogger.error("Uncaught error in registerUser:", error);
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
        const { id: userId, walletAddress: userWalletAddress } = user;
        const {
          name,
          handle,
          email,
          walletAddress: agentWalletAddress,
          description,
          imageUrl,
          metadata,
        } = agent;

        // Check if a user with this wallet address already exists
        const existingUser = userWalletAddress
          ? await services.userManager.getUserByWalletAddress(userWalletAddress)
          : userId
            ? await services.userManager.getUser(userId)
            : undefined;

        if (!existingUser) {
          const errorMessage = `User '${userWalletAddress ? userWalletAddress : userId}' does not exist`;
          adminLogger.warn("User not found error:", errorMessage);
          return res.status(404).json({
            success: false,
            error: errorMessage,
          });
        }

        try {
          // Create the agent
          const agent = await services.agentManager.createAgent({
            ownerId: existingUser.id,
            name,
            handle: handle ?? generateHandleFromName(name),
            description,
            email,
            imageUrl,
            metadata: metadata ?? undefined,
            walletAddress: agentWalletAddress,
          });

          const response: AdminAgentRegistrationResponse = {
            success: true,
            agent: {
              ...agent,
              handle: agent.handle,
            },
          };

          return res.status(201).json(response);
        } catch (error) {
          adminLogger.error("Error registering agent:", error);

          // Check if this is a duplicate wallet address error that somehow got here
          if (
            error instanceof Error &&
            error.message.includes("already exists")
          ) {
            return res.status(409).json({
              success: false,
              error: error.message,
            });
          }

          // Check if this is an invalid wallet address error
          if (
            error instanceof Error &&
            (error.message.includes("Wallet address is required") ||
              error.message.includes("Invalid Ethereum address"))
          ) {
            return res.status(400).json({
              success: false,
              error: error.message,
            });
          }

          // Handle other errors
          return res.status(500).json({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Unknown error registering agent",
          });
        }
      } catch (error) {
        adminLogger.error("Uncaught error in registerUser:", error);
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
        } = result.data;

        // Create a new competition
        const competition = await services.competitionManager.createCompetition(
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
        // Validate request body using flatParse
        const result = flatParse(AdminStartCompetitionSchema, req.body);
        if (!result.success) {
          throw new ApiError(400, `Invalid request format: ${result.error}`);
        }

        const {
          competitionId,
          name,
          description,
          agentIds,
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
          tradingConstraints,
          rewards,
        } = result.data;

        // Validate that all provided agent IDs exist in the database and are active
        const invalidAgentIds: string[] = [];
        const validAgentIds: string[] = [];

        for (const agentId of agentIds) {
          const agent = await services.agentManager.getAgent(agentId);

          if (!agent) {
            invalidAgentIds.push(agentId);
            continue;
          }

          if (agent.status !== "active") {
            invalidAgentIds.push(agentId);
            continue;
          }

          validAgentIds.push(agentId);
        }

        // If there are invalid agent IDs, return an error with the list
        if (invalidAgentIds.length > 0) {
          throw new ApiError(
            400,
            `Cannot start competition: the following agent IDs are invalid or inactive: ${invalidAgentIds.join(", ")}`,
          );
        }

        let finalAgentIds = [...validAgentIds]; // Start with validated agent IDs

        // Get pre-registered agents from the database if we have a competitionId
        if (competitionId) {
          const competitionAgents =
            await services.competitionManager.getCompetitionAgentsWithMetrics(
              competitionId,
              {
                sort: "",
                limit: 1000,
                offset: 0,
              },
            );
          const registeredAgents = competitionAgents.agents.map(
            (agent) => agent.id,
          );
          // Combine with provided agentIds, removing duplicates
          const combinedAgents = [
            ...new Set([...finalAgentIds, ...registeredAgents]),
          ];
          finalAgentIds = combinedAgents;
        }

        // Now check if we have any agents to start the competition with
        if (finalAgentIds.length === 0) {
          throw new ApiError(
            400,
            "Cannot start competition: no valid active agents provided in agentIds and no agents have joined the competition",
          );
        }

        let competition;

        // Check if we're starting an existing competition or creating a new one
        if (competitionId) {
          // Get the existing competition
          competition =
            await services.competitionManager.getCompetition(competitionId);

          if (!competition) {
            throw new ApiError(404, "Competition not found");
          }

          // Verify competition is in PENDING state
          if (competition.status !== "pending") {
            throw new ApiError(
              400,
              `Competition is already in ${competition.status} state and cannot be started`,
            );
          }
        } else {
          // We need name to create a new competition
          // Schema validation ensures either competitionId or name is provided

          // Create a new competition
          competition = await services.competitionManager.createCompetition({
            name: name!,
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
            // Note: maxParticipants not available when starting new competition since this starting comps method has "dual" purpose actions
            maxParticipants: undefined,
            tradingConstraints,
            rewards,
          });
        }

        // Start the competition
        const startedCompetition =
          await services.competitionManager.startCompetition(
            competition.id,
            finalAgentIds,
            tradingConstraints,
          );

        // Return the started competition
        res.status(200).json({
          success: true,
          competition: {
            ...startedCompetition,
            agentIds: finalAgentIds,
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
          await services.competitionManager.endCompetition(competitionId);

        // Get final leaderboard
        const leaderboard =
          await services.competitionManager.getLeaderboard(competitionId);

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

        // Extract rewards and tradingConstraints from the validated data
        const { rewards, tradingConstraints, ...competitionUpdates } =
          bodyResult.data;
        const updates = competitionUpdates as UpdateCompetition;

        // Check if there are any updates to apply
        if (
          Object.keys(updates).length === 0 &&
          !rewards &&
          !tradingConstraints
        ) {
          throw new ApiError(400, "No valid fields provided for update");
        }

        // Update the competition
        const updatedCompetition =
          await services.competitionManager.updateCompetition(
            competitionId,
            updates,
          );

        // Update the trading constraints
        if (tradingConstraints) {
          await services.tradingConstraintsService.updateConstraints(
            competitionId,
            tradingConstraints,
          );
        }

        // Update the rewards
        let updatedRewards: SelectCompetitionReward[] = [];
        if (rewards) {
          updatedRewards =
            await services.competitionRewardService.replaceRewards(
              competitionId,
              rewards,
            );
        }

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
          await services.competitionManager.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Get leaderboard
        const leaderboard =
          await services.competitionManager.getLeaderboard(competitionId);

        // Get all users for agent owner names
        const users = await services.userManager.getAllUsers();

        // Map agent IDs to owner names
        const userMap = new Map(
          users.map((user) => [user.id, user.name || "Unknown User"]),
        );

        // Get only agents in this competition to map agent IDs to agent names and owners
        const agentIds = leaderboard.map((entry) => entry.agentId);
        const agents = await services.agentManager.getAgentsByIds(agentIds);
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
        const users = await services.userManager.getAllUsers();

        // Format the response to match the expected structure
        const formattedUsers = users.map((user) => ({
          id: user.id,
          walletAddress: user.walletAddress,
          walletLastVerifiedAt: user.walletLastVerifiedAt,
          embeddedWalletAddress: user.embeddedWalletAddress,
          name: user.name,
          email: user.email,
          isSubscribed: user.isSubscribed,
          privyId: user.privyId,
          status: user.status,
          imageUrl: user.imageUrl,
          metadata: user.metadata,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLoginAt: user.lastLoginAt,
        }));

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
          await services.competitionManager.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Get snapshots based on whether an agent ID was provided
        let snapshots;
        if (agentId) {
          // Check if the agent exists
          const agent = await services.agentManager.getAgent(agentId);
          if (!agent) {
            throw new ApiError(404, "Agent not found");
          }

          // Check if the agent is in the competition
          const agentInCompetition =
            await services.competitionManager.isAgentInCompetition(
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
            await services.portfolioSnapshotter.getAgentPortfolioSnapshots(
              competitionId,
              agentId,
            );
        } else {
          // Get snapshots for all agents in the competition (including inactive ones)
          const agents =
            await services.competitionManager.getAllCompetitionAgents(
              competitionId,
            );
          snapshots = [];

          for (const agentId of agents) {
            const agentSnapshots =
              await services.portfolioSnapshotter.getAgentPortfolioSnapshots(
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
          const users = await services.userManager.searchUsers(user);

          results.users = users.map((user) => ({
            id: user.id,
            walletAddress: user.walletAddress,
            walletLastVerifiedAt: user.walletLastVerifiedAt ?? undefined,
            name: user.name ?? undefined,
            email: user.email ?? undefined,
            isSubscribed: user.isSubscribed,
            privyId: user.privyId ?? undefined,
            embeddedWalletAddress: user.embeddedWalletAddress ?? undefined,
            status: user.status,
            imageUrl: user.imageUrl ?? undefined,
            metadata: user.metadata
              ? (user.metadata as UserMetadata)
              : undefined,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            lastLoginAt: user.lastLoginAt ?? undefined,
          }));
        }

        // Search agents if requested
        if (agent) {
          const agents = await services.agentManager.searchAgents(agent);

          results.agents = agents.map((agent) => ({
            id: agent.id,
            ownerId: agent.ownerId,
            walletAddress: agent.walletAddress,
            name: agent.name,
            handle: agent.handle,
            description: agent.description,
            status: agent.status,
            imageUrl: agent.imageUrl,
            metadata: agent.metadata,
            email: agent.email,
            createdAt: agent.createdAt,
            updatedAt: agent.updatedAt,
          }));
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
        const agents = await services.agentManager.getAgents({
          pagingParams: { limit, offset, sort },
        });

        // Get total count for pagination metadata
        const totalCount = await services.agentManager.countAgents();

        // Format the agents for the response
        const formattedAgents = agents.map((agent) => ({
          id: agent.id,
          ownerId: agent.ownerId,
          walletAddress: agent.walletAddress,
          name: agent.name,
          handle: agent.handle,
          email: agent.email,
          description: agent.description,
          status: agent.status,
          imageUrl: agent.imageUrl,
          metadata: agent.metadata,
          createdAt: agent.createdAt,
          updatedAt: agent.updatedAt,
        }));

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
        const agent = await services.agentManager.getAgent(agentId);

        if (!agent) {
          return res.status(404).json({
            success: false,
            error: "Agent not found",
          });
        }

        // Delete the agent
        const deleted = await services.agentManager.deleteAgent(agentId);

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
        const agent = await services.agentManager.getAgent(agentId);

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
        const deactivatedAgent = await services.agentManager.deactivateAgent(
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
        const agent = await services.agentManager.getAgent(agentId);

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
          await services.agentManager.reactivateAgent(agentId);

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
        const agent = await services.agentManager.getAgent(agentId);

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
        const agent = await services.agentManager.getAgent(agentId);
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

        const updatedAgent = await services.agentManager.updateAgent({
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
          await services.competitionManager.getCompetition(competitionId);
        if (!competition) {
          return res.status(404).json({
            success: false,
            error: "Competition not found",
          });
        }

        // Check if agent exists
        const agent = await services.agentManager.getAgent(agentId);
        if (!agent) {
          return res.status(404).json({
            success: false,
            error: "Agent not found",
          });
        }

        // Check if agent is in the competition
        const isInCompetition =
          await services.competitionManager.isAgentInCompetition(
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
        await services.competitionManager.removeAgentFromCompetition(
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
          await services.competitionManager.getCompetition(competitionId);
        if (!competition) {
          return res.status(404).json({
            success: false,
            error: "Competition not found",
          });
        }

        // Check if agent exists
        const agent = await services.agentManager.getAgent(agentId);
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
          await services.competitionManager.isAgentInCompetition(
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
        await services.competitionManager.reactivateAgentInCompetition(
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
          await services.competitionManager.getCompetition(competitionId);
        if (!competition) {
          return res.status(404).json({
            success: false,
            error: "Competition not found",
          });
        }

        // Check if agent exists
        const agent = await services.agentManager.getAgent(agentId);
        if (!agent) {
          return res.status(404).json({
            success: false,
            error: "Agent not found",
          });
        }

        // Check if agent owner's email is verified (security layer)
        const owner = await services.userManager.getUser(agent.ownerId);
        if (!owner) {
          return res.status(404).json({
            success: false,
            error: "Agent owner not found",
          });
        }

        // Check if agent is already in the competition
        const isInCompetition =
          await services.competitionManager.isAgentInCompetition(
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

        // Apply sandbox mode logic if the competition is in sandbox mode
        if (competition.sandboxMode) {
          adminLogger.info(
            `Applying sandbox mode logic for agent ${agentId} in competition ${competitionId}`,
          );

          // Reset the agent's balances to starting values (consistent with startCompetition order)
          await services.balanceManager.resetAgentBalances(agentId);
        }

        // Add agent to competition using repository method
        await addAgentToCompetition(competitionId, agentId);

        // Complete sandbox mode logic if enabled
        if (competition.sandboxMode) {
          // Take a portfolio snapshot for the newly joined agent
          await services.portfolioSnapshotter.takePortfolioSnapshotForAgent(
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
          await services.agentManager.getDecryptedApiKeyById(agentId);

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
  };
}

export type AdminController = ReturnType<typeof makeAdminController>;
