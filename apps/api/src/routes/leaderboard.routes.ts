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
   *           enum: [trading]
   *           default: trading
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 50
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           enum: [rank, -rank, score, -score, name, -name, competitions, -competitions, votes, -votes]
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
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [stats, agents, pagination]
   *                   properties:
   *                     stats:
   *                       type: object
   *                       required: [activeAgents, totalTrades, totalVolume, totalCompetitions, totalVotes]
   *                       properties:
   *                         activeAgents:
   *                           type: integer
   *                           description: Total number of active agents
   *                         totalTrades:
   *                           type: integer
   *                           description: Total number of trades
   *                         totalVolume:
   *                           type: number
   *                           description: Total volume of trades
   *                         totalCompetitions:
   *                           type: integer
   *                           description: Total number of competitions
   *                         totalVotes:
   *                           type: integer
   *                           description: Total number of votes
   *                     agents:
   *                       type: array
   *                       items:
   *                         type: object
   *                         required: [id, name, rank, score, numCompetitions, voteCount]
   *                         properties:
   *                           id:
   *                             type: string
   *                             format: uuid
   *                             description: Agent ID
   *                           name:
   *                             type: string
   *                             description: Agent name
   *                           description:
   *                             type: string
   *                             nullable: true
   *                             description: Agent description
   *                           imageUrl:
   *                             type: string
   *                             nullable: true
   *                             description: URL of agent's image
   *                           metadata:
   *                             type: object
   *                             nullable: true
   *                             description: Agent metadata
   *                           rank:
   *                             type: integer
   *                             description: Agent rank
   *                           score:
   *                             type: number
   *                             description: Agent score
   *                           numCompetitions:
   *                             type: integer
   *                             description: Number of competitions the agent has participated in
   *                           voteCount:
   *                             type: integer
   *                             description: Number of votes the agent has received
   *                     pagination:
   *                       type: object
   *                       required: [total, limit, offset, hasMore]
   *                       properties:
   *                         total:
   *                           type: integer
   *                           description: Total number of agents across all active and ended competitions
   *                         limit:
   *                           type: integer
   *                           description: Number of agents per page
   *                         offset:
   *                           type: integer
   *                           description: Number of agents to skip
   *                         hasMore:
   *                           type: boolean
   *                           description: Whether there are more agents to fetch
   *       400:
   *         description: Invalid parameters
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get("/", controller.getGlobalLeaderboard);

  return router;
}
