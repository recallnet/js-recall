import * as crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";

import { reloadSecurityConfig } from "@/config/index.js";
import { isAgentInCompetition } from "@/database/repositories/agent-repository.js";
import { getCompetitionAgents } from "@/database/repositories/competition-repository.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { ServiceRegistry } from "@/services/index.js";
import {
  AgentSearchParams,
  CompetitionStatus,
  CrossChainTradingType,
  UserSearchParams,
} from "@/types/index.js";

interface UserRegistrationResponse {
  success: true;
  user: {
    id: string;
    walletAddress: string;
    name: string | null;
    email: string | null;
    imageUrl: string | null;
    status: string;
    createdAt: Date;
  };
  agent?: {
    id: string;
    ownerId: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    apiKey: string;
    status: string;
    createdAt: Date;
  };
  agentError?: string;
}

interface SearchResults {
  users: Array<{
    type: "user";
    id: string;
    walletAddress: string;
    name: string | null;
    email: string | null;
    status: string;
    imageUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  agents: Array<{
    type: "agent";
    id: string;
    ownerId: string;
    name: string;
    description: string | null;
    status: string;
    imageUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
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
              agent = await services.agentManager.createAgent(
                user.id,
                agentName,
                agentDescription,
                agentMetadata,
                agentImageUrl,
              );
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
                  status: user.status,
                  createdAt: user.createdAt,
                },
                agentError:
                  agentError instanceof Error
                    ? agentError.message
                    : "Failed to create agent",
              });
            }
          }

          // Return success with created user and agent
          const response: UserRegistrationResponse = {
            success: true,
            user: {
              id: user.id,
              walletAddress: user.walletAddress,
              name: user.name,
              email: user.email,
              imageUrl: user.imageUrl,
              status: user.status,
              createdAt: user.createdAt,
            },
          };

          if (agent) {
            response.agent = {
              id: agent.id,
              ownerId: agent.ownerId,
              name: agent.name,
              description: agent.description,
              imageUrl: agent.imageUrl,
              apiKey: agent.apiKey,
              status: agent.status,
              createdAt: agent.createdAt,
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
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async createCompetition(req: Request, res: Response, next: NextFunction) {
      try {
        const { name, description, tradingType, externalLink, imageUrl } =
          req.body;

        // Validate required parameters
        if (!name) {
          throw new ApiError(400, "Missing required parameter: name");
        }

        // Create a new competition
        const competition = await services.competitionManager.createCompetition(
          name,
          description,
          tradingType || CrossChainTradingType.disallowAll,
          externalLink,
          imageUrl,
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
          teamIds,
          tradingType,
          externalLink,
          imageUrl,
        } = req.body;

        // Validate required parameters
        if (!teamIds || !Array.isArray(teamIds) || teamIds.length === 0) {
          throw new ApiError(
            400,
            "Missing required parameter: teamIds (array)",
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
          if (competition.status !== CompetitionStatus.PENDING) {
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
            tradingType || CrossChainTradingType.disallowAll,
            externalLink,
            imageUrl,
          );
        }

        // Start the competition
        const startedCompetition =
          await services.competitionManager.startCompetition(
            competition.id,
            teamIds,
          );

        // Return the started competition
        res.status(200).json({
          success: true,
          competition: {
            ...startedCompetition,
            teamIds,
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
     * Delete a team
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async deleteTeam(req: Request, res: Response, next: NextFunction) {
      try {
        const { teamId } = req.params;

        if (!teamId) {
          return res.status(400).json({
            success: false,
            error: "Team ID is required",
          });
        }

        // Get the team first to check if it exists and is not an admin
        const team = await services.teamManager.getTeam(teamId);

        if (!team) {
          return res.status(404).json({
            success: false,
            error: "Team not found",
          });
        }

        // Prevent deletion of admin teams
        if (team.isAdmin) {
          return res.status(403).json({
            success: false,
            error: "Cannot delete admin accounts",
          });
        }

        // Delete the team
        const deleted = await services.teamManager.deleteTeam(teamId);

        if (deleted) {
          return res.status(200).json({
            success: true,
            message: "Team successfully deleted",
          });
        } else {
          return res.status(500).json({
            success: false,
            error: "Failed to delete team",
          });
        }
      } catch (error) {
        console.error("[AdminController] Error deleting team:", error);
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
          const agentInCompetition = await isAgentInCompetition(
            agentId,
            competitionId,
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
          // Get snapshots for all agents in the competition
          const agents = await getCompetitionAgents(competitionId);
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
     * Deactivate a team
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async deactivateTeam(req: Request, res: Response, next: NextFunction) {
      try {
        const { teamId } = req.params;
        const { reason } = req.body;

        // Validate required parameters
        if (!teamId) {
          return res.status(400).json({
            success: false,
            error: "Team ID is required",
          });
        }

        if (!reason) {
          return res.status(400).json({
            success: false,
            error: "Reason for deactivation is required",
          });
        }

        // Get the team first to check if it exists and is not an admin
        const team = await services.teamManager.getTeam(teamId);

        if (!team) {
          return res.status(404).json({
            success: false,
            error: "Team not found",
          });
        }

        // Prevent deactivation of admin teams
        if (team.isAdmin) {
          return res.status(403).json({
            success: false,
            error: "Cannot deactivate admin accounts",
          });
        }

        // Check if team is already inactive
        if (team.active === false) {
          return res.status(400).json({
            success: false,
            error: "Team is already inactive",
            team: {
              id: team.id,
              name: team.name,
              active: false,
              deactivationReason: team.deactivationReason,
              deactivationDate: team.deactivationDate,
            },
          });
        }

        // Deactivate the team
        const deactivatedTeam = await services.teamManager.deactivateTeam(
          teamId,
          reason,
        );

        if (!deactivatedTeam) {
          return res.status(500).json({
            success: false,
            error: "Failed to deactivate team",
          });
        }

        // Return the updated team info
        res.status(200).json({
          success: true,
          team: {
            id: deactivatedTeam.id,
            name: deactivatedTeam.name,
            active: false,
            deactivationReason: deactivatedTeam.deactivationReason,
            deactivationDate: deactivatedTeam.deactivationDate,
          },
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Reactivate a team
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async reactivateTeam(req: Request, res: Response, next: NextFunction) {
      try {
        const { teamId } = req.params;

        // Validate required parameters
        if (!teamId) {
          return res.status(400).json({
            success: false,
            error: "Team ID is required",
          });
        }

        // Get the team first to check if it exists and is actually inactive
        const team = await services.teamManager.getTeam(teamId);

        if (!team) {
          return res.status(404).json({
            success: false,
            error: "Team not found",
          });
        }

        // Check if team is already active
        if (team.active !== false) {
          return res.status(400).json({
            success: false,
            error: "Team is already active",
            team: {
              id: team.id,
              name: team.name,
              active: true,
            },
          });
        }

        // Reactivate the team
        const reactivatedTeam =
          await services.teamManager.reactivateTeam(teamId);

        if (!reactivatedTeam) {
          return res.status(500).json({
            success: false,
            error: "Failed to reactivate team",
          });
        }

        // Return the updated team info
        res.status(200).json({
          success: true,
          team: {
            id: reactivatedTeam.id,
            name: reactivatedTeam.name,
            active: true,
          },
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get a team by ID
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async getTeam(req: Request, res: Response, next: NextFunction) {
      try {
        const { teamId } = req.params;

        if (!teamId) {
          return res.status(400).json({
            success: false,
            error: "Team ID is required",
          });
        }

        // Get the team
        const team = await services.teamManager.getTeam(teamId);

        if (!team) {
          return res.status(404).json({
            success: false,
            error: "Team not found",
          });
        }

        // Format the response
        const formattedTeam = {
          id: team.id,
          name: team.name,
          email: team.email,
          contactPerson: team.contactPerson,
          active: team.active,
          deactivationReason: team.deactivationReason,
          deactivationDate: team.deactivationDate,
          imageUrl: team.imageUrl,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
          isAdmin: team.isAdmin,
        };

        // Return the team
        res.status(200).json({
          success: true,
          team: formattedTeam,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get a team's API key
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async getTeamApiKey(req: Request, res: Response, next: NextFunction) {
      try {
        const { teamId } = req.params;

        if (!teamId) {
          throw new ApiError(400, "Team ID is required");
        }

        // Get the decrypted API key using the service method
        // The service method now handles team lookup and admin validation
        const result =
          await services.teamManager.getDecryptedApiKeyById(teamId);

        if (!result.success) {
          // If there was an error, use the error code and message from the service
          throw new ApiError(
            result.errorCode || 500,
            result.errorMessage || "Unknown error",
          );
        }

        // Return the team with the decrypted API key
        res.status(200).json({
          success: true,
          team: {
            id: result.team?.id || teamId,
            name: result.team?.name || "Unknown",
            apiKey: result.apiKey,
          },
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
        const results: SearchResults = {
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
            type: "user",
            id: user.id,
            walletAddress: user.walletAddress,
            name: user.name,
            email: user.email,
            status: user.status,
            imageUrl: user.imageUrl,
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
            type: "agent",
            id: agent.id,
            ownerId: agent.ownerId,
            name: agent.name,
            description: agent.description,
            status: agent.status,
            imageUrl: agent.imageUrl,
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
  };
}

export type AdminController = ReturnType<typeof makeAdminController>;
