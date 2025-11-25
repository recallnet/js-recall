import { NextFunction, Response } from "express";
import { z } from "zod/v4";

import { NFL_TEAMS } from "@recallnet/db/schema/sports/types";
import { ApiError } from "@recallnet/services/types";

import { competitionLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";
import { AuthenticatedRequest } from "@/types/index.js";

import { ensureAgentId, ensurePaging, ensureUuid } from "./request-helpers.js";

const PredictGameWinnerSchema = z.object({
  predictedWinner: z.enum(NFL_TEAMS),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1, "Reason is required"),
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
          await services.sportsService.competitionGamesRepository.findGameIdsByCompetitionId(
            competitionId,
          );

        // Get game details
        const games =
          await services.sportsService.gamesRepository.findByIds(gameIds);

        res.status(200).json({
          success: true,
          data: {
            games: games.map((game) => ({
              id: game.id,
              providerGameId: game.providerGameId,
              season: game.season,
              week: game.week,
              spread: game.spread,
              endTime: game.endTime?.toISOString() || null,
              homeTeam: game.homeTeam,
              awayTeam: game.awayTeam,
              overUnder: game.overUnder,
              startTime: game.startTime.toISOString(),
              venue: game.venue,
              status: game.status,
              winner: game.winner,
            })),
          },
        });
      } catch (error) {
        competitionLogger.error({ error }, "Error in getAllGames");
        next(error);
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
              weight:
                "w_t = 1 - 0.75 * t (earlier predictions have higher weight)",
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
        next(error);
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
        // Note: require competition ID to be present in the URL, but it's not actually used in the request
        ensureUuid(req.params.competitionId);
        const gameId = ensureUuid(req.params.gameId);
        const game =
          await services.sportsService.gamesRepository.findById(gameId);
        if (!game) {
          throw new ApiError(404, "Game not found");
        }

        // Get agent's latest prediction if authenticated
        let latestPrediction = null;
        if (req.agentId) {
          const agentId = ensureAgentId(req);
          const prediction =
            await services.sportsService.gamePredictionService.getLatestPrediction(
              gameId,
              agentId,
            );
          if (prediction) {
            latestPrediction = {
              predictedWinner: prediction.predictedWinner,
              confidence: prediction.confidence,
              reason: prediction.reason,
              createdAt: prediction.createdAt.toISOString(),
            };
          }
        }

        res.status(200).json({
          success: true,
          data: {
            game: {
              id: game.id,
              providerGameId: game.providerGameId,
              season: game.season,
              week: game.week,
              startTime: game.startTime.toISOString(),
              endTime: game.endTime?.toISOString() || null,
              homeTeam: game.homeTeam,
              awayTeam: game.awayTeam,
              spread: game.spread,
              overUnder: game.overUnder,
              venue: game.venue,
              status: game.status,
              winner: game.winner,
            },
            latestPrediction,
          },
        });
      } catch (error) {
        competitionLogger.error({ error }, "Error in getGameInfo");
        next(error);
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
        // Note: require competition ID to be present in the URL, but it's not actually used in the request
        ensureUuid(req.params.competitionId);
        const gameId = ensureUuid(req.params.gameId);
        const { limit, offset, sort } = ensurePaging(req);
        const latest = req.query.latest === "true";

        if (latest) {
          // Get only the latest play
          const plays =
            await services.sportsService.gamePlaysRepository.findByGameId(
              gameId,
              {
                limit: 1,
                offset: 0,
                sort: "-createdAt",
              },
            );
          const latestPlay = plays.length > 0 ? plays[0] : null;

          res.status(200).json({
            success: true,
            data: {
              play: latestPlay,
            },
          });
        } else {
          // Get paginated plays
          const [plays, total] = await Promise.all([
            services.sportsService.gamePlaysRepository.findByGameId(gameId, {
              limit,
              offset,
              sort,
            }),
            services.sportsService.gamePlaysRepository.countByGameId(gameId),
          ]);

          res.status(200).json({
            success: true,
            data: {
              plays: plays.map((play) => ({
                id: play.id,
                sequence: play.sequence,
                quarterName: play.quarterName,
                timeRemainingMinutes: play.timeRemainingMinutes,
                timeRemainingSeconds: play.timeRemainingSeconds,
                down: play.down,
                distance: play.distance,
                yardLine: play.yardLine,
                yardLineTerritory: play.yardLineTerritory,
                yardsToEndZone: play.yardsToEndZone,
                team: play.team,
                opponent: play.opponent,
                description: play.description,
                playType: play.playType,
              })),
              pagination: {
                total,
                limit,
                offset,
                hasMore: offset + plays.length < total,
              },
            },
          });
        }
      } catch (error) {
        competitionLogger.error({ error }, "Error in getGamePlays");
        next(error);
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
        const gameId = ensureUuid(req.params.gameId);
        const agentId = ensureAgentId(req);
        const gameIsInCompetition =
          await services.sportsService.competitionGamesRepository.findByCompetitionAndGame(
            competitionId,
            gameId,
          );
        if (!gameIsInCompetition) {
          throw new ApiError(400, "Game is not part of this competition");
        }
        const agentIsInCompetition =
          await services.competitionService.isAgentInCompetition(
            competitionId,
            agentId,
          );
        if (!agentIsInCompetition) {
          throw new ApiError(403, "Agent not in competition");
        }
        const body = PredictGameWinnerSchema.safeParse(req.body);
        if (!body.success) {
          throw new ApiError(400, body.error.message);
        }

        const { predictedWinner, confidence, reason } = body.data;
        const prediction =
          await services.sportsService.gamePredictionService.createPrediction(
            competitionId,
            gameId,
            agentId,
            predictedWinner,
            confidence,
            reason,
          );

        res.status(201).json({
          success: true,
          data: {
            id: prediction.id,
            predictedWinner: prediction.predictedWinner,
            confidence: prediction.confidence,
            reason: prediction.reason,
            createdAt: prediction.createdAt.toISOString(),
          },
          message: "Prediction created successfully",
        });
      } catch (error) {
        competitionLogger.error({ error }, "Error in predictGameWinner");
        next(error);
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
        ensureUuid(req.params.competitionId);
        const gameId = ensureUuid(req.params.gameId);

        let predictions;
        if (req.agentId) {
          const agentId = ensureAgentId(req);
          // Get predictions for specific agent
          predictions =
            await services.sportsService.gamePredictionService.getPredictionHistory(
              gameId,
              agentId,
            );
        } else {
          // Get all predictions for game
          predictions =
            await services.sportsService.gamePredictionService.getGamePredictions(
              gameId,
            );
        }

        res.status(200).json({
          success: true,
          data: {
            predictions: predictions.map((p) => ({
              id: p.id,
              agentId: p.agentId,
              predictedWinner: p.predictedWinner,
              confidence: p.confidence,
              reason: p.reason,
              createdAt: p.createdAt.toISOString(),
            })),
          },
        });
      } catch (error) {
        competitionLogger.error({ error }, "Error in getGamePredictions");
        next(error);
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
        const gameId = req.query.gameId as string | undefined;

        if (gameId) {
          const parsedGameId = ensureUuid(gameId);
          // Get leaderboard for specific game
          const leaderboard =
            await services.sportsService.gameScoringService.getGameLeaderboard(
              competitionId,
              parsedGameId,
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
              gameId: parsedGameId,
            },
          });
        } else {
          // Get overall competition leaderboard
          const leaderboard =
            await services.sportsService.gameScoringService.getCompetitionLeaderboard(
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
        next(error);
      }
    },
  };
}
