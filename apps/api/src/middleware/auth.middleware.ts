import { NextFunction, Request, Response } from "express";

import { AdminService, AgentService } from "@recallnet/services";
import { ApiError } from "@recallnet/services/types";

import { authLogger } from "@/lib/logger.js";
import { extractApiKey } from "@/middleware/auth-helpers.js";

/**
 * Authentication Middleware
 *
 * This middleware authenticates requests using API keys for agents and admins:
 * 1. Agent API Key: Attempts to authenticate using an agent API key provided in the
 *    'Authorization: Bearer <API_KEY>' header. If successful, sets req.agentId and
 *    req.userId (from agent's owner).
 * 2. Admin API Key: If agent API key authentication fails, attempts admin API key
 *    authentication. If successful, sets req.adminId and req.isAdmin.
 *
 * If neither authentication method succeeds, an `ApiError` (401) is thrown.
 */
export const authMiddleware = (
  agentService: AgentService,
  adminService: AdminService,
) => {
  return async (req: Request, _: Response, next: NextFunction) => {
    try {
      authLogger.debug(`Received request to ${req.method} ${req.originalUrl}`);

      /**
       * API Key Authentication for Agents and Admins.
       *
       * This section attempts to authenticate the request using an API key provided in the
       * 'Authorization: Bearer <API_KEY>' header. It tries agent API keys first, then admin API keys.
       */
      authLogger.debug("[AuthMiddleware] Attempting API key authentication...");

      // Extract API key from Authorization header
      const apiKey = extractApiKey(req);
      if (!apiKey) {
        throw new ApiError(
          401,
          "[AuthMiddleware] Authentication required. No API key provided. Use Authorization: Bearer YOUR_API_KEY",
        );
      }

      // Try agent API key authentication first
      try {
        const agentId = await agentService.validateApiKey(apiKey);
        if (agentId) {
          authLogger.debug(
            `[AuthMiddleware] Agent API key validation succeeded - agent ID: ${agentId}`,
          );
          req.agentId = agentId;

          // Get the agent to find its owner
          const agent = await agentService.getAgent(agentId);
          if (agent) {
            req.userId = agent.ownerId;
            authLogger.debug(
              `[AuthMiddleware] Agent ${agentId} owned by user ${agent.ownerId}`,
            );
          }

          // Check for active competition for trading endpoints
          const fullRoutePath = `${req.baseUrl}${req.path}`;
          authLogger.debug(
            `[AuthMiddleware] Full route path: ${fullRoutePath}`,
          );

          authLogger.debug(
            `[AuthMiddleware] Agent API key authentication successful. Agent ID: ${req.agentId}, Owner ID: ${req.userId}`,
          );
          authLogger.debug(
            `[AuthMiddleware] ========== END AUTH REQUEST ==========`,
          );
          return next();
        }
      } catch (error) {
        // Agent API key validation failed, try admin API key
        authLogger.error(
          { error },
          "[AuthMiddleware] Agent API key validation failed, trying admin API key:",
        );
      }

      // Try admin API key authentication
      try {
        const adminId = await adminService.validateApiKey(apiKey);
        if (adminId) {
          authLogger.debug(
            `[AuthMiddleware] Admin API key validation succeeded - admin ID: ${adminId}`,
          );
          req.adminId = adminId;
          req.isAdmin = true;

          // Get admin info for request context
          const admin = await adminService.getAdmin(adminId);
          if (admin) {
            req.admin = {
              id: adminId,
              name: admin.name || admin.username,
            };
            authLogger.debug(
              `[AuthMiddleware] Admin ${adminId} (${admin.username}) authenticated`,
            );
          }

          authLogger.debug(
            `[AuthMiddleware] Admin API key authentication successful. Admin ID: ${req.adminId}`,
          );
          authLogger.debug(
            `[AuthMiddleware] ========== END AUTH REQUEST ==========`,
          );
          return next();
        }
      } catch (error) {
        authLogger.error(
          { error },
          "[AuthMiddleware] Admin API key validation also failed: ",
        );
      }

      // If we reach here, no authentication method worked
      authLogger.debug("[AuthMiddleware] All authentication methods failed.");
      throw new ApiError(
        401,
        "Invalid API key. This key may have been reset or is no longer associated with an active account. Please ensure you're using your most recent API key.",
      );
    } catch (error) {
      authLogger.error({ error }, `Error in authentication`);
      next(error);
    }
  };
};
