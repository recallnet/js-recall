import { NextFunction, Response } from "express";

import { config, features } from "@/config/index.js";
import { isTeamInCompetition as isTeamInCompetitionRepo } from "@/database/repositories/team-repository.js";
import { ensureReqTeam } from "@/controllers/heplers.js";
import { ServiceRegistry } from "@/services/index.js";
import { AuthenticatedRequest } from "@/types/index.js";

export function makeCompetitionsController(services: ServiceRegistry) {
  /**
   * Competition Controller
   * Handles competition-related operations
   */
  return {
    /**
     * Get competitions
     * @param req AuthenticatedRequest object with team authentication information
     * @param res Express response
     * @param next Express next function
     */
    async getCompetitions(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        // Check if the team is authenticated
        ensureReqTeam(req, "Authentication required to view competitions");

        console.log(
          `[CompetitionController] Team ${req.teamId} requesting competitions`,
        );

        // Get all upcoming competitions
        const competitions =
          await services.competitionsManager.getCompetitions(req);

        // Return the competitions
        res.status(200).json({
          success: true,
          competitions: competitions,
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

export type CompetitionsController = ReturnType<
  typeof makeCompetitionsController
>;
