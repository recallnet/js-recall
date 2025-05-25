import { NextFunction, Request, Response } from "express";

import { extractApiKey } from "@/middleware/auth-helpers.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { CompetitionManager } from "@/services/competition-manager.service.js";
import { TeamManager } from "@/services/team-manager.service.js";

/**
 * Unified Authentication Middleware
 *
 * This middleware attempts to authenticate a request using two methods, in order:
 * 1. SIWE-based Session: Checks for an active session established via SIWE.
 * 2. API Key: If session authentication is not successful, it attempts to authenticate
 *    using an API key provided in the 'Authorization: Bearer <API_KEY>' header.
 * If neither method successfully authenticates the request, an `ApiError` (401) is thrown.
 *
 * Note: relies on `siweSessionMiddleware` having run first to populate `req.session`.
 */
export const authMiddleware = (
  teamManager: TeamManager,
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
       * a matching wallet address.
       *
       * If these conditions are met, the request is authenticated and the team ID
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
          // A team might not exist yet for this wallet, so `teamId` could be undefined, but the
          // presence of `req.session.siwe` is the indicator of a successful SIWE login
          req.wallet = req.session.wallet;
          req.teamId = req.session.teamId;

          // Check if the team is an admin
          if (req.teamId) {
            const team = await teamManager.getTeam(req.teamId);
            if (team?.isAdmin) {
              req.isAdmin = true;
              console.log(
                `[AuthMiddleware] Team ${req.teamId} (from session) is an admin.`,
              );
            }
          }
          console.log(
            `[AuthMiddleware] Session auth completed. Wallet: ${req.wallet}, Team ID: ${req.teamId}, admin: ${req.isAdmin}`,
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
       * 'Authorization: Bearer <API_KEY>' header.
       */
      console.log("[AuthMiddleware] Attempting API key authentication...");
      // Extract API key from Authorization header and validate it
      const apiKey = extractApiKey(req);
      if (!apiKey) {
        throw new ApiError(
          401,
          "Authentication required. No active session and no API key provided. Use Authorization: Bearer YOUR_API_KEY",
        );
      }
      const teamIdFromApiKey = await teamManager.validateApiKey(apiKey);
      if (!teamIdFromApiKey) {
        console.log("[AuthMiddleware] Invalid API key.");
        throw new ApiError(
          401,
          "Invalid API key. This key may have been reset or is no longer associated with an active account. Please ensure you're using your most recent API key.",
        );
      }

      // Set team ID in request for use in route handlers
      console.log(
        `[AuthMiddleware] API key validation succeeded - team ID: ${teamIdFromApiKey}`,
      );
      req.teamId = teamIdFromApiKey;

      // Check if the team is an admin
      const team = await teamManager.getTeam(teamIdFromApiKey);
      if (team?.isAdmin) {
        req.isAdmin = true;
        console.log(
          `[AuthMiddleware] API key team ${teamIdFromApiKey} is an admin, granting elevated access`,
        );
      }

      // Check for active competition
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
        `[AuthMiddleware] API key authentication successful. Team ID: ${req.teamId}, admin: ${req.isAdmin}`,
      );
      console.log(`[AuthMiddleware] ========== END AUTH REQUEST ==========`);
      return next();
    } catch (error) {
      console.error(`[AuthMiddleware] Error in authentication:`, error);
      next(error);
    }
  };
};
