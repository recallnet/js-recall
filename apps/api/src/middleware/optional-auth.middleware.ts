import { NextFunction, Request, Response } from "express";

import type { AdminService, AgentService } from "@recallnet/services";

import { extractApiKey } from "@/middleware/auth-helpers.js";

/**
 * Optional Authentication Middleware
 *
 * This middleware attempts to authenticate a request but NEVER fails.
 * It supports API key authentication for agents and admins.
 * If authentication succeeds, it populates req.userId, req.agentId, or req.isAdmin.
 * If authentication fails, it gracefully continues without setting these fields.
 *
 * This is perfect for public routes that should provide enhanced data for authenticated users.
 *
 * @param agentService - Agent service
 * @param adminService - Admin service
 * @returns Express middleware function
 */
export function optionalAuthMiddleware(
  agentService: AgentService,
  adminService: AdminService,
) {
  return async (req: Request, _: Response, next: NextFunction) => {
    try {
      // Try API key authentication
      const apiKey = extractApiKey(req);
      if (!apiKey) {
        // No authentication available - continue as unauthenticated
        return next();
      }

      // Try agent API key authentication
      try {
        const agentId = await agentService.validateApiKey(apiKey);
        if (agentId) {
          req.agentId = agentId;
          // Get the agent to find its owner
          const agent = await agentService.getAgent(agentId);
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
        const adminId = await adminService.validateApiKey(apiKey);
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
