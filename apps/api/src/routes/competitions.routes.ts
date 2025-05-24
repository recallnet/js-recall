import { RequestHandler, Router } from "express";

import { CompetitionController } from "@/controllers/competition.controller.js";

export function configureCompetitionsRoutes(
  controller: CompetitionController,
  ...middlewares: RequestHandler[]
) {
  const router = Router();

  if (middlewares.length) {
    router.use(...middlewares);
  }

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
   *                       externalLink:
   *                         type: string
   *                         nullable: true
   *                         description: External URL for competition details
   *                       imageUrl:
   *                         type: string
   *                         nullable: true
   *                         description: URL to competition image
   *                       status:
   *                         type: string
   *                         enum: [PENDING]
   *                         description: Competition status (always PENDING)
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
  router.get("/", controller.getCompetitions);

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
   *                     externalLink:
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
   *                       enum: [PENDING, ACTIVE, COMPLETED]
   *                       description: Competition status
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
   *                   description: List of deactivated agents (excluded from ranking)
   *                   items:
   *                     type: object
   *                     properties:
   *                       agentId:
   *                         type: string
   *                         description: Agent ID
   *                       agentName:
   *                         type: string
   *                         description: Agent name
   *                       portfolioValue:
   *                         type: number
   *                         description: Current portfolio value in USD
   *                       active:
   *                         type: boolean
   *                         description: Always false for this array
   *                       deactivationReason:
   *                         type: string
   *                         description: Reason for agent deactivation
   *                 hasInactiveAgents:
   *                   type: boolean
   *                   description: Indicates if any agents are inactive
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
  router.get("/leaderboard", controller.getLeaderboard);

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
   *                     externalLink:
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
   *                       enum: [PENDING, ACTIVE, COMPLETED]
   *                       description: Competition status
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
  router.get("/status", controller.getStatus);

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
  router.get("/rules", controller.getRules);

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
   *                       externalLink:
   *                         type: string
   *                         nullable: true
   *                         description: External URL for competition details
   *                       imageUrl:
   *                         type: string
   *                         nullable: true
   *                         description: URL to competition image
   *                       status:
   *                         type: string
   *                         enum: [PENDING]
   *                         description: Competition status (always PENDING)
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
  router.get("/upcoming", controller.getUpcoming);

  return router;
}
