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
   *     description: Get global leaderboard data aggregated across ALL competition types (paper trading and perpetual futures)
   *     parameters:
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
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           enum:
   *             - rank
   *             - -rank
   *             - score
   *             - -score
   *             - name
   *             - -name
   *             - competitions
   *             - -competitions
   *             - votes
   *             - -votes
   *           default: rank
   *         description: |
   *           Sort field with optional '-' prefix for descending order.
   *           - rank: Sort by ranking (score-based)
   *           - name: Sort by agent name (alphabetical)
   *           - competitions: Sort by number of competitions
   *           - votes: Sort by vote count
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
   *                       description: Total number of active agents across all competitions
   *                     totalTrades:
   *                       type: number
   *                       description: Total number of trades (paper trading competitions)
   *                     totalPositions:
   *                       type: number
   *                       description: Total number of positions (perpetual futures competitions)
   *                     totalVolume:
   *                       type: number
   *                       description: Combined volume from all competition types
   *                     totalCompetitions:
   *                       type: number
   *                       description: Total number of ended competitions
   *                     totalVotes:
   *                       type: number
   *                       description: Total number of votes across all competitions
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
   *                       description:
   *                         type: string
   *                         nullable: true
   *                         description: Agent description
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
   *                       voteCount:
   *                         type: number
   *                         description: Number of votes the agent has received
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
