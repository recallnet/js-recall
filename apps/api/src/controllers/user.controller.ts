import { NextFunction, Request, Response } from "express";

import { ApiError } from "@/middleware/errorHandler.js";
import { ServiceRegistry } from "@/services/index.js";

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
        const userId = req.userId as string;

        // Get the user using the service
        const user = await services.userManager.getUser(userId);

        if (!user) {
          throw new ApiError(404, "User not found");
        }

        // Return the user profile (excluding sensitive fields)
        res.status(200).json({
          success: true,
          user: {
            id: user.id,
            walletAddress: user.walletAddress,
            name: user.name,
            email: user.email,
            imageUrl: user.imageUrl,
            status: user.status,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
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
        const userId = req.userId as string;
        const { name, imageUrl, email } = req.body;

        // Validate that only allowed fields are being updated
        const allowedFields = ["name", "imageUrl", "email"];
        const providedFields = Object.keys(req.body);
        const invalidFields = providedFields.filter(
          (field) => !allowedFields.includes(field),
        );

        if (invalidFields.length > 0) {
          throw new ApiError(
            400,
            `Invalid fields: ${invalidFields.join(", ")}. Users can only update: ${allowedFields.join(", ")}`,
          );
        }

        // Get the current user
        const user = await services.userManager.getUser(userId);
        if (!user) {
          throw new ApiError(404, "User not found");
        }

        // Prepare update data with only allowed fields
        const updateData: {
          id: string;
          name?: string;
          imageUrl?: string;
          email?: string;
        } = {
          id: userId,
        };

        if (name !== undefined) {
          updateData.name = name;
        }

        if (imageUrl !== undefined) {
          updateData.imageUrl = imageUrl;
        }

        if (email !== undefined) {
          updateData.email = email;
        }

        // Update the user using UserManager
        const updatedUser = await services.userManager.updateUser(updateData);

        if (!updatedUser) {
          throw new ApiError(500, "Failed to update user profile");
        }

        // Return the updated user profile
        res.status(200).json({
          success: true,
          user: {
            id: updatedUser.id,
            walletAddress: updatedUser.walletAddress,
            name: updatedUser.name,
            email: updatedUser.email,
            imageUrl: updatedUser.imageUrl,
            status: updatedUser.status,
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt,
          },
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
        const userId = req.userId as string;
        const { name, description, imageUrl, email, metadata } = req.body;

        // Validate required fields
        if (!name || typeof name !== "string" || name.trim().length === 0) {
          throw new ApiError(
            400,
            "Agent name is required and must be a non-empty string",
          );
        }

        // Validate optional fields
        if (description !== undefined && typeof description !== "string") {
          throw new ApiError(400, "Agent description must be a string");
        }

        if (imageUrl !== undefined && typeof imageUrl !== "string") {
          throw new ApiError(400, "Agent imageUrl must be a string");
        }

        // Verify the user exists
        const user = await services.userManager.getUser(userId);
        if (!user) {
          throw new ApiError(404, "User not found");
        }

        // Create the agent using AgentManager
        const agent = await services.agentManager.createAgent(
          userId,
          name.trim(),
          description?.trim(),
          imageUrl?.trim(),
          email?.trim(),
          metadata,
        );

        if (!agent) {
          throw new ApiError(500, "Failed to create agent");
        }

        // Return the created agent with API key (user needs this for distribution)
        res.status(201).json({
          success: true,
          agent: {
            id: agent.id,
            ownerId: agent.ownerId,
            name: agent.name,
            description: agent.description,
            imageUrl: agent.imageUrl,
            email: agent.email,
            metadata: agent.metadata,
            apiKey: agent.apiKey, // Include API key for user to use
            status: agent.status,
            createdAt: agent.createdAt,
            updatedAt: agent.updatedAt,
          },
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
        const userId = req.userId as string;

        // Get agents owned by this user
        const agents = await services.agentManager.getAgentsByOwner(userId);

        // Return agents (without API keys for security)
        const sanitizedAgents = agents.map((agent) => ({
          id: agent.id,
          ownerId: agent.ownerId,
          name: agent.name,
          description: agent.description,
          imageUrl: agent.imageUrl,
          email: agent.email,
          metadata: agent.metadata,
          status: agent.status,
          createdAt: agent.createdAt,
          updatedAt: agent.updatedAt,
          // Explicitly exclude apiKey for security
        }));

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
        const userId = req.userId as string;
        const { agentId } = req.params;

        if (!agentId) {
          throw new ApiError(400, "Agent ID is required");
        }

        // Get the agent
        const agent = await services.agentManager.getAgent(agentId);

        if (!agent) {
          throw new ApiError(404, "Agent not found");
        }

        // Verify ownership
        if (agent.ownerId !== userId) {
          throw new ApiError(403, "Access denied: You don't own this agent");
        }

        // Return agent details (without API key for security)
        res.status(200).json({
          success: true,
          agent: {
            id: agent.id,
            ownerId: agent.ownerId,
            name: agent.name,
            description: agent.description,
            imageUrl: agent.imageUrl,
            email: agent.email,
            metadata: agent.metadata,
            status: agent.status,
            createdAt: agent.createdAt,
            updatedAt: agent.updatedAt,
            // Explicitly exclude apiKey for security
          },
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
        const userId = req.userId as string;
        const { agentId } = req.params;
        const { name, description, imageUrl, email, metadata } = req.body;

        if (!agentId) {
          throw new ApiError(400, "Agent ID is required");
        }

        // Validate that only allowed fields are being updated
        const allowedFields = [
          "name",
          "description",
          "imageUrl",
          "email",
          "metadata",
        ];
        const providedFields = Object.keys(req.body);
        const invalidFields = providedFields.filter(
          (field) => !allowedFields.includes(field),
        );

        if (invalidFields.length > 0) {
          throw new ApiError(
            400,
            `Invalid fields: ${invalidFields.join(", ")}. Agents can only update: ${allowedFields.join(", ")}`,
          );
        }

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
        const updateData: {
          id: string;
          name?: string;
          description?: string;
          imageUrl?: string;
          email?: string;
          metadata?: Record<string, unknown>;
        } = {
          id: agentId,
        };

        if (name !== undefined) {
          updateData.name = name;
        }

        if (description !== undefined) {
          updateData.description = description;
        }

        if (imageUrl !== undefined) {
          updateData.imageUrl = imageUrl;
        }

        if (email !== undefined) {
          updateData.email = email;
        }

        if (metadata !== undefined) {
          updateData.metadata = metadata;
        }

        // Update the agent using AgentManager
        const updatedAgent = await services.agentManager.updateAgent({
          ...agent, // Include all existing agent fields
          ...updateData, // Overlay the updates
        });

        if (!updatedAgent) {
          throw new ApiError(500, "Failed to update agent profile");
        }

        // Return the updated agent profile (without API key for security)
        res.status(200).json({
          success: true,
          agent: {
            id: updatedAgent.id,
            ownerId: updatedAgent.ownerId,
            walletAddress: updatedAgent.walletAddress,
            name: updatedAgent.name,
            description: updatedAgent.description,
            imageUrl: updatedAgent.imageUrl,
            email: updatedAgent.email,
            metadata: updatedAgent.metadata,
            status: updatedAgent.status,
            createdAt: updatedAgent.createdAt,
            updatedAt: updatedAgent.updatedAt,
            // Explicitly exclude apiKey for security
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
