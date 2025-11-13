import { NextFunction, Response } from "express";
import { z } from "zod/v4";

import { ParsingError } from "@recallnet/db/errors";
import { ApiError } from "@recallnet/services/types";

import { competitionLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";
import { AuthenticatedRequest } from "@/types/index.js";

import { ensureUuid } from "./request-helpers.js";

/**
 * Validation schemas
 */
const PlayStateSchema = z.enum(["open", "locked", "resolved"]).optional();

const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const CreatePredictionSchema = z.object({
  prediction: z.enum(["run", "pass"]),
  confidence: z.number().min(0).max(1),
});

/**
 * NFL Controller
 * Handles NFL play prediction endpoints
 */
export function makeNflController(services: ServiceRegistry) {
  return {
    /**
     * Get open plays for a competition
     * GET /competitions/:competitionId/plays?state=open&limit=50&offset=0
     */
    async getPlays(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const competitionId = ensureUuid(req.params.competitionId);
        if (!competitionId) {
          throw new ApiError(400, "Competition ID is required");
        }

        const state = PlayStateSchema.parse(req.query.state);
        const { limit, offset } = PaginationSchema.parse(req.query);

        // Currently only support fetching open plays
        if (state && state !== "open") {
          throw new ApiError(400, "Only 'open' state is currently supported");
        }

        const result = await services.playsManagerService.getOpenPlays(
          competitionId,
          limit,
          offset,
        );

        res.status(200).json({
          success: true,
          data: {
            plays: result.plays,
            pagination: {
              total: result.total,
              limit,
              offset,
              hasMore: offset + limit < result.total,
            },
          },
        });
      } catch (error) {
        competitionLogger.error({ error }, "Error in getPlays");
        next(
          error instanceof ParsingError
            ? new ApiError(400, error.message)
            : error,
        );
      }
    },

    /**
     * Create a prediction for the next play in a game
     * POST /competitions/:competitionId/games/:globalGameId/predictions
     */
    async createPrediction(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const competitionId = ensureUuid(req.params.competitionId);
        if (!competitionId) {
          throw new ApiError(400, "Competition ID is required");
        }

        const globalGameId = parseInt(req.params.globalGameId || "", 10);
        if (isNaN(globalGameId)) {
          throw new ApiError(400, "Valid global game ID is required");
        }

        // Ensure agent is authenticated
        if (!req.agentId) {
          throw new ApiError(401, "Agent authentication required");
        }

        const body = CreatePredictionSchema.parse(req.body);

        const prediction =
          await services.predictionsManagerService.createPrediction({
            competitionId,
            globalGameId,
            agentId: req.agentId,
            prediction: body.prediction,
            confidence: body.confidence,
          });

        res.status(201).json({
          success: true,
          data: {
            id: prediction.id,
            prediction: prediction.prediction,
            confidence: Number(prediction.confidence),
            createdAt: prediction.createdAt.toISOString(),
          },
          message: "Prediction created successfully",
        });
      } catch (error) {
        competitionLogger.error({ error }, "Error in createPrediction");
        if (error instanceof ParsingError) {
          next(new ApiError(400, error.message));
        } else if (error instanceof Error) {
          next(new ApiError(400, error.message));
        } else {
          next(error);
        }
      }
    },

    /**
     * Get leaderboard for a competition
     * GET /competitions/:competitionId/leaderboard
     */
    async getLeaderboard(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const competitionId = ensureUuid(req.params.competitionId);
        if (!competitionId) {
          throw new ApiError(400, "Competition ID is required");
        }

        const leaderboard =
          await services.scoringManagerService.getLeaderboard(competitionId);

        res.status(200).json({
          success: true,
          data: {
            leaderboard: leaderboard.map((entry) => ({
              agentId: entry.agentId,
              rank: entry.rank,
              totalPredictions: entry.totalPredictions,
              correctPredictions: entry.correctPredictions,
              accuracy: entry.accuracy,
              brierScore: entry.brierScore,
            })),
          },
        });
      } catch (error) {
        competitionLogger.error({ error }, "Error in getLeaderboard");
        next(
          error instanceof ParsingError
            ? new ApiError(400, error.message)
            : error,
        );
      }
    },
  };
}
