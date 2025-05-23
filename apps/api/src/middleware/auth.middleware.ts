import { NextFunction, Request, Response } from "express";

import { extractApiKey } from "@/middleware/auth-helpers.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { AdminManager } from "@/services/admin-manager.service.js";
import { AgentManager } from "@/services/agent-manager.service.js";
import { CompetitionManager } from "@/services/competition-manager.service.js";
import { UserManager } from "@/services/user-manager.service.js";

/**
 * Unified Authentication Middleware
 *
 * This middleware attempts to authenticate a request using three methods, in order:
 * 1. SIWE-based Session: Checks for an active user session established via SIWE.
 * 2. Agent API Key: If session authentication is not successful, it attempts to authenticate
 *    using an agent API key provided in the 'Authorization: Bearer <API_KEY>' header.
 * 3. Admin API Key: If agent API key fails, it attempts admin API key authentication.
 *
 * If none of these methods successfully authenticate the request, an `ApiError` (401) is thrown.
 *
 * Note: relies on `siweSessionMiddleware` having run first to populate `req.session`.
 */
export const authMiddleware = (
  agentManager: AgentManager,
  userManager: UserManager,
  adminManager: AdminManager,
  competitionManager: CompetitionManager,
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log(`\n[AuthMiddleware] ========== AUTH REQUEST ==========`);
      console.log(
        `[AuthMiddleware] Received request to ${req.method} ${req.originalUrl}`,
      );

      /**
       * SIWE Session Authentication
       *
       * This section attempts to authenticate the request using a SIWE session.
       * It checks for the presence of a valid session, a valid SIWE message, and
       * a matching wallet address. Sets userId and wallet in the request.
       */
      if (
        req.session &&
        req.session.siwe &&
        req.session.wallet &&
        req.session.siwe.address === req.session.wallet
      ) {
        // Session expiry should be handled by `siweSessionMiddleware`, but double check just in case
        if (
          req.session.siwe.expirationTime &&
          Date.now() > new Date(req.session.siwe.expirationTime).getTime()
        ) {
          console.log("[AuthMiddleware] SIWE session found but expired.");
          req.session.destroy();
        } else {
          console.log(
            `[AuthMiddleware] SIWE session authentication successful for wallet: ${req.session.wallet}`,
          );

          // Set wallet from session
          req.wallet = req.session.wallet;

          // Look up user by wallet address
          const user = await userManager.getUserByWalletAddress(
            req.session.wallet,
          );
          if (user) {
            req.userId = user.id;
            console.log(
              `[AuthMiddleware] Found user ${user.id} for wallet ${req.session.wallet}`,
            );
          } else {
            console.log(
              `[AuthMiddleware] No user found for wallet ${req.session.wallet} - user may need to register`,
            );
          }

          console.log(
            `[AuthMiddleware] Session auth completed. Wallet: ${req.wallet}, User ID: ${req.userId}`,
          );
          return next();
        }
      } else {
        console.log(
          "[AuthMiddleware] No active SIWE session found or session invalid. Proceeding to API key auth.",
        );
      }

      /**
       * API Key Authentication
       *
       * This section attempts to authenticate the request using an API key provided in the
       * 'Authorization: Bearer <API_KEY>' header. It tries agent API keys first, then admin API keys.
       */
      console.log("[AuthMiddleware] Attempting API key authentication...");

      // Extract API key from Authorization header
      const apiKey = extractApiKey(req);
      if (!apiKey) {
        throw new ApiError(
          401,
          "Authentication required. No active session and no API key provided. Use Authorization: Bearer YOUR_API_KEY",
        );
      }

      // Try agent API key authentication first
      try {
        const agentId = await agentManager.validateApiKey(apiKey);
        if (agentId) {
          console.log(
            `[AuthMiddleware] Agent API key validation succeeded - agent ID: ${agentId}`,
          );
          req.agentId = agentId;

          // Get the agent to find its owner
          const agent = await agentManager.getAgent(agentId);
          if (agent) {
            req.userId = agent.ownerId;
            console.log(
              `[AuthMiddleware] Agent ${agentId} owned by user ${agent.ownerId}`,
            );
          }

          // Check for active competition for trading endpoints
          const fullRoutePath = `${req.baseUrl}${req.path}`;
          console.log(`[AuthMiddleware] Full route path: ${fullRoutePath}`);
          if (
            fullRoutePath.includes("/api/trade/execute") &&
            req.method === "POST"
          ) {
            const activeCompetition =
              await competitionManager.getActiveCompetition();
            if (!activeCompetition) {
              throw new ApiError(403, "No active competition");
            }
            // Set competition ID in request
            req.competitionId = activeCompetition.id;
            console.log(
              `[AuthMiddleware] Set competition ID: ${req.competitionId}`,
            );
          }

          console.log(
            `[AuthMiddleware] Agent API key authentication successful. Agent ID: ${req.agentId}, Owner ID: ${req.userId}`,
          );
          console.log(
            `[AuthMiddleware] ========== END AUTH REQUEST ==========`,
          );
          return next();
        }
      } catch (error) {
        // Agent API key validation failed, try admin API key
        console.log(
          "[AuthMiddleware] Agent API key validation failed, trying admin API key:",
          error,
        );
      }

      // Try admin API key authentication
      try {
        const adminId = await adminManager.validateApiKey(apiKey);
        if (adminId) {
          console.log(
            `[AuthMiddleware] Admin API key validation succeeded - admin ID: ${adminId}`,
          );
          req.adminId = adminId;
          req.isAdmin = true;

          // Get admin info for request context
          const admin = await adminManager.getAdmin(adminId);
          if (admin) {
            req.admin = {
              id: adminId,
              name: admin.name || admin.username,
            };
            console.log(
              `[AuthMiddleware] Admin ${adminId} (${admin.username}) authenticated`,
            );
          }

          console.log(
            `[AuthMiddleware] Admin API key authentication successful. Admin ID: ${req.adminId}`,
          );
          console.log(
            `[AuthMiddleware] ========== END AUTH REQUEST ==========`,
          );
          return next();
        }
      } catch (error) {
        console.log(
          "[AuthMiddleware] Admin API key validation also failed: ",
          error,
        );
      }

      // If we reach here, no authentication method worked
      console.log("[AuthMiddleware] All authentication methods failed.");
      throw new ApiError(
        401,
        "Invalid API key. This key may have been reset or is no longer associated with an active account. Please ensure you're using your most recent API key.",
      );
    } catch (error) {
      console.error(`[AuthMiddleware] Error in authentication:`, error);
      next(error);
    }
  };
};
