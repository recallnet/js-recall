import { NextFunction, Request, Response } from "express";

import { extractPrivyIdentityToken } from "@/lib/privy/utils.js";
import { verifyPrivyIdentityToken } from "@/lib/privy/verify.js";
import { extractApiKey } from "@/middleware/auth-helpers.js";
import type { AdminManager } from "@/services/admin-manager.service.js";
import type { AgentManager } from "@/services/agent-manager.service.js";
import { UserManager } from "@/services/user-manager.service.js";

/**
 * Optional Authentication Middleware
 *
 * This middleware attempts to authenticate a request but NEVER fails.
 * It supports both SIWE session authentication and API key authentication.
 * If authentication succeeds, it populates req.userId, req.agentId, or req.isAdmin.
 * If authentication fails, it gracefully continues without setting these fields.
 *
 * This is perfect for public routes that should provide enhanced data for authenticated users.
 *
 * @param agentManager - Agent management service
 * @param adminManager - Admin management service
 * @returns Express middleware function
 */
export function optionalAuthMiddleware(
  agentManager: AgentManager,
  userManager: UserManager,
  adminManager: AdminManager,
) {
  return async (req: Request, _: Response, next: NextFunction) => {
    try {
      const identityToken = extractPrivyIdentityToken(req);
      if (identityToken) {
        try {
          const { privyId } = await verifyPrivyIdentityToken(identityToken);

          req.privyToken = identityToken;
          const user = await userManager.getUserByPrivyId(privyId);
          if (user) {
            req.userId = user.id;
            return next();
          }
          // If user not found, continue to API key auth below
        } catch {
          // Privy token verification failed, continue to API key auth below
        }
      }

      // If no session, try API key authentication
      const apiKey = extractApiKey(req);
      if (!apiKey) {
        // No authentication available - continue as unauthenticated
        return next();
      }

      // Try agent API key authentication
      try {
        const agentId = await agentManager.validateApiKey(apiKey);
        if (agentId) {
          req.agentId = agentId;
          // Get the agent to find its owner
          const agent = await agentManager.getAgent(agentId);
          if (agent) {
            req.userId = agent.ownerId;
          }
          return next();
        }
      } catch {
        // Agent auth failed - continue trying other methods
      }

      // Try admin API key authentication
      try {
        const adminId = await adminManager.validateApiKey(apiKey);
        if (adminId) {
          req.isAdmin = true;
          req.adminId = adminId;
          return next();
        }
      } catch {
        // Admin auth failed - continue as unauthenticated
      }

      // All authentication methods failed - continue as unauthenticated
      next();
    } catch (error) {
      // Any unexpected error - log it but continue as unauthenticated
      console.error("[OptionalAuthMiddleware] Unexpected error:", error);
      next();
    }
  };
}
