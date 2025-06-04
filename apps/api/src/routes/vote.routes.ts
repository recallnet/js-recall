import { Router } from "express";

import { VoteController } from "@/controllers/vote.controller.js";

/**
 * Configure Vote Routes
 * Handles voting operations with SIWE session authentication
 * All routes require req.userId to be set by authentication middleware
 */
export function configureVoteRoutes(voteController: VoteController): Router {
  const router = Router();

  /**
   * @openapi
   * /api/user/vote:
   *   post:
   *     summary: Cast a vote for an agent in a competition
   *     description: Cast a vote for an agent participating in a competition. Users can only vote once per competition.
   *     tags:
   *       - Vote
   *     security:
   *       - SIWESession: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - agentId
   *               - competitionId
   *             properties:
   *               agentId:
   *                 type: string
   *                 format: uuid
   *                 description: ID of the agent to vote for
   *                 example: "550e8400-e29b-41d4-a716-446655440000"
   *               competitionId:
   *                 type: string
   *                 format: uuid
   *                 description: ID of the competition the agent is participating in
   *                 example: "123e4567-e89b-12d3-a456-426614174000"
   *             additionalProperties: false
   *     responses:
   *       201:
   *         description: Vote cast successfully
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
   *                   example: "Vote cast successfully"
   *                 vote:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       format: uuid
   *                     userId:
   *                       type: string
   *                       format: uuid
   *                     agentId:
   *                       type: string
   *                       format: uuid
   *                     competitionId:
   *                       type: string
   *                       format: uuid
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *       400:
   *         description: Invalid request or voting not allowed
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 error:
   *                   type: string
   *                   examples:
   *                     competition_disabled: "Competition status does not allow voting"
   *                     agent_not_in_competition: "Agent does not participate in this competition"
   *                     voting_cutoff: "Voting period has ended for this competition"
   *       401:
   *         description: User not authenticated
   *       404:
   *         description: Competition or agent not found
   *       409:
   *         description: User has already voted in this competition
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 error:
   *                   type: string
   *                   example: "You have already voted in this competition"
   *       500:
   *         description: Internal server error
   */
  router.post("/vote", voteController.castVote);

  /**
   * @openapi
   * /api/user/votes:
   *   get:
   *     summary: Get user's votes
   *     description: Retrieve all votes cast by the authenticated user, optionally filtered by competition
   *     tags:
   *       - Vote
   *     security:
   *       - SIWESession: []
   *     parameters:
   *       - in: query
   *         name: competitionId
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Optional competition ID to filter votes by
   *         example: "123e4567-e89b-12d3-a456-426614174000"
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 50
   *         description: Number of votes to return per page
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *         description: Number of votes to skip (for pagination)
   *     responses:
   *       200:
   *         description: Votes retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 votes:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         format: uuid
   *                       agentId:
   *                         type: string
   *                         format: uuid
   *                       competitionId:
   *                         type: string
   *                         format: uuid
   *                       createdAt:
   *                         type: string
   *                         format: date-time
   *                 pagination:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: integer
   *                       description: Total number of votes
   *                     limit:
   *                       type: integer
   *                       description: Number of votes per page
   *                     offset:
   *                       type: integer
   *                       description: Number of votes skipped
   *                     hasMore:
   *                       type: boolean
   *                       description: Whether there are more votes available
   *       400:
   *         description: Invalid query parameters
   *       401:
   *         description: User not authenticated
   *       500:
   *         description: Internal server error
   */
  router.get("/votes", voteController.getUserVotes);

  /**
   * @openapi
   * /api/user/votes/{competitionId}/state:
   *   get:
   *     summary: Get voting state for a competition
   *     description: Get comprehensive voting state information for a user in a specific competition
   *     tags:
   *       - Vote
   *     security:
   *       - SIWESession: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Competition ID to get voting state for
   *         example: "123e4567-e89b-12d3-a456-426614174000"
   *     responses:
   *       200:
   *         description: Voting state retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 votingState:
   *                   type: object
   *                   properties:
   *                     canVote:
   *                       type: boolean
   *                       description: Whether the user can vote in this competition
   *                       example: true
   *                     reason:
   *                       type: string
   *                       description: Reason why voting is disabled (if canVote is false)
   *                       example: "Competition status does not allow voting"
   *                       nullable: true
   *                     userVoteInfo:
   *                       type: object
   *                       properties:
   *                         hasVoted:
   *                           type: boolean
   *                           description: Whether the user has voted in this competition
   *                           example: false
   *                         agentId:
   *                           type: string
   *                           format: uuid
   *                           description: ID of the agent the user voted for (if hasVoted is true)
   *                           nullable: true
   *                         votedAt:
   *                           type: string
   *                           format: date-time
   *                           description: When the user voted (if hasVoted is true)
   *                           nullable: true
   *       400:
   *         description: Invalid competition ID
   *       401:
   *         description: User not authenticated
   *       500:
   *         description: Internal server error
   */
  router.get("/votes/:competitionId/state", voteController.getVotingState);

  return router;
}
