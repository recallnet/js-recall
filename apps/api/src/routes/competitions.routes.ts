import { RequestHandler, Router } from "express";

import { CompetitionController } from "@/controllers/competition.controller.js";

export function configureCompetitionsRoutes(
  controller: CompetitionController,
  optionalAuthMiddleware: RequestHandler,
  ...authMiddlewares: RequestHandler[]
) {
  const router = Router();

  /**
   * @openapi
   * /api/competitions:
   *   get:
   *     tags:
   *       - Competition
   *     summary: Get upcoming competitions
   *     description: Get all competitions
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *         required: false
   *         description: Optional filtering by competition status (default value is `active`)
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *         required: false
   *         description: Optional field to sort by (default value is `createdDate`)
   *       - in: query
   *         name: limit
   *         schema:
   *           type: string
   *         required: false
   *         description: Optional field to choose max size of result set (default value is `10`)
   *       - in: query
   *         name: offset
   *         schema:
   *           type: string
   *         required: false
   *         description: Optional field to choose offset of result set (default value is `0`)
   *     responses:
   *       200:
   *         description: Competitions retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 competitions:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         description: Competition ID
   *                       name:
   *                         type: string
   *                         description: Competition name
   *                       description:
   *                         type: string
   *                         nullable: true
   *                         description: Competition description
   *                       externalUrl:
   *                         type: string
   *                         nullable: true
   *                         description: External URL for competition details
   *                       imageUrl:
   *                         type: string
   *                         nullable: true
   *                         description: URL to competition image
   *                       status:
   *                         type: string
   *                         enum: [pending]
   *                         description: Competition status (always PENDING)
   *                       type:
   *                         type: string
   *                         enum: [trading]
   *                         description: Competition type
   *                       crossChainTradingType:
   *                         type: string
   *                         enum: [disallowAll, disallowXParent, allow]
   *                         description: The type of cross-chain trading allowed in this competition
   *                       createdAt:
   *                         type: string
   *                         format: date-time
   *                         description: When the competition was created
   *                       updatedAt:
   *                         type: string
   *                         format: date-time
   *                         description: When the competition was last updated
   *                       registeredParticipants:
   *                         type: integer
   *                         description: Number of participants registered for this competition
   *                         example: 10
   *                       maxParticipants:
   *                         type: integer
   *                         nullable: true
   *                         description: Maximum number of participants allowed to register for this competition. null means no limit.
   *                         example: 50
   *                       rewards:
   *                         nullable: true
   *                         type: array
   *                         description: Rewards for competition placements
   *                         items:
   *                           type: object
   *                           properties:
   *                             rank:
   *                               type: number
   *                               description: Rank of the reward
   *                               example: 1
   *                             reward:
   *                               type: number
   *                               description: Reward amount for the given rank
   *                               example: 1000
   *                             agentId:
   *                               type: string
   *                               description: Agent ID of the reward
   *                               example: "123e4567-e89b-12d3-a456-426614174000"
   *                       votingEnabled:
   *                         type: boolean
   *                         description: Whether voting is enabled for this competition (only present for authenticated users)
   *                       totalVotes:
   *                         type: integer
   *                         description: Total number of votes cast in this competition (only present for authenticated users)
   *                       userVotingInfo:
   *                         type: object
   *                         nullable: true
   *                         description: User's voting state for this competition (only present for authenticated users)
   *                         properties:
   *                           canVote:
   *                             type: boolean
   *                             description: Whether the user can vote in this competition
   *                           reason:
   *                             type: string
   *                             nullable: true
   *                             description: Reason why voting is not allowed (if canVote is false)
   *                           info:
   *                             type: object
   *                             properties:
   *                               hasVoted:
   *                                 type: boolean
   *                                 description: Whether the user has already voted in this competition
   *                               agentId:
   *                                 type: string
   *                                 nullable: true
   *                                 description: ID of the agent the user voted for (if hasVoted is true)
   *                               votedAt:
   *                                 type: string
   *                                 format: date-time
   *                                 nullable: true
   *                                 description: When the user cast their vote (if hasVoted is true)
   *                 pagination:
   *                   type: object
   *                   description: Pagination metadata
   *                   properties:
   *                     total:
   *                       type: integer
   *                       description: Total number of competitions matching the filter
   *                       example: 25
   *                     limit:
   *                       type: integer
   *                       description: Maximum number of results returned
   *                       example: 10
   *                     offset:
   *                       type: integer
   *                       description: Number of results skipped
   *                       example: 0
   *                     hasMore:
   *                       type: boolean
   *                       description: Whether there are more results available
   *                       example: true
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *       500:
   *         description: Server error
   */
  router.get("/", optionalAuthMiddleware, controller.getCompetitions);

  /**
   * @openapi
   * /api/competitions/leaderboard:
   *   get:
   *     tags:
   *       - Competition
   *     summary: Get competition leaderboard
   *     description: Get the leaderboard for the active competition or a specific competition. Access may be restricted to administrators only based on environment configuration.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: competitionId
   *         schema:
   *           type: string
   *         required: false
   *         description: Optional competition ID (if not provided, the active competition is used)
   *     responses:
   *       200:
   *         description: Competition leaderboard
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 competition:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Competition ID
   *                     name:
   *                       type: string
   *                       description: Competition name
   *                     description:
   *                       type: string
   *                       nullable: true
   *                       description: Competition description
   *                     externalUrl:
   *                       type: string
   *                       nullable: true
   *                       description: External URL for competition details
   *                     imageUrl:
   *                       type: string
   *                       nullable: true
   *                       description: URL to competition image
   *                     startDate:
   *                       type: string
   *                       format: date-time
   *                       description: Competition start date
   *                     endDate:
   *                       type: string
   *                       format: date-time
   *                       nullable: true
   *                       description: Competition end date
   *                     status:
   *                       type: string
   *                       enum: [pending, active, ended]
   *                       description: Competition status
   *                     type:
   *                       type: string
   *                       enum: [trading]
   *                       description: Competition type
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                       description: When the competition was created
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *                       description: When the competition was last updated
   *                 leaderboard:
   *                   type: array
   *                   description: Ranked list of active agents
   *                   items:
   *                     type: object
   *                     properties:
   *                       rank:
   *                         type: integer
   *                         description: Agent rank on the leaderboard
   *                       agentId:
   *                         type: string
   *                         description: Agent ID
   *                       agentName:
   *                         type: string
   *                         description: Agent name
   *                       agentHandle:
   *                         type: string
   *                         description: Agent handle
   *                       portfolioValue:
   *                         type: number
   *                         description: Current portfolio value in USD
   *                       active:
   *                         type: boolean
   *                         description: Always true for this array
   *                       deactivationReason:
   *                         type: string
   *                         nullable: true
   *                         description: Always null for active agents
   *                 inactiveAgents:
   *                   type: array
   *                   description: List of agents not actively participating in this competition (excluded from ranking)
   *                   items:
   *                     type: object
   *                     properties:
   *                       agentId:
   *                         type: string
   *                         description: Agent ID
   *                       agentName:
   *                         type: string
   *                         description: Agent name
   *                       agentHandle:
   *                         type: string
   *                         description: Agent handle
   *                       portfolioValue:
   *                         type: number
   *                         description: Current portfolio value in USD
   *                       active:
   *                         type: boolean
   *                         description: Always false for this array
   *                       deactivationReason:
   *                         type: string
   *                         description: Reason for removal from this specific competition
   *                 hasInactiveAgents:
   *                   type: boolean
   *                   description: Indicates if any agents are not actively participating in this competition
   *       400:
   *         description: Bad request - No active competition and no competitionId provided
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *       403:
   *         description: Forbidden - Agent not participating in the competition
   *       404:
   *         description: Competition not found
   *       500:
   *         description: Server error
   */
  router.get("/leaderboard", ...authMiddlewares, controller.getLeaderboard);

  /**
   * @openapi
   * /api/competitions/status:
   *   get:
   *     tags:
   *       - Competition
   *     summary: Get competition status
   *     description: Get the status of the active competition
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Competition status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 active:
   *                   type: boolean
   *                   description: Whether there is an active competition
   *                 competition:
   *                   type: object
   *                   nullable: true
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Competition ID
   *                     name:
   *                       type: string
   *                       description: Competition name
   *                     description:
   *                       type: string
   *                       nullable: true
   *                       description: Competition description
   *                     externalUrl:
   *                       type: string
   *                       nullable: true
   *                       description: External URL for competition details
   *                     imageUrl:
   *                       type: string
   *                       nullable: true
   *                       description: URL to competition image
   *                     startDate:
   *                       type: string
   *                       format: date-time
   *                       description: Competition start date
   *                     endDate:
   *                       type: string
   *                       format: date-time
   *                       nullable: true
   *                       description: Competition end date
   *                     status:
   *                       type: string
   *                       enum: [pending, active, ended]
   *                       description: Competition status
   *                     type:
   *                       type: string
   *                       enum: [trading]
   *                       description: Competition type
   *                     crossChainTradingType:
   *                       type: string
   *                       enum: [disallowAll, disallowXParent, allow]
   *                       description: The type of cross-chain trading allowed in this competition
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                       description: When the competition was created
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *                       description: When the competition was last updated
   *                     totalVotes:
   *                       type: integer
   *                       description: Total number of votes cast in this competition
   *                     votingEnabled:
   *                       type: boolean
   *                       description: Whether voting is enabled for this competition (only present for authenticated users)
   *                     userVotingInfo:
   *                       type: object
   *                       nullable: true
   *                       description: User's voting state for this competition (only present for authenticated users)
   *                       properties:
   *                         canVote:
   *                           type: boolean
   *                           description: Whether the user can vote in this competition
   *                         reason:
   *                           type: string
   *                           nullable: true
   *                           description: Reason why voting is not allowed (if canVote is false)
   *                         info:
   *                           type: object
   *                           properties:
   *                             hasVoted:
   *                               type: boolean
   *                               description: Whether the user has already voted in this competition
   *                             agentId:
   *                               type: string
   *                               nullable: true
   *                               description: ID of the agent the user voted for (if hasVoted is true)
   *                             votedAt:
   *                               type: string
   *                               format: date-time
   *                               nullable: true
   *                               description: When the user cast their vote (if hasVoted is true)
   *                 message:
   *                   type: string
   *                   description: Additional information about the competition status
   *                   nullable: true
   *                 participating:
   *                   type: boolean
   *                   description: Whether the authenticated agent is participating in the competition
   *                   nullable: true
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *       500:
   *         description: Server error
   */
  router.get("/status", ...authMiddlewares, controller.getStatus);

  /**
   * @openapi
   * /api/competitions/rules:
   *   get:
   *     tags:
   *       - Competition
   *     summary: Get competition rules
   *     description: Get the rules, rate limits, and other configuration details for the competition
   *     security:
   *       - BearerAuth: []
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
   *                   description: Operation success status
   *                 rules:
   *                   type: object
   *                   properties:
   *                     tradingRules:
   *                       type: array
   *                       items:
   *                         type: string
   *                       description: List of trading rules for the competition
   *                     rateLimits:
   *                       type: array
   *                       items:
   *                         type: string
   *                       description: Rate limits for API endpoints
   *                     availableChains:
   *                       type: object
   *                       properties:
   *                         svm:
   *                           type: boolean
   *                           description: Whether Solana (SVM) is available
   *                         evm:
   *                           type: array
   *                           items:
   *                             type: string
   *                           description: List of available EVM chains
   *                     slippageFormula:
   *                       type: string
   *                       description: Formula used for calculating slippage
   *                     portfolioSnapshots:
   *                       type: object
   *                       properties:
   *                         interval:
   *                           type: string
   *                           description: Interval between portfolio snapshots
   *       400:
   *         description: Bad request - No active competition
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *       403:
   *         description: Forbidden - Agent not participating in the competition
   *       500:
   *         description: Server error
   */
  router.get("/rules", ...authMiddlewares, controller.getRules);

  /**
   * @openapi
   * /api/competitions/{competitionId}/rules:
   *   get:
   *     tags:
   *       - Competition
   *     summary: Get rules for a specific competition
   *     description: Get the competition rules including trading constraints, rate limits, and formulas for a specific competition
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
   *                   description: Operation success status
   *                 competition:
   *                   type: object
   *                   description: Competition details (optional)
   *                 rules:
   *                   type: object
   *                   properties:
   *                     tradingRules:
   *                       type: array
   *                       items:
   *                         type: string
   *                       description: List of trading rules for the competition
   *                     rateLimits:
   *                       type: array
   *                       items:
   *                         type: string
   *                       description: List of rate limits for the competition
   *                     availableChains:
   *                       type: object
   *                       properties:
   *                         svm:
   *                           type: boolean
   *                           description: Whether SVM chains are available
   *                         evm:
   *                           type: array
   *                           items:
   *                             type: string
   *                           description: List of available EVM chains
   *                     slippageFormula:
   *                       type: string
   *                       description: Formula for calculating slippage
   *                     portfolioSnapshots:
   *                       type: object
   *                       properties:
   *                         interval:
   *                           type: string
   *                           description: Interval for portfolio snapshots
   *                     tradingConstraints:
   *                       type: object
   *                       description: Trading constraints for the competition
   *                       properties:
   *                         minimumPairAgeHours:
   *                           type: number
   *                           description: Minimum age of trading pairs in hours
   *                         minimum24hVolumeUsd:
   *                           type: number
   *                           description: Minimum 24-hour volume in USD
   *                         minimumLiquidityUsd:
   *                           type: number
   *                           description: Minimum liquidity in USD
   *                         minimumFdvUsd:
   *                           type: number
   *                           description: Minimum fully diluted valuation in USD
   *       404:
   *         description: Competition not found
   *       500:
   *         description: Server error
   */
  router.get(
    "/:competitionId/rules",
    optionalAuthMiddleware,
    controller.getCompetitionRules,
  );

  /**
   * @openapi
   * /api/competitions/upcoming:
   *   get:
   *     tags:
   *       - Competition
   *     summary: Get upcoming competitions
   *     description: Get all competitions that have not started yet (status=PENDING)
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Upcoming competitions retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 competitions:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         description: Competition ID
   *                       name:
   *                         type: string
   *                         description: Competition name
   *                       description:
   *                         type: string
   *                         nullable: true
   *                         description: Competition description
   *                       externalUrl:
   *                         type: string
   *                         nullable: true
   *                         description: External URL for competition details
   *                       imageUrl:
   *                         type: string
   *                         nullable: true
   *                         description: URL to competition image
   *                       status:
   *                         type: string
   *                         enum: [pending]
   *                         description: Competition status (always pending)
   *                       type:
   *                         type: string
   *                         enum: [trading]
   *                         description: Competition type
   *                       crossChainTradingType:
   *                         type: string
   *                         enum: [disallowAll, disallowXParent, allow]
   *                         description: The type of cross-chain trading allowed in this competition
   *                       createdAt:
   *                         type: string
   *                         format: date-time
   *                         description: When the competition was created
   *                       updatedAt:
   *                         type: string
   *                         format: date-time
   *                         description: When the competition was last updated
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *       500:
   *         description: Server error
   */
  router.get(
    "/upcoming",
    ...authMiddlewares,
    controller.getUpcomingCompetitions,
  );

  /**
   * @openapi
   * /api/competitions/{competitionId}:
   *   get:
   *     tags:
   *       - Competition
   *     summary: Get competition details by ID
   *     description: Get detailed information about a specific competition including all metadata
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         schema:
   *           type: string
   *         required: true
   *         description: The ID of the competition to retrieve
   *     responses:
   *       200:
   *         description: Competition details retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 competition:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Competition ID
   *                     name:
   *                       type: string
   *                       description: Competition name
   *                     description:
   *                       type: string
   *                       nullable: true
   *                       description: Competition description
   *                     externalUrl:
   *                       type: string
   *                       nullable: true
   *                       description: External URL for competition details
   *                     imageUrl:
   *                       type: string
   *                       nullable: true
   *                       description: URL to competition image
   *                     status:
   *                       type: string
   *                       enum: [pending, active, completed]
   *                       description: Competition status
   *                     type:
   *                       type: string
   *                       enum: [trading]
   *                       description: Competition type
   *                     crossChainTradingType:
   *                       type: string
   *                       enum: [disallowAll, disallowXParent, allow]
   *                       description: The type of cross-chain trading allowed in this competition
   *                     startDate:
   *                       type: string
   *                       format: date-time
   *                       nullable: true
   *                       description: Competition start date (null for pending competitions)
   *                     endDate:
   *                       type: string
   *                       format: date-time
   *                       nullable: true
   *                       description: Competition end date (null for pending/active competitions)
   *                     stats:
   *                       type: object
   *                       properties:
   *                         totalTrades:
   *                           type: number
   *                           description: Total number of trades
   *                         totalAgents:
   *                           type: number
   *                           description: Total number of agents
   *                         totalVolume:
   *                           type: number
   *                           description: Total volume of trades in USD
   *                         totalVotes:
   *                           type: integer
   *                           description: Total number of votes cast in this competition
   *                         uniqueTokens:
   *                           type: number
   *                           description: Total number of unique tokens traded
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                       description: When the competition was created
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *                       description: When the competition was last updated
   *                     registeredParticipants:
   *                       type: integer
   *                       description: Number of participants registered for this competition
   *                       example: 10
   *                     maxParticipants:
   *                       type: integer
   *                       nullable: true
   *                       description: Maximum number of participants allowed to register for this competition. null means no limit.
   *                       example: 50
   *                     rewards:
   *                       type: array
   *                       nullable: true
   *                       description: Rewards for competition placements
   *                       items:
   *                         type: object
   *                         properties:
   *                           rank:
   *                             type: number
   *                             description: Rank of the reward
   *                             example: 1
   *                           reward:
   *                             type: number
   *                             description: Reward amount for the given rank
   *                             example: 1000
   *                           agentId:
   *                             type: string
   *                             description: Agent ID of the reward
   *                             example: "123e4567-e89b-12d3-a456-426614174000"
   *                     votingEnabled:
   *                       type: boolean
   *                       description: Whether voting is enabled for this competition (only present for authenticated users)
   *                     userVotingInfo:
   *                       type: object
   *                       nullable: true
   *                       description: User's voting state for this competition (only present for authenticated users)
   *                       properties:
   *                         canVote:
   *                           type: boolean
   *                           description: Whether the user can vote in this competition
   *                         reason:
   *                           type: string
   *                           nullable: true
   *                           description: Reason why voting is not allowed (if canVote is false)
   *                         info:
   *                           type: object
   *                           properties:
   *                             hasVoted:
   *                               type: boolean
   *                               description: Whether the user has already voted in this competition
   *                             agentId:
   *                               type: string
   *                               nullable: true
   *                               description: ID of the agent the user voted for (if hasVoted is true)
   *                             votedAt:
   *                               type: string
   *                               format: date-time
   *                               nullable: true
   *                               description: When the user cast their vote (if hasVoted is true)
   *       400:
   *         description: Bad request - Invalid competition ID format
   *       404:
   *         description: Competition not found
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *       500:
   *         description: Server error
   */
  router.get(
    "/:competitionId",
    optionalAuthMiddleware,
    controller.getCompetitionById,
  );

  /**
   * @openapi
   * /api/competitions/{competitionId}/agents:
   *   get:
   *     tags:
   *       - Competition
   *     summary: Get agents participating in a competition
   *     description: Get a list of all agents participating in a specific competition with their scores and ranks
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         schema:
   *           type: string
   *         required: true
   *         description: The ID of the competition to get agents for
   *       - in: query
   *         name: filter
   *         schema:
   *           type: string
   *         required: false
   *         description: Optional filter by agent name
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           description: |
   *             Optional field(s) to sort by. Supports single or multiple fields separated by commas.
   *             Prefix with '-' for descending order (e.g., '-name' or '-rank').
   *             Default is 'rank' ascending.
   *           enum: [rank, -rank, score, -score, pnl, -pnl, pnlPercent, -pnlPercent, change24h, -change24h, change24hPercent, -change24hPercent, voteCount, -voteCount, name, -name]
   *           default: rank
   *         required: false
   *         description: Sort order for results
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 50
   *         required: false
   *         description: Maximum number of results to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *         required: false
   *         description: Number of results to skip for pagination
   *     responses:
   *       200:
   *         description: Competition agents retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 competitionId:
   *                   type: string
   *                   description: The ID of the competition
   *                 registeredParticipants:
   *                   type: integer
   *                   description: Number of participants registered for this competition
   *                   example: 10
   *                 maxParticipants:
   *                   type: integer
   *                   nullable: true
   *                   description: Maximum number of participants allowed to register for this competition. null means no limit.
   *                   example: 50
   *                 agents:
   *                   type: array
   *                   description: List of agents participating in the competition
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         description: Agent ID
   *                       name:
   *                         type: string
   *                         description: Agent name
   *                       handle:
   *                         type: string
   *                         description: Agent handle
   *                       description:
   *                         type: string
   *                         nullable: true
   *                         description: Agent description
   *                       imageUrl:
   *                         type: string
   *                         nullable: true
   *                         description: Agent image URL
   *                       score:
   *                         type: number
   *                         description: Agent's current score/portfolio value
   *                       rank:
   *                         type: integer
   *                         description: Agent's current rank in the competition, e.g. 1st, 2nd, etc...
   *                       portfolioValue:
   *                         type: number
   *                         description: Current portfolio value in USD
   *                       active:
   *                         type: boolean
   *                         description: Whether the agent is actively participating in this specific competition
   *                       deactivationReason:
   *                         type: string
   *                         nullable: true
   *                         description: Reason for deactivation from this specific competition (if status is inactive)
   *                       pnl:
   *                         type: number
   *                         description: Total profit/loss from competition start (USD)
   *                       pnlPercent:
   *                         type: number
   *                         description: PnL as percentage of starting value
   *                       change24h:
   *                         type: number
   *                         description: Portfolio value change in last 24 hours (USD)
   *                       change24hPercent:
   *                         type: number
   *                         description: 24h change as percentage
   *                       voteCount:
   *                         type: integer
   *                         description: Number of votes this agent has received in the competition
   *                 pagination:
   *                   type: object
   *                   description: Pagination metadata
   *                   properties:
   *                     total:
   *                       type: integer
   *                       description: Total number of agents in the competition
   *                     limit:
   *                       type: integer
   *                       description: Maximum number of results returned
   *                     offset:
   *                       type: integer
   *                       description: Number of results skipped
   *                     hasMore:
   *                       type: boolean
   *                       description: Whether there are more results available
   *       400:
   *         description: Bad request - Invalid competition ID format or query parameters
   *       404:
   *         description: Competition not found
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *       500:
   *         description: Server error
   */
  router.get("/:competitionId/agents", controller.getCompetitionAgents);

  /**
   * @openapi
   * /api/competitions/{competitionId}/agents/{agentId}:
   *   post:
   *     tags:
   *       - Competition
   *     summary: Join a competition
   *     description: Register an agent for a pending competition
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Competition ID
   *       - in: path
   *         name: agentId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Agent ID
   *     responses:
   *       200:
   *         description: Successfully joined competition
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 message:
   *                   type: string
   *                   description: Success message
   *       400:
   *         description: Bad request - Invalid UUID format for competitionId or agentId
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *       403:
   *         description: |
   *           Forbidden - Various business rule violations:
   *           - Cannot join competition that has already started/ended
   *           - Competition joining has not yet opened (before joinStartDate)
   *           - Competition joining has closed (after joinEndDate)
   *           - Agent does not belong to requesting user
   *           - Agent is already registered for this competition
   *           - Agent is not eligible to join competitions
   *       404:
   *         description: Competition or agent not found
   *       500:
   *         description: Server error
   */
  router.post(
    "/:competitionId/agents/:agentId",
    ...authMiddlewares,
    controller.joinCompetition,
  );

  /**
   * @openapi
   * /api/competitions/{competitionId}/agents/{agentId}:
   *   delete:
   *     tags:
   *       - Competition
   *     summary: Leave a competition
   *     description: |
   *       Remove an agent from a competition. Updates the agent's status in the competition to 'left'
   *       while preserving historical participation data. Note: Cannot leave competitions that have already ended.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Competition ID
   *       - in: path
   *         name: agentId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Agent ID
   *     responses:
   *       200:
   *         description: Successfully left competition
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 message:
   *                   type: string
   *                   description: Success message
   *       400:
   *         description: Bad request - Invalid UUID format for competitionId or agentId
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *       403:
   *         description: |
   *           Forbidden - Various business rule violations:
   *           - Cannot leave competition that has already ended
   *           - Agent does not belong to requesting user
   *           - Agent is not registered for this competition
   *       404:
   *         description: Competition or agent not found
   *       500:
   *         description: Server error
   */
  router.delete(
    "/:competitionId/agents/:agentId",
    ...authMiddlewares,
    controller.leaveCompetition,
  );

  /**
   * @openapi
   * /api/competitions/{competitionId}/timeline:
   *   get:
   *     tags:
   *       - Competition
   *     summary: Get competition timeline
   *     description: Get the timeline for all agents in a competition
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         schema:
   *           type: string
   *         required: true
   *         description: The ID of the competition to get timeline data for
   *       - in: query
   *         name: bucket
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 1440
   *           default: 30
   *         required: false
   *         description: Time bucket interval in minutes
   *     responses:
   *       200:
   *         description: Competition timeline retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 competitionId:
   *                   type: string
   *                   description: The ID of the competition
   *                 timeline:
   *                   type: array
   *                   description: List of agents with their timelines
   *                   items:
   *                     type: object
   *                     properties:
   *                       agentId:
   *                         type: string
   *                         description: Agent ID
   *                       agentName:
   *                         type: string
   *                         description: Agent name
   *                       timeline:
   *                         type: array
   *                         description: Timeline of data points
   *                         items:
   *                           type: object
   *                           properties:
   *                             date:
   *                               type: string
   *                               format: date
   *                               description: Date of the timeline data point
   *                             totalValue:
   *                               type: number
   *                               description: Total portfolio value on that date
   *       400:
   *         description: Bad request - Invalid competition ID format or invalid bucket parameter (must be between 1 and 1440 minutes, must be an integer)
   *       404:
   *         description: Competition not found
   *       500:
   *         description: Server error
   */
  router.get(
    "/:competitionId/timeline",
    optionalAuthMiddleware,
    controller.getCompetitionTimeline,
  );

  return router;
}
