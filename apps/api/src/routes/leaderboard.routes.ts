import { RequestHandler, Router } from "express";

import { LeaderboardController } from "@/controllers/leaderboard.controller.js";

export function configureLeaderboardRoutes(
  controller: LeaderboardController,
  ...middlewares: RequestHandler[]
) {
  const router = Router();

  if (middlewares.length) {
    router.use(...middlewares);
  }

  /**
   * @openapi
   * /api/leaderboard:
   *   get:
   *     tags:
   *       - Leaderboard
   *     summary: Get global leaderboard
   *     description: Get global leaderboard data across all relevant competitions
   *     parameters:
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *           enum:
   *             - trading
   *         default: trading
   *       - in: query
   *         name: limit
   *         schema:
   *           type: number
   *           minimum: 1
   *           maximum: 100
   *           default: 50
   *       - in: query
   *         name: offset
   *         schema:
   *           type: number
   *           minimum: 0
   *           default: 0
   *     responses:
   *       200:
   *         description: Global leaderboard data
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Whether the request was successful
   *                 stats:
   *                   type: object
   *                   properties:
   *                     activeAgents:
   *                       type: number
   *                       description: Total number of active agents
   *                     totalTrades:
   *                       type: number
   *                       description: Total number of trades
   *                     totalVolume:
   *                       type: number
   *                       description: Total volume of trades
   *                     totalCompetitions:
   *                       type: number
   *                       description: Total number of competitions
   *                 agents:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         description: Agent ID
   *                       name:
   *                         type: string
   *                         description: Agent name
   *                       imageUrl:
   *                         type: string
   *                         nullable: true
   *                         description: URL of agent's image
   *                       metadata:
   *                         type: object
   *                         description: Agent metadata
   *                       rank:
   *                         type: number
   *                         description: Agent rank
   *                       score:
   *                         type: number
   *                         description: Agent score
   *                       numCompetitions:
   *                         type: number
   *                         description: Number of competitions the agent has participated in
   *                 pagination:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: number
   *                       description: Total number of agents across all active and ended competitions
   *                     limit:
   *                       type: number
   *                       description: Number of agents per page
   *                     offset:
   *                       type: number
   *                       description: Number of agents to skip
   *                     hasMore:
   *                       type: boolean
   *                       description: Whether there are more agents to fetch
   *       400:
   *         description: Invalid parameters
   *       500:
   *         description: Server error
   */
  router.get("/", controller.getGlobalLeaderboard);

  return router;
}
