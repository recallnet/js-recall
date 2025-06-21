import * as crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";

import { reloadSecurityConfig } from "@/config/index.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { ServiceRegistry } from "@/services/index.js";
import {
  ActorStatus,
  AgentSearchParams,
  COMPETITION_STATUS,
  CROSS_CHAIN_TRADING_TYPE,
  UserSearchParams,
} from "@/types/index.js";

import { ensureCompetitionUpdate, ensureUuid } from "./request-helpers.js";

// TODO: need user deactivation logic

// TODO: unify interfaces since these enforce "null" values vs `@/types/index.js` that uses undefined
// Also, types aren't really used anywhere else, so we should probably remove them?
interface Agent {
  id: string;
  ownerId: string;
  walletAddress: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  apiKey: string;
  metadata: unknown;
  email: string | null;
  status: ActorStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface User {
  id: string;
  walletAddress: string;
  name: string | null;
  email: string | null;
  imageUrl: string | null;
  metadata: unknown;
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
  searchType: string;
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

        // Validate required parameters
        const { username, password, email } = req.body;
        if (!username || !password || !email) {
          throw new ApiError(
            400,
            "Missing required parameters: username, password, email",
          );
        }

        // Validate password strength
        if (password.length < 8) {
          throw new ApiError(
            400,
            "Password must be at least 8 characters long",
          );
        }

        // Ensure that ROOT_ENCRYPTION_KEY exists in .env file
        try {
          // Find the correct .env file based on environment
          const envFile =
            process.env.NODE_ENV === "test" ? ".env.test" : ".env";
          const envPath = path.resolve(process.cwd(), envFile);
          console.log(
            `[AdminController] Checking for ${envFile} file at: ${envPath}`,
          );

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
                console.log(
                  "[AdminController] ROOT_ENCRYPTION_KEY already exists in .env",
                );
                needsNewKey = false;
              }
            }

            if (needsNewKey) {
              // Generate a new secure encryption key
              const newEncryptionKey = crypto.randomBytes(32).toString("hex");
              console.log(
                "[AdminController] Generated new ROOT_ENCRYPTION_KEY",
              );

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
              console.log(
                `[AdminController] Updated ROOT_ENCRYPTION_KEY in ${envFile} file`,
              );

              // We need to update the process.env with the new key for it to be used immediately
              process.env.ROOT_ENCRYPTION_KEY = newEncryptionKey;

              // Reload the configuration to pick up the new encryption key
              reloadSecurityConfig();

              console.log(
                "[AdminController] ✅ Configuration reloaded with new encryption key",
              );
            }
          } else {
            console.error(
              `[AdminController] ${envFile} file not found at expected location`,
            );
          }
        } catch (envError) {
          console.error(
            "[AdminController] Error updating ROOT_ENCRYPTION_KEY:",
            envError,
          );
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
        const {
          walletAddress,
          name,
          email,
          userImageUrl,
          agentName,
          agentDescription,
          agentImageUrl,
          agentMetadata,
          agentWalletAddress,
        } = req.body;

        // Validate required parameters
        if (!walletAddress) {
          return res.status(400).json({
            success: false,
            error: "Missing required parameter: walletAddress",
          });
        }

        // Check if a user with this wallet address already exists
        const existingUser =
          await services.userManager.getUserByWalletAddress(walletAddress);

        if (existingUser) {
          const errorMessage = `A user with wallet address ${walletAddress} already exists`;
          console.log(
            "[AdminController] Duplicate wallet address error:",
            errorMessage,
          );
          return res.status(409).json({
            success: false,
            error: errorMessage,
          });
        }

        try {
          // Create the user
          const user = await services.userManager.registerUser(
            walletAddress,
            name,
            email,
            userImageUrl,
          );

          let agent = null;

          // If agent details are provided, create an agent for this user
          if (agentName) {
            try {
              agent = await services.agentManager.createAgent({
                ownerId: user.id,
                name: agentName,
                description: agentDescription,
                imageUrl: agentImageUrl,
                metadata: agentMetadata,
                walletAddress: agentWalletAddress,
              });
            } catch (agentError) {
              console.error(
                "[AdminController] Error creating agent for user:",
                agentError,
              );
              // If agent creation fails, we still return the user but note the agent error
              return res.status(201).json({
                success: true,
                user: {
                  id: user.id,
                  walletAddress: user.walletAddress,
                  name: user.name,
                  email: user.email,
                  imageUrl: user.imageUrl,
                  metadata: user.metadata,
                  status: user.status,
                  createdAt: user.createdAt,
                  updatedAt: user.updatedAt,
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
              walletAddress: user.walletAddress,
              name: user.name,
              email: user.email,
              imageUrl: user.imageUrl,
              metadata: user.metadata,
              status: user.status as ActorStatus,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            },
          };

          if (agent) {
            response.agent = {
              id: agent.id,
              ownerId: agent.ownerId,
              walletAddress: agent.walletAddress,
              name: agent.name,
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
          console.error("[AdminController] Error registering user:", error);

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
                : "Unknown error registering user",
          });
        }
      } catch (error) {
        console.error(
          "[AdminController] Uncaught error in registerUser:",
          error,
        );
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
        const {
          userId,
          walletAddress,
          name,
          email,
          description,
          imageUrl,
          metadata,
        } = req.body;

        // Validate required parameters
        if (!walletAddress || !userId) {
          return res.status(400).json({
            success: false,
            error: "Missing required parameter: walletAddress or userId",
          });
        }

        // Check if a user with this wallet address already exists
        const existingUser = userId
          ? await services.userManager.getUser(userId)
          : await services.userManager.getUserByWalletAddress(walletAddress);

        if (existingUser) {
          const errorMessage = `A user with wallet address ${
            userId ? userId : walletAddress
          } already exists`;
          console.log(
            "[AdminController] Duplicate wallet address error:",
            errorMessage,
          );
          return res.status(409).json({
            success: false,
            error: errorMessage,
          });
        }

        try {
          // Create the agent
          const agent = await services.agentManager.createAgent({
            ownerId: userId,
            name,
            description,
            email,
            imageUrl,
            metadata,
          });
          const response: AdminAgentRegistrationResponse = {
            success: true,
            agent: {
              ...agent,
              status: agent.status as ActorStatus,
            },
          };

          return res.status(201).json(response);
        } catch (error) {
          console.error("[AdminController] Error registering agent:", error);

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
        console.error(
          "[AdminController] Uncaught error in registerUser:",
          error,
        );
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
          externalUrl,
          imageUrl,
          type,
          votingStartDate,
          votingEndDate,
        } = req.body;

        // Validate required parameters
        if (!name) {
          throw new ApiError(400, "Missing required parameter: name");
        }

        // Create a new competition
        const competition = await services.competitionManager.createCompetition(
          name,
          description,
          tradingType || CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
          externalUrl,
          imageUrl,
          type,
          votingStartDate ? new Date(votingStartDate) : undefined,
          votingEndDate ? new Date(votingEndDate) : undefined,
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
        const {
          competitionId,
          name,
          description,
          agentIds,
          tradingType,
          externalUrl,
          imageUrl,
          votingStartDate,
          votingEndDate,
        } = req.body;

        // Validate required parameters
        if (!agentIds || !Array.isArray(agentIds)) {
          throw new ApiError(
            400,
            "Missing required parameter: agentIds (must be an array, can be empty)",
          );
        }

        let finalAgentIds = [...agentIds]; // Start with provided agent IDs

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
            "Cannot start competition: no agents provided in agentIds and no agents have joined the competition",
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
          if (competition.status !== COMPETITION_STATUS.PENDING) {
            throw new ApiError(
              400,
              `Competition is already in ${competition.status} state and cannot be started`,
            );
          }
        } else {
          // We need name to create a new competition
          if (!name) {
            throw new ApiError(
              400,
              "Missing required parameter: name (required when competitionId is not provided)",
            );
          }

          // Create a new competition
          competition = await services.competitionManager.createCompetition(
            name,
            description,
            tradingType || CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
            externalUrl,
            imageUrl,
            undefined, // type parameter (will use default)
            votingStartDate ? new Date(votingStartDate) : undefined,
            votingEndDate ? new Date(votingEndDate) : undefined,
          );
        }

        // Start the competition
        const startedCompetition =
          await services.competitionManager.startCompetition(
            competition.id,
            finalAgentIds,
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
        const { competitionId } = req.body;

        // Validate required parameters
        if (!competitionId) {
          throw new ApiError(400, "Missing required parameter: competitionId");
        }

        // End the competition
        const endedCompetition =
          await services.competitionManager.endCompetition(competitionId);

        // Get final leaderboard
        const leaderboard =
          await services.competitionManager.getLeaderboard(competitionId);

        // Populate object_index with competition data
        try {
          await services.objectIndexService.populateTrades(competitionId);
          await services.objectIndexService.populateAgentRankHistory(competitionId);
          await services.objectIndexService.populateCompetitionsLeaderboard(competitionId);
          console.log(`Successfully populated object_index for competition ${competitionId}`);
        } catch (error) {
          console.error(`Failed to populate object_index for competition ${competitionId}:`, error);
          // Don't fail the request if object_index population fails
        }

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
     * Manually trigger object index population
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async syncObjectIndex(req: Request, res: Response, next: NextFunction) {
      try {
        const { competitionId, dataTypes } = req.body;

        const typesToSync = dataTypes || ['trade', 'agent_rank_history', 'competitions_leaderboard'];
        
        console.log(`Starting object index sync for types: ${typesToSync.join(', ')}`);
        
        for (const dataType of typesToSync) {
          try {
            switch (dataType) {
              case 'trade':
                await services.objectIndexService.populateTrades(competitionId);
                break;
              case 'agent_rank_history':
                await services.objectIndexService.populateAgentRankHistory(competitionId);
                break;
              case 'competitions_leaderboard':
                await services.objectIndexService.populateCompetitionsLeaderboard(competitionId);
                break;
              case 'portfolio_snapshot':
                await services.objectIndexService.populatePortfolioSnapshots(competitionId);
                break;
              case 'agent_rank':
                await services.objectIndexService.populateAgentRank();
                break;
              default:
                console.warn(`Unknown data type: ${dataType}`);
            }
          } catch (error) {
            console.error(`Error syncing ${dataType}:`, error);
            throw error;
          }
        }

        res.status(200).json({
          success: true,
          message: 'Object index sync initiated',
          dataTypes: typesToSync,
          competitionId: competitionId || 'all'
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
        const competitionId = ensureUuid(req.params.competitionId);
        const updates = ensureCompetitionUpdate(req);

        // Check if there are any updates to apply
        if (Object.keys(updates).length === 0) {
          throw new ApiError(400, "No valid fields provided for update");
        }

        // Update the competition
        const updatedCompetition =
          await services.competitionManager.updateCompetition(
            competitionId,
            updates,
          );

        // Return the updated competition
        res.status(200).json({
          success: true,
          competition: updatedCompetition,
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
        const { competitionId } = req.query;

        // Validate required parameters
        if (!competitionId) {
          throw new ApiError(400, "Missing required parameter: competitionId");
        }

        // Get the competition
        const competition = await services.competitionManager.getCompetition(
          competitionId as string,
        );
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Get leaderboard
        const leaderboard = await services.competitionManager.getLeaderboard(
          competitionId as string,
        );

        // Get all users for agent owner names
        const users = await services.userManager.getAllUsers();

        // Map agent IDs to owner names
        const userMap = new Map(
          users.map((user) => [user.id, user.name || "Unknown User"]),
        );

        // Get all agents to map agent IDs to agent names and owners
        const agents = await services.agentManager.getAllAgents();
        const agentMap = new Map(
          agents.map((agent) => [
            agent.id,
            {
              name: agent.name,
              ownerName: userMap.get(agent.ownerId) || "Unknown Owner",
            },
          ]),
        );

        // Format leaderboard with agent and owner names
        const formattedLeaderboard = leaderboard.map((entry, index) => ({
          rank: index + 1,
          agentId: entry.agentId,
          agentName: agentMap.get(entry.agentId)?.name || "Unknown Agent",
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
          name: user.name,
          email: user.email,
          status: user.status,
          imageUrl: user.imageUrl,
          metadata: user.metadata,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
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
        const { competitionId } = req.params;

        // Validate required parameters
        if (!competitionId) {
          throw new ApiError(400, "Missing required parameter: competitionId");
        }

        // Check if the competition exists
        const competition =
          await services.competitionManager.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Get agent ID from query param if provided
        const agentId = req.query.agentId as string;

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
        const {
          email,
          name,
          walletAddress,
          status,
          searchType, // 'users', 'agents', or 'both' (default)
        } = req.query;

        const searchTypeFilter = (searchType as string) || "both";
        const results: AdminSearchResults = {
          users: [],
          agents: [],
        };

        // Search users if requested
        if (searchTypeFilter === "users" || searchTypeFilter === "both") {
          const userSearchParams: UserSearchParams = {};

          if (email) userSearchParams.email = email as string;
          if (name) userSearchParams.name = name as string;
          if (walletAddress)
            userSearchParams.walletAddress = walletAddress as string;
          if (status)
            userSearchParams.status = status as
              | "active"
              | "suspended"
              | "deleted";

          const users =
            await services.userManager.searchUsers(userSearchParams);

          results.users = users.map((user) => ({
            id: user.id,
            walletAddress: user.walletAddress,
            name: user.name,
            email: user.email,
            status: user.status as ActorStatus,
            imageUrl: user.imageUrl,
            metadata: user.metadata,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          }));
        }

        // Search agents if requested
        if (searchTypeFilter === "agents" || searchTypeFilter === "both") {
          const agentSearchParams: AgentSearchParams = {};

          if (name) agentSearchParams.name = name as string;
          if (status)
            agentSearchParams.status = status as
              | "active"
              | "suspended"
              | "deleted";

          const agents =
            await services.agentManager.searchAgents(agentSearchParams);

          results.agents = agents.map((agent) => ({
            id: agent.id,
            ownerId: agent.ownerId,
            walletAddress: agent.walletAddress,
            name: agent.name,
            description: agent.description,
            status: agent.status as ActorStatus,
            imageUrl: agent.imageUrl,
            metadata: agent.metadata,
            email: agent.email,
            createdAt: agent.createdAt,
            updatedAt: agent.updatedAt,
          }));
        }

        // Return the search results
        res.status(200).json({
          success: true,
          searchType: searchTypeFilter,
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
        // Get all agents from the database
        const agents = await services.agentManager.getAllAgents();

        // Format the agents for the response
        const formattedAgents = agents.map((agent) => ({
          id: agent.id,
          ownerId: agent.ownerId,
          walletAddress: agent.walletAddress,
          name: agent.name,
          description: agent.description,
          status: agent.status,
          imageUrl: agent.imageUrl,
          metadata: agent.metadata,
          createdAt: agent.createdAt,
          updatedAt: agent.updatedAt,
        }));

        // Return the agents
        res.status(200).json({
          success: true,
          agents: formattedAgents,
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
        const { agentId } = req.params;

        if (!agentId) {
          return res.status(400).json({
            success: false,
            error: "Agent ID is required",
          });
        }

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
        console.error("[AdminController] Error deleting agent:", error);
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
        const { agentId } = req.params;
        const { reason } = req.body;

        // Validate required parameters
        if (!agentId) {
          return res.status(400).json({
            success: false,
            error: "Agent ID is required",
          });
        }

        if (!reason) {
          return res.status(400).json({
            success: false,
            error: "Reason for deactivation is required",
          });
        }

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
        const { agentId } = req.params;

        // Validate required parameters
        if (!agentId) {
          return res.status(400).json({
            success: false,
            error: "Agent ID is required",
          });
        }

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
        const { agentId } = req.params;

        if (!agentId) {
          return res.status(400).json({
            success: false,
            error: "Agent ID is required",
          });
        }

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
        const { competitionId, agentId } = req.params;
        const { reason } = req.body;

        // Validate required parameters
        if (!competitionId) {
          return res.status(400).json({
            success: false,
            error: "Competition ID is required",
          });
        }

        if (!agentId) {
          return res.status(400).json({
            success: false,
            error: "Agent ID is required",
          });
        }

        if (!reason) {
          return res.status(400).json({
            success: false,
            error: "Reason for removal is required",
          });
        }

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
        const { competitionId, agentId } = req.params;

        // Validate required parameters
        if (!competitionId) {
          return res.status(400).json({
            success: false,
            error: "Competition ID is required",
          });
        }

        if (!agentId) {
          return res.status(400).json({
            success: false,
            error: "Agent ID is required",
          });
        }

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
        if (competition.status === COMPETITION_STATUS.ENDED) {
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
     * Get an agent's API key
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async getAgentApiKey(req: Request, res: Response, next: NextFunction) {
      try {
        const { agentId } = req.params;

        if (!agentId) {
          throw new ApiError(400, "Agent ID is required");
        }

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
