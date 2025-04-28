import { NextFunction, Request, Response } from "express";

import { CompetitionManager } from "../services/competition-manager.service";
import { TeamManager } from "../services/team-manager.service";
import { extractApiKey } from "./auth-helpers";
import { ApiError } from "./errorHandler";

/**
 * Authentication middleware
 * Validates API key from Bearer token
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

      // Extract API key from Authorization header
      const apiKey = extractApiKey(req);

      if (!apiKey) {
        throw new ApiError(
          401,
          "Authentication required. Use Authorization: Bearer YOUR_API_KEY",
        );
      }

      // Validate API key
      const teamId = await teamManager.validateApiKey(apiKey);

      if (!teamId) {
        console.log(`[AuthMiddleware] Invalid API key`);
        throw new ApiError(
          401,
          "Invalid API key. This key may have been reset or is no longer associated with an active account. Please ensure you're using your most recent API key.",
        );
      }

      console.log(
        `[AuthMiddleware] API key validation succeeded - team ID: ${teamId}`,
      );

      // Set team ID in request for use in route handlers
      req.teamId = teamId;

      // Check if the team is an admin
      const team = await teamManager.getTeam(teamId);
      const isAdmin = team?.isAdmin === true;

      if (isAdmin) {
        console.log(
          `[AuthMiddleware] Team ${teamId} is an admin, granting elevated access`,
        );
        req.isAdmin = true;
      }

      // Check if there's an active competition
      const activeCompetition = await competitionManager.getActiveCompetition();

      // For trade endpoints, ensure competition is active
      const fullRoutePath = `${req.baseUrl}${req.path}`;
      console.log(`[AuthMiddleware] Full route path: ${fullRoutePath}`);

      if (
        fullRoutePath.includes("/api/trade/execute") &&
        req.method === "POST"
      ) {
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
        `[AuthMiddleware] Authentication successful, proceeding to handler`,
      );
      console.log(`[AuthMiddleware] ========== END AUTH ==========\n`);

      next();
    } catch (error) {
      console.log(`[AuthMiddleware] Error in authentication:`, error);
      next(error);
    }
  };
};

// Extend Express Request interface to include teamId, competitionId, and isAdmin
declare module "express" {
  interface Request {
    teamId?: string;
    competitionId?: string;
    isAdmin?: boolean;
  }
}
