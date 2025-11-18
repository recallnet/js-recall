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
const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const PredictGameWinnerSchema = z.object({
  predictedWinner: z.string().min(2).max(3), // Team ticker like "MIN", "CHI"
  confidence: z.number().min(0).max(1),
});

/**
 * NFL Controller
 * Handles NFL game winner prediction endpoints
 */
export function makeNflController(services: ServiceRegistry) {
  return {
    /**
     * Get all games for a competition
     * GET /nfl/competitions/:competitionId/games
     */
    async getAllGames(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const competitionId = ensureUuid(req.params.competitionId);
        if (!competitionId) {
          throw new ApiError(400, "Competition ID is required");
        }

        // Get game IDs from competition_games
        const gameIds =
          await services.competitionGamesRepository.findGameIdsByCompetitionId(
            competitionId,
          );

        // Get game details
        const games = await services.gamesRepository.findByIds(gameIds);

        res.status(200).json({
          success: true,
          data: {
            games: games.map((game) => ({
              id: game.id,
              globalGameId: game.globalGameId,
              gameKey: game.gameKey,
              startTime: game.startTime.toISOString(),
              endTime: game.endTime?.toISOString() || null,
              homeTeam: game.homeTeam,
              awayTeam: game.awayTeam,
              venue: game.venue,
              status: game.status,
              winner: game.winner,
            })),
          },
        });
      } catch (error) {
        competitionLogger.error({ error }, "Error in getAllGames");
        next(
          error instanceof ParsingError
            ? new ApiError(400, error.message)
            : error,
        );
      }
    },

    /**
     * Get competition rules
     * GET /nfl/competitions/:competitionId/rules
     */
    async getRules(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const competitionId = ensureUuid(req.params.competitionId);
        if (!competitionId) {
          throw new ApiError(400, "Competition ID is required");
        }

        // Return static rules for now
        res.status(200).json({
          success: true,
          data: {
            predictionType: "game_winner",
            scoringMethod: "time_weighted_brier",
            scoringFormula: {
              description:
                "Score = 1 - Σ(w_t * (p_t - y)²) / Σ(w_t), where higher is better",
              timeNormalization:
                "t = (timestamp - game_start) / (game_end - game_start) ∈ [0, 1]",
              weight: "w_t = 0.5 + 0.5 * t (earlier predictions weighted less)",
              probability:
                "p_t = confidence if predicted winner matches actual, else 1-confidence",
              actual: "y = 1 (actual winner)",
            },
            confidenceRange: {
              min: 0.0,
              max: 1.0,
              description:
                "Confidence in predicted winner (0.0 = no confidence, 1.0 = certain)",
            },
            predictionRules: {
              canUpdate: true,
              updateWindow: "Anytime before game ends",
              scoringWindow: "From game start to game end",
              preGamePredictions: "Allowed (treated as t=0 for time weighting)",
            },
          },
        });
      } catch (error) {
        competitionLogger.error({ error }, "Error in getRules");
        next(
          error instanceof ParsingError
            ? new ApiError(400, error.message)
            : error,
        );
      }
    },

    /**
     * Get specific game info
     * GET /nfl/competitions/:competitionId/games/:gameId
     */
    async getGameInfo(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const competitionId = ensureUuid(req.params.competitionId);
        if (!competitionId) {
          throw new ApiError(400, "Competition ID is required");
        }

        const gameId = ensureUuid(req.params.gameId);
        if (!gameId) {
          throw new ApiError(400, "Game ID is required");
        }

        const game = await services.gamesRepository.findById(gameId);
        if (!game) {
          throw new ApiError(404, "Game not found");
        }

        // Get agent's latest prediction if authenticated
        let latestPrediction = null;
        if (req.agentId) {
          const prediction =
            await services.gamePredictionService.getLatestPrediction(
              gameId,
              req.agentId,
            );
          if (prediction) {
            latestPrediction = {
              predictedWinner: prediction.predictedWinner,
              confidence: Number(prediction.confidence),
              createdAt: prediction.createdAt.toISOString(),
            };
          }
        }

        res.status(200).json({
          success: true,
          data: {
            game: {
              id: game.id,
              globalGameId: game.globalGameId,
              gameKey: game.gameKey,
              startTime: game.startTime.toISOString(),
              endTime: game.endTime?.toISOString() || null,
              homeTeam: game.homeTeam,
              awayTeam: game.awayTeam,
              venue: game.venue,
              status: game.status,
              winner: game.winner,
            },
            latestPrediction,
          },
        });
      } catch (error) {
        competitionLogger.error({ error }, "Error in getGameInfo");
        next(
          error instanceof ParsingError
            ? new ApiError(400, error.message)
            : error,
        );
      }
    },

    /**
     * Get game plays (play-by-play data)
     * GET /nfl/competitions/:competitionId/games/:gameId/plays?limit=50&offset=0&latest=false
     */
    async getGamePlays(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const competitionId = ensureUuid(req.params.competitionId);
        if (!competitionId) {
          throw new ApiError(400, "Competition ID is required");
        }

        const gameId = ensureUuid(req.params.gameId);
        if (!gameId) {
          throw new ApiError(400, "Game ID is required");
        }

        const { limit, offset } = PaginationSchema.parse(req.query);
        const latest = req.query.latest === "true";

        if (latest) {
          // Get only the latest play
          const plays = await services.gamePlaysRepository.findByGameId(gameId);
          const latestPlay = plays[plays.length - 1]; // Last play in sequence

          res.status(200).json({
            success: true,
            data: {
              play: latestPlay
                ? {
                    id: latestPlay.id,
                    sequence: latestPlay.sequence,
                    quarterName: latestPlay.quarterName,
                    timeRemainingMinutes: latestPlay.timeRemainingMinutes,
                    timeRemainingSeconds: latestPlay.timeRemainingSeconds,
                    down: latestPlay.down,
                    distance: latestPlay.distance,
                    yardLine: latestPlay.yardLine,
                    team: latestPlay.team,
                    opponent: latestPlay.opponent,
                    description: latestPlay.description,
                    playType: latestPlay.playType,
                    status: latestPlay.status,
                  }
                : null,
            },
          });
        } else {
          // Get paginated plays
          const allPlays =
            await services.gamePlaysRepository.findByGameId(gameId);
          const paginatedPlays = allPlays.slice(offset, offset + limit);

          res.status(200).json({
            success: true,
            data: {
              plays: paginatedPlays.map((play) => ({
                id: play.id,
                sequence: play.sequence,
                quarterName: play.quarterName,
                timeRemainingMinutes: play.timeRemainingMinutes,
                timeRemainingSeconds: play.timeRemainingSeconds,
                down: play.down,
                distance: play.distance,
                yardLine: play.yardLine,
                team: play.team,
                opponent: play.opponent,
                description: play.description,
                playType: play.playType,
                status: play.status,
              })),
              pagination: {
                total: allPlays.length,
                limit,
                offset,
                hasMore: offset + limit < allPlays.length,
              },
            },
          });
        }
      } catch (error) {
        competitionLogger.error({ error }, "Error in getGamePlays");
        next(
          error instanceof ParsingError
            ? new ApiError(400, error.message)
            : error,
        );
      }
    },

    /**
     * Get latest play for a game
     * GET /nfl/competitions/:competitionId/games/:gameId/plays/latest
     */
    async getLatestPlay(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const competitionId = ensureUuid(req.params.competitionId);
        if (!competitionId) {
          throw new ApiError(400, "Competition ID is required");
        }

        const gameId = ensureUuid(req.params.gameId);
        if (!gameId) {
          throw new ApiError(400, "Game ID is required");
        }

        const plays = await services.gamePlaysRepository.findByGameId(gameId);
        const latestPlay = plays[plays.length - 1]; // Last play in sequence

        res.status(200).json({
          success: true,
          data: {
            play: latestPlay
              ? {
                  id: latestPlay.id,
                  sequence: latestPlay.sequence,
                  quarterName: latestPlay.quarterName,
                  timeRemainingMinutes: latestPlay.timeRemainingMinutes,
                  timeRemainingSeconds: latestPlay.timeRemainingSeconds,
                  down: latestPlay.down,
                  distance: latestPlay.distance,
                  yardLine: latestPlay.yardLine,
                  team: latestPlay.team,
                  opponent: latestPlay.opponent,
                  description: latestPlay.description,
                  playType: latestPlay.playType,
                  status: latestPlay.status,
                }
              : null,
          },
        });
      } catch (error) {
        competitionLogger.error({ error }, "Error in getLatestPlay");
        next(
          error instanceof ParsingError
            ? new ApiError(400, error.message)
            : error,
        );
      }
    },

    /**
     * Predict game winner
     * POST /nfl/competitions/:competitionId/games/:gameId/predictions
     */
    async predictGameWinner(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const competitionId = ensureUuid(req.params.competitionId);
        if (!competitionId) {
          throw new ApiError(400, "Competition ID is required");
        }

        const gameId = ensureUuid(req.params.gameId);
        if (!gameId) {
          throw new ApiError(400, "Game ID is required");
        }

        // Ensure agent is authenticated
        if (!req.agentId) {
          throw new ApiError(401, "Agent authentication required");
        }

        const body = PredictGameWinnerSchema.parse(req.body);

        const prediction =
          await services.gamePredictionService.createPrediction(
            competitionId,
            gameId,
            req.agentId,
            body.predictedWinner,
            body.confidence,
          );

        res.status(201).json({
          success: true,
          data: {
            id: prediction.id,
            predictedWinner: prediction.predictedWinner,
            confidence: Number(prediction.confidence),
            createdAt: prediction.createdAt.toISOString(),
          },
          message: "Prediction created successfully",
        });
      } catch (error) {
        competitionLogger.error({ error }, "Error in predictGameWinner");
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
     * Get predictions for a game
     * GET /nfl/competitions/:competitionId/games/:gameId/predictions?agentId=xxx
     */
    async getGamePredictions(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const competitionId = ensureUuid(req.params.competitionId);
        if (!competitionId) {
          throw new ApiError(400, "Competition ID is required");
        }

        const gameId = ensureUuid(req.params.gameId);
        if (!gameId) {
          throw new ApiError(400, "Game ID is required");
        }

        const agentId = req.query.agentId as string | undefined;

        let predictions;
        if (agentId) {
          // Get predictions for specific agent
          predictions =
            await services.gamePredictionService.getPredictionHistory(
              gameId,
              agentId,
            );
        } else {
          // Get all predictions for game
          predictions =
            await services.gamePredictionService.getGamePredictions(gameId);
        }

        res.status(200).json({
          success: true,
          data: {
            predictions: predictions.map((p) => ({
              id: p.id,
              agentId: p.agentId,
              predictedWinner: p.predictedWinner,
              confidence: Number(p.confidence),
              createdAt: p.createdAt.toISOString(),
            })),
          },
        });
      } catch (error) {
        competitionLogger.error({ error }, "Error in getGamePredictions");
        next(
          error instanceof ParsingError
            ? new ApiError(400, error.message)
            : error,
        );
      }
    },

    /**
     * Get leaderboard for a competition
     * GET /nfl/competitions/:competitionId/leaderboard?gameId=xxx
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

        const gameId = req.query.gameId as string | undefined;

        if (gameId) {
          // Get leaderboard for specific game
          const leaderboard =
            await services.gameScoringService.getGameLeaderboard(
              competitionId,
              gameId,
            );

          res.status(200).json({
            success: true,
            data: {
              leaderboard: leaderboard.map((entry) => ({
                agentId: entry.agentId,
                rank: entry.rank,
                timeWeightedBrierScore: entry.timeWeightedBrierScore,
                finalPrediction: entry.finalPrediction,
                finalConfidence: entry.finalConfidence,
                predictionCount: entry.predictionCount,
              })),
              gameId,
            },
          });
        } else {
          // Get overall competition leaderboard
          const leaderboard =
            await services.gameScoringService.getCompetitionLeaderboard(
              competitionId,
            );

          res.status(200).json({
            success: true,
            data: {
              leaderboard: leaderboard.map((entry) => ({
                agentId: entry.agentId,
                rank: entry.rank,
                averageBrierScore: entry.averageBrierScore,
                gamesScored: entry.gamesScored,
              })),
            },
          });
        }
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
