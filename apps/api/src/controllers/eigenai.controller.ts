import { NextFunction, Request, Response } from "express";

import { ApiError } from "@recallnet/services/types";

import { ServiceRegistry } from "@/services/index.js";

import {
  CompetitionStatsParamsSchema,
  GetAgentSubmissionsQuerySchema,
  GetBadgeStatusQuerySchema,
  SubmitSignatureSchema,
} from "./eigenai.schema.js";
import { buildPaginationResponse } from "./request-helpers.js";

/**
 * EigenAI Controller
 * Handles EigenAI verifiable inference badge operations
 */
export function makeEigenaiController(services: ServiceRegistry) {
  return {
    /**
     * Submit a signature for verification
     * @param req Express request with agentId from API key
     * @param res Express response
     * @param next Express next function
     */
    async submitSignature(req: Request, res: Response, next: NextFunction) {
      try {
        const agentId = req.agentId as string;

        const { success, data, error } = SubmitSignatureSchema.safeParse(
          req.body,
        );
        if (!success) {
          throw new ApiError(400, `Invalid request format: ${error.message}`);
        }

        const {
          competitionId,
          requestPrompt,
          responseModel,
          responseOutput,
          signature,
        } = data;

        // Verify competition exists
        const competition =
          await services.competitionService.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Verify competition is active (not pending or ended)
        if (competition.status !== "active") {
          throw new ApiError(
            400,
            `Competition is not active (status: ${competition.status}). Signature submissions are only allowed during active competitions.`,
          );
        }

        // Verify agent is registered in competition
        const isRegistered =
          await services.competitionService.isAgentActiveInCompetition(
            competitionId,
            agentId,
          );
        if (!isRegistered) {
          throw new ApiError(
            403,
            "Agent is not registered in this competition",
          );
        }

        // Submit signature for verification
        const result = await services.eigenaiService.submitSignature({
          agentId,
          competitionId,
          requestPrompt,
          responseModel,
          responseOutput,
          signature,
        });

        res.status(200).json({
          success: true,
          submissionId: result.submission.id,
          verified: result.verified,
          verificationStatus: result.submission.verificationStatus,
          badgeStatus: result.badgeStatus,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get badge status for the authenticated agent
     * @param req Express request with agentId from API key
     * @param res Express response
     * @param next Express next function
     */
    async getBadgeStatus(req: Request, res: Response, next: NextFunction) {
      try {
        const agentId = req.agentId as string;

        const { success, data, error } = GetBadgeStatusQuerySchema.safeParse(
          req.query,
        );
        if (!success) {
          throw new ApiError(400, `Invalid query parameters: ${error.message}`);
        }

        const { competitionId } = data;

        // Verify competition exists
        const competition =
          await services.competitionService.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Get badge status
        const badgeStatus = await services.eigenaiService.getAgentBadgeStatus(
          agentId,
          competitionId,
        );

        if (!badgeStatus) {
          // No badge status means no submissions yet
          res.status(200).json({
            success: true,
            agentId,
            competitionId,
            isBadgeActive: false,
            signaturesLast24h: 0,
            lastVerifiedAt: null,
          });
          return;
        }

        res.status(200).json({
          success: true,
          ...badgeStatus,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get EigenAI statistics for a competition (public endpoint)
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async getCompetitionStats(req: Request, res: Response, next: NextFunction) {
      try {
        const { success, data, error } = CompetitionStatsParamsSchema.safeParse(
          req.params,
        );
        if (!success) {
          throw new ApiError(400, `Invalid competition ID: ${error.message}`);
        }

        const { competitionId } = data;

        // Verify competition exists
        const competition =
          await services.competitionService.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Get stats
        const stats =
          await services.eigenaiService.getCompetitionStats(competitionId);

        res.status(200).json({
          success: true,
          ...stats,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get signature submissions for the authenticated agent
     * @param req Express request with agentId from API key
     * @param res Express response
     * @param next Express next function
     */
    async getSubmissions(req: Request, res: Response, next: NextFunction) {
      try {
        const agentId = req.agentId as string;

        const { success, data, error } =
          GetAgentSubmissionsQuerySchema.safeParse(req.query);
        if (!success) {
          throw new ApiError(400, `Invalid query parameters: ${error.message}`);
        }

        const { competitionId, limit = 50, offset = 0, status } = data;

        // Verify competition exists
        const competition =
          await services.competitionService.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        // Get submissions
        const result = await services.eigenaiService.getAgentSubmissions(
          agentId,
          competitionId,
          { limit, offset, status },
        );

        res.status(200).json({
          success: true,
          agentId,
          competitionId,
          submissions: result.submissions.map((sub) => ({
            id: sub.id,
            verificationStatus: sub.verificationStatus,
            submittedAt: sub.submittedAt.toISOString(),
            modelId: sub.responseModel,
          })),
          pagination: buildPaginationResponse(result.total, limit, offset),
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

/**
 * Type definition for EigenaiController
 */
export type EigenaiController = ReturnType<typeof makeEigenaiController>;
