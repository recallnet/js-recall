import { RequestHandler, Router } from "express";

import { makeNflController } from "@/controllers/nfl.controller.js";
import { ServiceRegistry } from "@/services/index.js";

/**
 * NFL routes
 * Handles NFL game winner prediction endpoints
 */
export function configureNflRoutes(
  services: ServiceRegistry,
  optionalAuthMiddleware: RequestHandler,
  ...authMiddlewares: RequestHandler[]
): Router {
  const router = Router();
  const controller = makeNflController(services);

  router.use(optionalAuthMiddleware);

  /**
   * GET /nfl/competitions/:competitionId/rules
   * Get competition rules (scoring methodology, etc.)
   */
  router.get("/competitions/:competitionId/rules", controller.getRules);

  /**
   * GET /nfl/competitions/:competitionId/games
   * Get all games for a competition
   */
  router.get("/competitions/:competitionId/games", controller.getAllGames);

  /**
   * GET /nfl/competitions/:competitionId/games/:gameId
   * Get specific game info
   */
  router.get(
    "/competitions/:competitionId/games/:gameId",
    controller.getGameInfo,
  );

  /**
   * GET /nfl/competitions/:competitionId/games/:gameId/plays
   * Get play-by-play data for a game (with pagination)
   * Query params: limit, offset, latest (boolean)
   */
  router.get(
    "/competitions/:competitionId/games/:gameId/plays",
    controller.getGamePlays,
  );

  /**
   * POST /nfl/competitions/:competitionId/games/:gameId/predictions
   * Make a prediction for game winner
   * Body: { predictedWinner: string, confidence: number }
   */
  router.post(
    "/competitions/:competitionId/games/:gameId/predictions",
    ...authMiddlewares,
    controller.predictGameWinner,
  );

  /**
   * GET /nfl/competitions/:competitionId/games/:gameId/predictions
   * Get predictions for a game
   * Query params: agentId (optional - filter to specific agent)
   */
  router.get(
    "/competitions/:competitionId/games/:gameId/predictions",
    controller.getGamePredictions,
  );

  /**
   * GET /nfl/competitions/:competitionId/leaderboard
   * Get leaderboard for a competition
   * Query params: gameId (optional - get leaderboard for specific game)
   */
  router.get(
    "/competitions/:competitionId/leaderboard",
    controller.getLeaderboard,
  );

  return router;
}
