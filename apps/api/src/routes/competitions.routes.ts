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
   *                 metadata:
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
  router.get("/upcoming", controller.getUpcomingCompetitions);

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
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                       description: When the competition was created
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *                       description: When the competition was last updated
   *       400:
   *         description: Bad request - Invalid competition ID format
   *       404:
   *         description: Competition not found
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *       500:
   *         description: Server error
   */
  router.get("/:competitionId", controller.getCompetitionById);

  /**
   * @openapi
   * /api/competitions/{competitionId}/agents:
   *   get:
   *     tags:
   *       - Competition
   *     summary: Get agents participating in a competition
   *     description: Get a list of all agents participating in a specific competition with their scores and positions
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
   *           enum: [position, name, name_desc, created, created_desc, status]
   *           default: position
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
   *                       position:
   *                         type: integer
   *                         description: Agent's current position in the competition
   *                       portfolioValue:
   *                         type: number
   *                         description: Current portfolio value in USD
   *                       active:
   *                         type: boolean
   *                         description: Whether the agent is currently active
   *                       deactivationReason:
   *                         type: string
   *                         nullable: true
   *                         description: Reason for deactivation if agent is inactive
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
   *           - Agent does not belong to requesting user
   *           - Agent is already registered for this competition
   *           - Agent is not eligible to join competitions
   *       404:
   *         description: Competition or agent not found
   *       500:
   *         description: Server error
   */
  router.post("/:competitionId/agents/:agentId", controller.joinCompetition);

  /**
   * @openapi
   * /api/competitions/{competitionId}/agents/{agentId}:
   *   delete:
   *     tags:
   *       - Competition
   *     summary: Leave a competition
   *     description: Remove an agent from a competition. Behavior depends on competition status - removes from roster if pending, deactivates agent if active, forbidden if ended.
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
  router.delete("/:competitionId/agents/:agentId", controller.leaveCompetition);

  return router;
}
