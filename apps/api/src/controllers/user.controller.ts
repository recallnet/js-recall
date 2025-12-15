import { NextFunction, Request, Response } from "express";

import {
  buildPaginationResponse,
  verifyPrivyUserHasLinkedWallet,
} from "@recallnet/services/lib";
import {
  AgentCompetitionsParamsSchema,
  ApiError,
  CreateAgentSchema,
  GetUserAgentSchema,
  LinkUserWalletSchema,
  UpdateUserAgentProfileSchema,
  UpdateUserProfileSchema,
  UuidSchema,
} from "@recallnet/services/types";

import { ServiceRegistry } from "@/services/index.js";

import {
  ensurePaging,
  ensurePrivyIdentityToken,
  ensureUserId,
} from "./request-helpers.js";

/**
 * User Controller
 * Handles user-specific operations with SIWE session authentication
 * Sets req.userId from authenticated session
 */
export function makeUserController(services: ServiceRegistry) {
  return {
    /**
     * Get profile for the authenticated user
     * @param req Express request with userId from session
     * @param res Express response
     * @param next Express next function
     */
    async getProfile(req: Request, res: Response, next: NextFunction) {
      try {
        const { success, data, error } = UuidSchema.safeParse(req.userId);
        if (!success) {
          throw new ApiError(400, `Invalid request format: ${error.message}`);
        }
        const userId = data;

        // Get the user using the service
        const user = await services.userService.getUser(userId);

        if (!user) {
          throw new ApiError(404, "User not found");
        }

        // Return the user profile (excluding sensitive fields)
        res.status(200).json({
          success: true,
          user,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Update profile for the authenticated user
     * Limited to name and imageUrl only (user self-service)
     * @param req Express request with userId from session
     * @param res Express response
     * @param next Express next function
     */
    async updateProfile(req: Request, res: Response, next: NextFunction) {
      try {
        const { success, data, error } = UpdateUserProfileSchema.safeParse({
          userId: req.userId,
          body: req.body,
        });
        if (!success) {
          throw new ApiError(400, `Invalid request format: ${error.message}`);
        }
        const {
          userId,
          body: { name, imageUrl, metadata },
        } = data;

        // Get the current user
        const user = await services.userService.getUser(userId);
        if (!user) {
          throw new ApiError(404, "User not found");
        }

        // Prepare update data with only allowed fields
        const updateData = {
          id: userId,
          name,
          imageUrl,
          metadata,
        };

        // Update the user using UserManager
        const updatedUser = await services.userService.updateUser(updateData);

        if (!updatedUser) {
          throw new ApiError(500, "Failed to update user profile");
        }

        // Return the updated user profile
        res.status(200).json({
          success: true,
          user: updatedUser,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Link a wallet to the authenticated user
     * @param req Express request with userId & privyToken from session, and the new wallet address
     * @param res Express response
     * @param next Express next function
     */
    async linkWallet(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = ensureUserId(req);
        const privyToken = ensurePrivyIdentityToken(req);
        const { success, data, error } = LinkUserWalletSchema.safeParse(
          req.body,
        );
        if (!success) {
          throw new ApiError(400, `Invalid request format: ${error.message}`);
        }
        const { walletAddress } = data;

        // Verify the custom linked wallet is properly linked to the user
        const isLinked = await verifyPrivyUserHasLinkedWallet(
          privyToken,
          services.privyClient,
          walletAddress,
        );
        if (!isLinked) {
          throw new ApiError(400, "Wallet not linked to user");
        }

        // Link the wallet
        const now = new Date();
        const linkedUser = await services.userService.updateUser({
          id: userId,
          walletAddress,
          walletLastVerifiedAt: now,
          updatedAt: now,
        });

        // Grant initial boost
        await services.boostAwardService.initForStake(linkedUser.walletAddress);

        res.status(200).json({
          success: true,
          user: linkedUser,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Create a new agent for the authenticated user
     * @param req Express request with userId from session
     * @param res Express response
     * @param next Express next function
     */
    async createAgent(req: Request, res: Response, next: NextFunction) {
      try {
        const { success, data, error } = CreateAgentSchema.safeParse({
          userId: req.userId,
          body: req.body,
        });
        if (!success) {
          throw new ApiError(400, `Invalid request format: ${error.message}`);
        }
        const {
          userId,
          body: { name, handle, description, imageUrl, email, metadata },
        } = data;

        const agent = await services.agentService.createAgent({
          ownerId: userId,
          name,
          handle,
          description,
          imageUrl,
          metadata,
          email,
        });

        // Return the created agent (API key must be retrieved via separate endpoint)
        res.status(201).json({
          success: true,
          agent: services.agentService.sanitizeAgent(agent),
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get all agents owned by the authenticated user
     * @param req Express request with userId from session
     * @param res Express response
     * @param next Express next function
     */
    async getAgents(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = ensureUserId(req);
        const paging = ensurePaging(req);

        // Get agents owned by this user
        const agents = await services.agentService.getAgentsByOwner(
          userId,
          paging,
        );

        // Remove sensitive fields and attach metrics efficiently using bulk queries
        const sanitizedAgents = agents.map((agent) =>
          services.agentService.sanitizeAgent(agent),
        );

        const agentsWithMetrics =
          await services.agentService.attachBulkAgentMetrics(sanitizedAgents);

        // Add back email and deactivation fields since the user should see them
        const finalAgents = agentsWithMetrics.map(
          (agentWithMetrics, index) => ({
            ...agentWithMetrics,
            email: agents[index]?.email,
            deactivationReason: agents[index]?.deactivationReason,
            deactivationDate: agents[index]?.deactivationDate,
          }),
        );

        res.status(200).json({
          success: true,
          userId,
          agents: finalAgents,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get details of a specific agent owned by the authenticated user
     * @param req Express request with userId from session and agentId parameter
     * @param res Express response
     * @param next Express next function
     */
    async getAgent(req: Request, res: Response, next: NextFunction) {
      try {
        const { success, data, error } = GetUserAgentSchema.safeParse({
          userId: req.userId,
          agentId: req.params.agentId,
        });
        if (!success) {
          throw new ApiError(400, `Invalid request format: ${error.message}`);
        }
        const { userId, agentId } = data;

        // Get the agent
        const agent = await services.agentService.getAgent(agentId);

        if (!agent) {
          throw new ApiError(404, "Agent not found");
        }

        // Verify ownership
        if (agent.ownerId !== userId) {
          throw new ApiError(403, "Access denied: You don't own this agent");
        }

        // Remove sensitive fields, but add back the email and deactivation since the user should see them
        const sanitizedAgent = services.agentService.sanitizeAgent(agent);
        const computedAgent = {
          ...(await services.agentService.attachAgentMetrics(sanitizedAgent)),
          email: agent.email,
          deactivationReason: agent.deactivationReason,
          deactivationDate: agent.deactivationDate,
        };

        res.status(200).json({
          success: true,
          agent: computedAgent,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get API key for a specific agent owned by the authenticated user
     * @param req Express request with userId from session and agentId parameter
     * @param res Express response
     * @param next Express next function
     */
    async getAgentApiKey(req: Request, res: Response, next: NextFunction) {
      try {
        const { success, data, error } = GetUserAgentSchema.safeParse({
          userId: req.userId,
          agentId: req.params.agentId,
        });
        if (!success) {
          throw new ApiError(400, `Invalid request format: ${error.message}`);
        }
        const { userId, agentId } = data;

        // Get the agent to verify ownership
        const agent = await services.agentService.getAgent(agentId);

        if (!agent) {
          throw new ApiError(404, "Agent not found");
        }

        // Verify ownership
        if (agent.ownerId !== userId) {
          throw new ApiError(403, "Access denied: You don't own this agent");
        }

        // Check if user's email is verified (security layer)
        const user = await services.userService.getUser(userId);
        if (!user) {
          throw new ApiError(404, "User not found");
        }

        // Get the decrypted API key using existing admin infrastructure
        const result =
          await services.agentService.getDecryptedApiKeyById(agentId);

        res.status(200).json({
          success: true,
          agentId,
          agentName: agent.name,
          agentHandle: agent.handle,
          apiKey: result.apiKey,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Update profile for a specific agent owned by the authenticated user
     * Limited to name, description, and imageUrl only
     * @param req Express request with userId from session and agentId parameter
     * @param res Express response
     * @param next Express next function
     */
    async updateAgentProfile(req: Request, res: Response, next: NextFunction) {
      try {
        const { success, data, error } = UpdateUserAgentProfileSchema.safeParse(
          {
            userId: req.userId,
            agentId: req.params.agentId,
            body: req.body,
          },
        );
        if (!success) {
          throw new ApiError(400, `Invalid request format: ${error.message}`);
        }
        const { userId, agentId, body: updateData } = data;

        // Get the agent to verify ownership
        const agent = await services.agentService.getAgent(agentId);

        if (!agent) {
          throw new ApiError(404, "Agent not found");
        }

        // Verify ownership
        if (agent.ownerId !== userId) {
          throw new ApiError(403, "Access denied: You don't own this agent");
        }

        // Update the agent using AgentManager
        const updatedAgent = await services.agentService.updateAgent({
          ...agent,
          ...updateData,
        });

        if (!updatedAgent) {
          throw new ApiError(500, "Failed to update agent profile");
        }

        // Remove sensitive fields, but add back the email and deactivation since the user should see them
        const sanitizedAgent = {
          ...services.agentService.sanitizeAgent(updatedAgent),
          email: updatedAgent.email,
          deactivationReason: updatedAgent.deactivationReason,
          deactivationDate: updatedAgent.deactivationDate,
        };

        res.status(200).json({
          success: true,
          agent: sanitizedAgent,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get all competitions that the authenticated user's agents are participating in
     * @param req Express request with userId from session and optional query params
     * @param res Express response
     * @param next Express next function
     */
    async getCompetitions(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = req.userId as string;

        // Parse and validate query parameters
        const {
          success,
          data: params,
          error,
        } = AgentCompetitionsParamsSchema.safeParse(req.query);
        if (!success) {
          throw new ApiError(400, `Invalid query parameters: ${error.message}`);
        }

        // Get competitions for all user's agents
        const results =
          await services.agentService.getCompetitionsForUserAgents(
            userId,
            params,
          );

        res.status(200).json({
          success: true,
          competitions: results.competitions,
          total: results.total,
          pagination: buildPaginationResponse(
            results.total,
            params.limit,
            params.offset,
          ),
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Subscribe to Loops mailing list
     * @param req Express request with userId from session
     * @param res Express response
     * @param next Express next function
     */
    async subscribe(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = ensureUserId(req);
        const user = await services.userService.getUser(userId);
        if (!user) {
          throw new ApiError(404, "User not found");
        }
        const { email, isSubscribed } = user;
        if (!email) {
          // Note: this should never happen post-Privy migration since Privy guarantees an email
          throw new ApiError(404, "User email not found");
        }
        if (isSubscribed) {
          return res.status(200).json({
            success: true,
            userId,
            isSubscribed: true,
          });
        }
        // Subscribe to Loops mailing list
        const result = await services.emailService.subscribeUser(email);
        if (!result?.success) {
          throw new ApiError(502, "Failed to subscribe user to mailing list");
        }
        const updatedUser = await services.userService.updateUser({
          id: userId,
          isSubscribed: true,
        });

        res.status(200).json({
          success: true,
          userId,
          isSubscribed: updatedUser.isSubscribed,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Unsubscribe from Loops mailing list
     * @param req Express request with userId from session
     * @param res Express response
     * @param next Express next function
     */
    async unsubscribe(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = ensureUserId(req);
        const user = await services.userService.getUser(userId);
        if (!user) {
          throw new ApiError(404, "User not found");
        }
        const { email, isSubscribed } = user;
        if (!email) {
          // Note: this should never happen post-Privy migration since Privy guarantees an email
          throw new ApiError(404, "User email not found");
        }
        if (!isSubscribed) {
          return res.status(200).json({
            success: true,
            userId,
            isSubscribed: false,
          });
        }
        // Unsubscribe from Loops mailing list
        const result = await services.emailService.unsubscribeUser(email);
        if (!result?.success) {
          throw new ApiError(
            502,
            "Failed to unsubscribe user from mailing list",
          );
        }
        const updatedUser = await services.userService.updateUser({
          id: userId,
          isSubscribed: false,
        });

        res.status(200).json({
          success: true,
          userId,
          isSubscribed: updatedUser.isSubscribed,
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

/**
 * Type definition for UserController
 */
export type UserController = ReturnType<typeof makeUserController>;
