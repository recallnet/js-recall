import { NextFunction, Request, Response } from "express";

import { AdminService, AgentService, UserService } from "@recallnet/services";
import {
  extractPrivyIdentityToken,
  verifyPrivyIdentityToken,
} from "@recallnet/services/lib";
import { ApiError } from "@recallnet/services/types";

import { config } from "@/config/index.js";
import { authLogger } from "@/lib/logger.js";
import { extractApiKey, isLoginEndpoint } from "@/middleware/auth-helpers.js";

/**
 * Unified Authentication Middleware
 *
 * This middleware attempts to authenticate a request using four methods, in order:
 * 1. Privy JWT Token: If session authentication is not successful, it attempts to authenticate
 *    using a Privy JWT token provided in the 'privy-id-token' value in `headers.cookie`.
 * 2. Agent API Key: If Privy JWT token authentication fails, it attempts to authenticate
 *    using an agent API key provided in the 'Authorization: Bearer <API_KEY>' header.
 * 3. Admin API Key: If agent API key authentication fails, it attempts admin API key authentication.
 *
 * If none of these methods successfully authenticate the request, an `ApiError` (401) is thrown.
 *
 * Note: relies on `siweSessionMiddleware` having run first to populate `req.session`.
 */
export const authMiddleware = (
  agentService: AgentService,
  userService: UserService,
  adminService: AdminService,
) => {
  return async (req: Request, _: Response, next: NextFunction) => {
    try {
      authLogger.debug(`Received request to ${req.method} ${req.originalUrl}`);

      /**
       * Privy Identity Token Authentication
       *
       * This section attempts to authenticate the request using a Privy identity token.
       * Tokens can be provided via privy-id-token cookie or header.
       */
      const identityToken = extractPrivyIdentityToken(req);
      if (identityToken) {
        authLogger.debug(
          "[AuthMiddleware] Attempting Privy identity token authentication...",
        );
        try {
          const { privyId } = await verifyPrivyIdentityToken(
            identityToken,
            config.privy.jwksPublicKey,
            config.privy.appId,
            authLogger,
          );
          const path = new URL(
            `${req.protocol}://${req.get("host")}${req.originalUrl}`,
          ).pathname;

          req.privyToken = identityToken;
          authLogger.debug(
            `[AuthMiddleware] Privy authentication successful for user ID: ${privyId}`,
          );
          const user = await userService.getUserByPrivyId(privyId);
          if (!user) {
            // Note: we allow the `/auth/login` endpoint to be accessed if a user without Privy
            // related data exists. This is part of a backwards compatibility measure. A user will
            // either be queried by legacy data (wallet address or email), else, created.
            if (isLoginEndpoint(path)) {
              return next();
            }
            throw new ApiError(
              401,
              "[AuthMiddleware] Authentication failed. User not found.",
            );
          }

          req.userId = user.id;
          return next();
        } catch (error) {
          authLogger.error(
            `[AuthMiddleware] Privy authentication failed: ${error}`,
          );
        }
      } else {
        authLogger.debug(
          "[AuthMiddleware] No Privy identity token found. Proceeding to API key auth.",
        );
      }

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
          "[AuthMiddleware] Authentication required. Invalid Privy token or no API key provided. Use Authorization: Bearer YOUR_API_KEY",
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
