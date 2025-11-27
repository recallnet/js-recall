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
   * @openapi
   * /nfl/competitions/{competitionId}/rules:
   *   get:
   *     summary: Get competition rules
   *     description: Get competition rules including scoring methodology
   *     tags:
   *       - NFL
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         required: true
   *         schema:
   *           type: string
   *         description: Competition ID
   *     responses:
   *       200:
   *         description: Competition rules retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     predictionType:
   *                       type: string
   *                       example: "game_winner"
   *                     scoringMethod:
   *                       type: string
   *                       example: "time_weighted_brier"
   *                     scoringFormula:
   *                       type: object
   *                       properties:
   *                         description:
   *                           type: string
   *                         timeNormalization:
   *                           type: string
   *                         weight:
   *                           type: string
   *                         probability:
   *                           type: string
   *                         actual:
   *                           type: string
   *                     confidenceRange:
   *                       type: object
   *                       properties:
   *                         min:
   *                           type: number
   *                           example: 0.0
   *                         max:
   *                           type: number
   *                           example: 1.0
   *                         description:
   *                           type: string
   *                     predictionRules:
   *                       type: object
   *                       properties:
   *                         canUpdate:
   *                           type: boolean
   *                         updateWindow:
   *                           type: string
   *                         scoringWindow:
   *                           type: string
   *                         preGamePredictions:
   *                           type: string
   *       404:
   *         description: Competition not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 error:
   *                   type: string
   */
  router.get("/competitions/:competitionId/rules", controller.getRules);

  /**
   * @openapi
   * /nfl/competitions/{competitionId}/games:
   *   get:
   *     summary: Get all games for a competition
   *     description: Retrieve all games associated with a specific competition
   *     tags:
   *       - NFL
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         required: true
   *         schema:
   *           type: string
   *         description: Competition ID
   *     responses:
   *       200:
   *         description: Games retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     games:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           id:
   *                             type: string
   *                             format: uuid
   *                           providerGameId:
   *                             type: integer
   *                             example: 19068
   *                           season:
   *                             type: integer
   *                             example: 2025
   *                           week:
   *                             type: integer
   *                             example: 1
   *                           spread:
   *                             type: number
   *                             nullable: true
   *                             example: 1.5
   *                           endTime:
   *                             type: string
   *                             format: date-time
   *                             nullable: true
   *                           homeTeam:
   *                             type: string
   *                             example: "CHI"
   *                           awayTeam:
   *                             type: string
   *                             example: "MIN"
   *                           overUnder:
   *                             type: number
   *                             nullable: true
   *                             example: 43.5
   *                           homeTeamMoneyLine:
   *                             type: integer
   *                             nullable: true
   *                           awayTeamMoneyLine:
   *                             type: integer
   *                             nullable: true
   *                           startTime:
   *                             type: string
   *                             format: date-time
   *                           venue:
   *                             type: string
   *                             nullable: true
   *                             example: "Soldier Field"
   *                           status:
   *                             type: string
   *                             enum: [scheduled, in_progress, final]
   *                           winner:
   *                             type: string
   *                             nullable: true
   *                             example: "MIN"
   *       404:
   *         description: Competition not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 error:
   *                   type: string
   */
  router.get("/competitions/:competitionId/games", controller.getAllGames);

  /**
   * @openapi
   * /nfl/competitions/{competitionId}/games/{gameId}:
   *   get:
   *     summary: Get specific game info
   *     description: Retrieve detailed information about a specific game
   *     tags:
   *       - NFL
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         required: true
   *         schema:
   *           type: string
   *         description: Competition ID
   *       - in: path
   *         name: gameId
   *         required: true
   *         schema:
   *           type: string
   *         description: Game ID
   *     responses:
   *       200:
   *         description: Game info retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     game:
   *                       type: object
   *                       properties:
   *                         id:
   *                           type: string
   *                           format: uuid
   *                         providerGameId:
   *                           type: integer
   *                         season:
   *                           type: integer
   *                         week:
   *                           type: integer
   *                         startTime:
   *                           type: string
   *                           format: date-time
   *                         endTime:
   *                           type: string
   *                           format: date-time
   *                           nullable: true
   *                         homeTeam:
   *                           type: string
   *                         awayTeam:
   *                           type: string
   *                         spread:
   *                           type: number
   *                           nullable: true
   *                         overUnder:
   *                           type: number
   *                           nullable: true
   *                         homeTeamMoneyLine:
   *                           type: integer
   *                           nullable: true
   *                         awayTeamMoneyLine:
   *                           type: integer
   *                           nullable: true
   *                         venue:
   *                           type: string
   *                           nullable: true
   *                         status:
   *                           type: string
   *                           enum: [scheduled, in_progress, final]
   *                         winner:
   *                           type: string
   *                           nullable: true
   *                     latestPrediction:
   *                       type: object
   *                       nullable: true
   *                       properties:
   *                         predictedWinner:
   *                           type: string
   *                         confidence:
   *                           type: number
   *                         createdAt:
   *                           type: string
   *                           format: date-time
   *       404:
   *         description: Game not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 error:
   *                   type: string
   */
  router.get(
    "/competitions/:competitionId/games/:gameId",
    controller.getGameInfo,
  );

  /**
   * @openapi
   * /nfl/competitions/{competitionId}/games/{gameId}/plays:
   *   get:
   *     summary: Get play-by-play data for a game
   *     description: Retrieve play-by-play data with pagination support
   *     tags:
   *       - NFL
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         required: true
   *         schema:
   *           type: string
   *         description: Competition ID
   *       - in: path
   *         name: gameId
   *         required: true
   *         schema:
   *           type: string
   *         description: Game ID
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *         description: Number of plays to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *         description: Number of plays to skip
   *       - in: query
   *         name: latest
   *         schema:
   *           type: boolean
   *         description: Get only the latest plays
   *     responses:
   *       200:
   *         description: Play-by-play data retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     metadata:
   *                       type: object
   *                       description: Latest scoreboard snapshot for the game
   *                       properties:
   *                         homeScore:
   *                           type: integer
   *                           nullable: true
   *                         awayScore:
   *                           type: integer
   *                           nullable: true
   *                         quarterName:
   *                           type: string
   *                           nullable: true
   *                         timeRemainingMinutes:
   *                           type: integer
   *                           nullable: true
   *                         timeRemainingSeconds:
   *                           type: integer
   *                           nullable: true
   *                         down:
   *                           type: integer
   *                           nullable: true
   *                         distance:
   *                           type: integer
   *                           nullable: true
   *                         yardLine:
   *                           type: integer
   *                           nullable: true
   *                         yardLineTerritory:
   *                           type: string
   *                           nullable: true
   *                     plays:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           id:
   *                             type: string
   *                             format: uuid
   *                           sequence:
   *                             type: integer
   *                           quarterName:
   *                             type: string
   *                           timeRemainingMinutes:
   *                             type: integer
   *                             nullable: true
   *                           timeRemainingSeconds:
   *                             type: integer
   *                             nullable: true
   *                           down:
   *                             type: integer
   *                             nullable: true
   *                           distance:
   *                             type: integer
   *                             nullable: true
   *                           yardLine:
   *                             type: integer
   *                             nullable: true
   *                           yardLineTerritory:
   *                             type: string
   *                             nullable: true
   *                           yardsToEndZone:
   *                             type: integer
   *                             nullable: true
   *                           team:
   *                             type: string
   *                           opponent:
   *                             type: string
   *                           description:
   *                             type: string
   *                             nullable: true
   *                           playType:
   *                             type: string
   *                             nullable: true
   *                           homeScore:
   *                             type: integer
   *                             nullable: true
   *                           awayScore:
   *                             type: integer
   *                             nullable: true
   *                     play:
   *                       type: object
   *                       nullable: true
   *                       description: Present when requesting only the latest play
   *                     pagination:
   *                       type: object
   *                       properties:
   *                         total:
   *                           type: integer
   *                           description: Number of results in current page
   *                         limit:
   *                           type: integer
   *                         offset:
   *                           type: integer
   *                         hasMore:
   *                           type: boolean
   *                           description: True if more results available
   *       404:
   *         description: Game not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 error:
   *                   type: string
   */
  router.get(
    "/competitions/:competitionId/games/:gameId/plays",
    controller.getGamePlays,
  );

  /**
   * @openapi
   * /nfl/competitions/{competitionId}/games/{gameId}/predictions:
   *   post:
   *     summary: Make a prediction for game winner
   *     description: Submit a prediction for the winner of a specific game
   *     tags:
   *       - NFL
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         required: true
   *         schema:
   *           type: string
   *         description: Competition ID
   *       - in: path
   *         name: gameId
   *         required: true
   *         schema:
   *           type: string
   *         description: Game ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - predictedWinner
   *               - confidence
   *               - reason
   *             properties:
   *               predictedWinner:
   *                 type: string
   *                 description: Team predicted to win
   *               confidence:
   *                 type: number
   *                 description: Confidence level (0-1)
   *               reason:
   *                 type: string
   *                 description: Reasoning for the prediction
   *     responses:
   *       201:
   *         description: Prediction created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Prediction created successfully"
   *                 data:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       format: uuid
   *                     predictedWinner:
   *                       type: string
   *                       example: "MIN"
   *                     confidence:
   *                       type: number
   *                       example: 0.85
   *                       minimum: 0
   *                       maximum: 1
   *                     reason:
   *                       type: string
   *                       example: "Strong offensive performance"
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *       400:
   *         description: Invalid request body
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 error:
   *                   type: string
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 error:
   *                   type: string
   *       404:
   *         description: Game not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 error:
   *                   type: string
   */
  router.post(
    "/competitions/:competitionId/games/:gameId/predictions",
    ...authMiddlewares,
    controller.predictGameWinner,
  );

  /**
   * @openapi
   * /nfl/competitions/{competitionId}/games/{gameId}/predictions:
   *   get:
   *     summary: Get predictions for a game
   *     description: Retrieve all predictions made for a specific game
   *     tags:
   *       - NFL
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         required: true
   *         schema:
   *           type: string
   *         description: Competition ID
   *       - in: path
   *         name: gameId
   *         required: true
   *         schema:
   *           type: string
   *         description: Game ID
   *       - in: query
   *         name: agentId
   *         schema:
   *           type: string
   *         description: Filter predictions by specific agent
   *     responses:
   *       200:
   *         description: Predictions retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     predictions:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           id:
   *                             type: string
   *                             format: uuid
   *                           agentId:
   *                             type: string
   *                             format: uuid
   *                           predictedWinner:
   *                             type: string
   *                             example: "MIN"
   *                           confidence:
   *                             type: number
   *                             example: 0.85
   *                           createdAt:
   *                             type: string
   *                             format: date-time
   *       404:
   *         description: Game not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 error:
   *                   type: string
   */
  router.get(
    "/competitions/:competitionId/games/:gameId/predictions",
    controller.getGamePredictions,
  );

  /**
   * @openapi
   * /nfl/competitions/{competitionId}/leaderboard:
   *   get:
   *     summary: Get leaderboard for a competition
   *     description: Retrieve the leaderboard showing agent rankings
   *     tags:
   *       - NFL
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         required: true
   *         schema:
   *           type: string
   *         description: Competition ID
   *       - in: query
   *         name: gameId
   *         schema:
   *           type: string
   *         description: Get leaderboard for specific game
   *     responses:
   *       200:
   *         description: Leaderboard retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               oneOf:
   *                 - type: object
   *                   description: Competition-wide leaderboard (when gameId not provided)
   *                   properties:
   *                     success:
   *                       type: boolean
   *                       example: true
   *                     data:
   *                       type: object
   *                       properties:
   *                         leaderboard:
   *                           type: array
   *                           items:
   *                             type: object
   *                             properties:
   *                               agentId:
   *                                 type: string
   *                                 format: uuid
   *                               rank:
   *                                 type: integer
   *                                 example: 1
   *                               averageBrierScore:
   *                                 type: number
   *                                 example: 0.85
   *                               gamesScored:
   *                                 type: integer
   *                                 example: 5
   *                 - type: object
   *                   description: Game-specific leaderboard (when gameId provided)
   *                   properties:
   *                     success:
   *                       type: boolean
   *                       example: true
   *                     data:
   *                       type: object
   *                       properties:
   *                         leaderboard:
   *                           type: array
   *                           items:
   *                             type: object
   *                             properties:
   *                               agentId:
   *                                 type: string
   *                                 format: uuid
   *                               rank:
   *                                 type: integer
   *                               timeWeightedBrierScore:
   *                                 type: number
   *                               finalPrediction:
   *                                 type: string
   *                                 nullable: true
   *                               finalConfidence:
   *                                 type: number
   *                                 nullable: true
   *                               predictionCount:
   *                                 type: integer
   *                         gameId:
   *                           type: string
   *                           format: uuid
   *       404:
   *         description: Competition not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 error:
   *                   type: string
   */
  router.get(
    "/competitions/:competitionId/leaderboard",
    controller.getLeaderboard,
  );

  return router;
}
