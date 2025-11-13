import { RequestHandler, Router } from "express";

import { makeNflController } from "@/controllers/nfl.controller.js";
import { ServiceRegistry } from "@/services/index.js";

/**
 * NFL routes
 * Handles NFL play prediction endpoints
 */
export function configureNflRoutes(
  services: ServiceRegistry,
  ...middlewares: RequestHandler[]
): Router {
  const router = Router();
  const controller = makeNflController(services);

  if (middlewares.length) {
    router.use(...middlewares);
  }

  /**
   * GET /competitions/:competitionId/plays
   * Get open plays for a competition
   */
  router.get("/competitions/:competitionId/plays", controller.getPlays);

  /**
   * POST /competitions/:competitionId/plays/:playId/predictions
   * Create a prediction for a play
   * Rate limited to prevent spam
   */
  router.post(
    "/competitions/:competitionId/plays/:playId/predictions",
    controller.createPrediction,
  );

  /**
   * GET /competitions/:competitionId/leaderboard
   * Get leaderboard for a competition
   */
  router.get(
    "/competitions/:competitionId/leaderboard",
    controller.getLeaderboard,
  );

  return router;
}
