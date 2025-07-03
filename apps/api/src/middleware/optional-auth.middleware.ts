import { NextFunction, Request, Response } from "express";
import { getIronSession } from "iron-session";

import { config } from "@/config/index.js";
import { extractApiKey } from "@/middleware/auth-helpers.js";
import type { AdminManager } from "@/services/admin-manager.service.js";
import type { AgentManager } from "@/services/agent-manager.service.js";
import type { SessionData } from "@/types/index.js";

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
  adminManager: AdminManager,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // First, try to get SIWE session using same config as siweSessionMiddleware
      try {
        const session = await getIronSession<SessionData>(req, res, {
          cookieName: config.app.cookieName,
          password: config.security.rootEncryptionKey,
          ttl: config.app.sessionTtl,
          cookieOptions: {
            secure: config.server.nodeEnv === "production",
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            maxAge: config.app.sessionTtl,
            domain:
              config.server.nodeEnv === "production"
                ? config.app.domain
                : undefined,
          },
        });

        // Check for valid session with wallet and user ID
        if (
          session.siwe &&
          session.wallet &&
          session.userId &&
          session.siwe.address === session.wallet
        ) {
          // Check session expiry
          if (
            session.siwe.expirationTime &&
            Date.now() > new Date(session.siwe.expirationTime).getTime()
          ) {
            session.destroy();
          } else {
            req.userId = session.userId;
            req.session = session;
            req.wallet = session.wallet;
            return next();
          }
        }
      } catch {
        // Session parsing failed - continue trying other methods
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
