import { NextFunction, Request, Response } from "express";

import { ApiError } from "@/middleware/errorHandler.js";
import { ServiceRegistry } from "@/services/index.js";
import {
  AgentCompetitionsParamsSchema,
  CreateAgentSchema,
  GetUserAgentSchema,
  UpdateUserAgentProfileSchema,
  UpdateUserProfileSchema,
  UuidSchema,
} from "@/types/index.js";

import { ensurePaging, ensureUserId } from "./request-helpers.js";

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
        const user = await services.userManager.getUser(userId);

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
          body: { name, imageUrl, email, metadata },
        } = data;

        // Get the current user
        const user = await services.userManager.getUser(userId);
        if (!user) {
          throw new ApiError(404, "User not found");
        }

        // Prepare update data with only allowed fields
        const updateData = {
          id: userId,
          name,
          imageUrl,
          email,
          metadata,
        };

        // Update the user using UserManager
        const updatedUser = await services.userManager.updateUser(updateData);

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
          body: { name, description, imageUrl, email, metadata },
        } = data;

        // Verify the user exists
        const user = await services.userManager.getUser(userId);
        if (!user) {
          throw new ApiError(404, "User not found");
        }

        // Create the agent using AgentManager
        const agent = await services.agentManager.createAgent({
          ownerId: userId,
          name,
          description,
          imageUrl,
          metadata,
          email,
        });

        if (!agent) {
          throw new ApiError(500, "Failed to create agent");
        }

        // Return the created agent with API key (user needs this for distribution)
        res.status(201).json({
          success: true,
          agent,
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
        const agents = await services.agentManager.getAgentsByOwner(
          userId,
          paging,
        );

        // Remove sensitive fields, but add back the email and deactivation since the user should see them
        const sanitizedAgents = await Promise.all(
          agents.map(async (agent) => ({
            ...(await services.agentManager.attachAgentMetrics(
              services.agentManager.sanitizeAgent(agent),
            )),
            email: agent.email,
            deactivationReason: agent.deactivationReason,
            deactivationDate: agent.deactivationDate,
          })),
        );

        res.status(200).json({
          success: true,
          userId,
          agents: sanitizedAgents,
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
        const agent = await services.agentManager.getAgent(agentId);

        if (!agent) {
          throw new ApiError(404, "Agent not found");
        }

        // Verify ownership
        if (agent.ownerId !== userId) {
          throw new ApiError(403, "Access denied: You don't own this agent");
        }

        // Remove sensitive fields, but add back the email and deactivation since the user should see them
        const sanitizedAgent = services.agentManager.sanitizeAgent(agent);
        const computedAgent = {
          ...(await services.agentManager.attachAgentMetrics(sanitizedAgent)),
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
        const agent = await services.agentManager.getAgent(agentId);

        if (!agent) {
          throw new ApiError(404, "Agent not found");
        }

        // Verify ownership
        if (agent.ownerId !== userId) {
          throw new ApiError(403, "Access denied: You don't own this agent");
        }

        // Get the decrypted API key using existing admin infrastructure
        const result =
          await services.agentManager.getDecryptedApiKeyById(agentId);

        if (!result.success) {
          // If there was an error, use the error code and message from the service
          throw new ApiError(
            result.errorCode || 500,
            result.errorMessage || "Unknown error",
          );
        }

        // Audit log for security tracking
        console.log(
          `[AUDIT] User ${userId} accessed API key for agent ${agentId}`,
        );

        res.status(200).json({
          success: true,
          agentId,
          agentName: agent.name,
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
        const {
          userId,
          agentId,
          body: { name, description, imageUrl, email, metadata },
        } = data;

        // Get the agent to verify ownership
        const agent = await services.agentManager.getAgent(agentId);

        if (!agent) {
          throw new ApiError(404, "Agent not found");
        }

        // Verify ownership
        if (agent.ownerId !== userId) {
          throw new ApiError(403, "Access denied: You don't own this agent");
        }

        // Prepare update data with only allowed fields
        const updateData = {
          id: agentId,
          name: name ?? agent.name,
          description,
          imageUrl,
          email,
          metadata,
        };

        // Update the agent using AgentManager
        const updatedAgent = await services.agentManager.updateAgent({
          ...agent,
          ...updateData,
        });

        if (!updatedAgent) {
          throw new ApiError(500, "Failed to update agent profile");
        }

        // Remove sensitive fields, but add back the email and deactivation since the user should see them
        const sanitizedAgent = {
          ...services.agentManager.sanitizeAgent(updatedAgent),
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
          await services.agentManager.getCompetitionsForUserAgents(
            userId,
            params,
          );

        res.status(200).json({
          success: true,
          competitions: results.competitions,
          total: results.total,
          pagination: {
            limit: params.limit,
            offset: params.offset,
            total: results.total,
            hasMore: params.limit + params.offset < results.total,
          },
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
