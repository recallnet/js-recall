import { RequestHandler, Router } from "express";

import { BoostController } from "@/controllers/boost.controller.js";
import { CompetitionController } from "@/controllers/competition.controller.js";

export function configureCompetitionsRoutes(
  competitionController: CompetitionController,
  boostController: BoostController,
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
   *                         enum: [trading, perpetual_futures]
   *                         description: Competition type
   *                       crossChainTradingType:
   *                         type: string
   *                         enum: [disallowAll, disallowXParent, allow]
   *                         description: The type of cross-chain trading allowed in this competition
   *                       evaluationMetric:
   *                         type: string
   *                         enum: [calmar_ratio, sortino_ratio, simple_return, max_drawdown, total_pnl]
   *                         description: Primary evaluation metric for perps competitions (only present for perpetual_futures type)
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
   *                       tradingConstraints:
   *                         type: object
   *                         description: Trading constraints for the competition (only present for authenticated users)
   *                         properties:
   *                           minimumPairAgeHours:
   *                             type: number
   *                             nullable: true
   *                             description: Minimum age of trading pairs in hours
   *                           minimum24hVolumeUsd:
   *                             type: number
   *                             nullable: true
   *                             description: Minimum 24-hour volume in USD
   *                           minimumLiquidityUsd:
   *                             type: number
   *                             nullable: true
   *                             description: Minimum liquidity in USD
   *                           minimumFdvUsd:
   *                             type: number
   *                             nullable: true
   *                             description: Minimum fully diluted valuation in USD
   *                           minTradesPerDay:
   *                             type: number
   *                             nullable: true
   *                             description: Minimum number of trades required per day (null if no requirement)
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
  router.get(
    "/",
    optionalAuthMiddleware,
    competitionController.getCompetitions,
  );

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
   *                         minTradesPerDay:
   *                           type: number
   *                           nullable: true
   *                           description: Minimum number of trades required per day (null if no requirement)
   *       404:
   *         description: Competition not found
   *       500:
   *         description: Server error
   */
  router.get(
    "/:competitionId/rules",
    optionalAuthMiddleware,
    competitionController.getCompetitionRules,
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
   *                       enum: [trading, perpetual_futures]
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
   *                       description: Competition statistics (fields vary by competition type)
   *                       properties:
   *                         competitionType:
   *                           type: string
   *                           enum: ["trading", "perpetual_futures"]
   *                           description: Type of competition determining which metrics are available
   *                         totalTrades:
   *                           type: number
   *                           description: Total number of trades (only for paper trading competitions)
   *                         totalPositions:
   *                           type: number
   *                           description: Total number of positions (only for perpetual futures competitions)
   *                         totalAgents:
   *                           type: number
   *                           description: Total number of agents
   *                         totalVolume:
   *                           type: number
   *                           description: Total volume in USD
   *                         uniqueTokens:
   *                           type: number
   *                           description: Total number of unique tokens traded (only for paper trading competitions)
   *                         averageEquity:
   *                           type: number
   *                           description: Average equity across all agents (only for perpetual futures competitions)
   *                     evaluationMetric:
   *                       type: string
   *                       enum: [calmar_ratio, sortino_ratio, simple_return, max_drawdown, total_pnl]
   *                       description: Primary evaluation metric for perps competitions (only present for perpetual_futures type)
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
   *                         minTradesPerDay:
   *                           type: number
   *                           nullable: true
   *                           description: Minimum number of trades required per day (null if no requirement)
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
    competitionController.getCompetitionById,
  );

  router.get(
    "/:competitionId/boost",
    ...authMiddlewares,
    boostController.getBoostBalance,
  );

  router.get(
    "/:competitionId/boosts",
    ...authMiddlewares,
    boostController.boostsForCompetition,
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
   *           enum: [rank, -rank, score, -score, pnl, -pnl, pnlPercent, -pnlPercent, change24h, -change24h, change24hPercent, -change24hPercent, calmarRatio, -calmarRatio, simpleReturn, -simpleReturn, maxDrawdown, -maxDrawdown, portfolioValue, -portfolioValue, id, -id, ownerId, -ownerId, walletAddress, -walletAddress, handle, -handle, status, -status, createdAt, -createdAt, updatedAt, -updatedAt, name, -name]
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
   *                       calmarRatio:
   *                         type: number
   *                         nullable: true
   *                         description: Risk-adjusted performance metric (Annualized Return / Max Drawdown) - only for perps competitions
   *                       sortinoRatio:
   *                         type: number
   *                         nullable: true
   *                         description: Risk-adjusted performance metric (Return / Downside Deviation) - only for perps competitions
   *                       simpleReturn:
   *                         type: number
   *                         nullable: true
   *                         description: Simple return (end value / start value - 1) - only for perps competitions
   *                       maxDrawdown:
   *                         type: number
   *                         nullable: true
   *                         description: Maximum observed loss from peak (negative value) - only for perps competitions
   *                       downsideDeviation:
   *                         type: number
   *                         nullable: true
   *                         description: Standard deviation of negative returns - only for perps competitions
   *                       hasRiskMetrics:
   *                         type: boolean
   *                         description: Whether risk metrics are available for this agent (perps only, requires 2+ snapshots)
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
  router.get(
    "/:competitionId/agents",
    competitionController.getCompetitionAgents,
  );

  router.get("/:competitionId/agents/boosts", boostController.agentBoostTotals);

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
    competitionController.joinCompetition,
  );

  router.post(
    "/:competitionId/agents/:agentId/boost",
    ...authMiddlewares,
    boostController.boostAgent,
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
    competitionController.leaveCompetition,
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
   *                             calmarRatio:
   *                               type: number
   *                               nullable: true
   *                               description: Calmar ratio at this point (perps competitions only)
   *                             sortinoRatio:
   *                               type: number
   *                               nullable: true
   *                               description: Sortino ratio at this point (perps competitions only)
   *                             maxDrawdown:
   *                               type: number
   *                               nullable: true
   *                               description: Maximum drawdown at this point (perps competitions only)
   *                             downsideDeviation:
   *                               type: number
   *                               nullable: true
   *                               description: Downside deviation at this point (perps competitions only)
   *                             simpleReturn:
   *                               type: number
   *                               nullable: true
   *                               description: Simple return at this point (perps competitions only)
   *                             annualizedReturn:
   *                               type: number
   *                               nullable: true
   *                               description: Annualized return at this point (perps competitions only)
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
    competitionController.getCompetitionTimeline,
  );

  /**
   * @openapi
   * /api/competitions/{competitionId}/trades:
   *   get:
   *     tags:
   *       - Competition
   *     summary: Get trades for a competition (Paper Trading Only)
   *     description: Get all trades for a specific competition. Only available for paper trading competitions.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         schema:
   *           type: string
   *         required: true
   *         description: The ID of the competition to get trades for
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
   *         description: Competition trades retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 trades:
   *                   type: array
   *                   description: List of trades in the competition
   *                   items:
   *                     type: object
   *       400:
   *         description: Bad request - Invalid competition ID format or endpoint not available for perpetual futures competitions
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
   *                   example: "This endpoint is not available for perpetual futures competitions. Use GET /api/competitions/{id}/perps/all-positions for perps positions."
   *       404:
   *         description: Competition not found
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *       500:
   *         description: Server error
   */
  router.get(
    "/:competitionId/trades",
    ...authMiddlewares,
    competitionController.getCompetitionTrades,
  );

  /**
   * @openapi
   * /api/competitions/{competitionId}/agents/{agentId}/trades:
   *   get:
   *     tags:
   *       - Competition
   *     summary: Get trades for an agent in a competition (Paper Trading Only)
   *     description: Get all trades for a specific agent in a specific competition. Only available for paper trading competitions.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         schema:
   *           type: string
   *         required: true
   *         description: The ID of the competition
   *       - in: path
   *         name: agentId
   *         schema:
   *           type: string
   *         required: true
   *         description: The ID of the agent
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
   *         description: Agent trades retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 trades:
   *                   type: array
   *                   description: List of trades by the agent in the competition
   *                   items:
   *                     type: object
   *       400:
   *         description: Bad request - Invalid ID format or endpoint not available for perpetual futures competitions
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
   *                   example: "This endpoint is not available for perpetual futures competitions. Use GET /api/competitions/{id}/agents/{agentId}/perps/positions for agent positions."
   *       404:
   *         description: Competition or agent not found
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *       500:
   *         description: Server error
   */
  router.get(
    "/:competitionId/agents/:agentId/trades",
    ...authMiddlewares,
    competitionController.getAgentTradesInCompetition,
  );

  /**
   * @openapi
   * /api/competitions/{competitionId}/agents/{agentId}/perps/positions:
   *   get:
   *     tags:
   *       - Competitions
   *     summary: Get perps positions for an agent in a competition
   *     description: |
   *       Returns the current perpetual futures positions for a specific agent in a specific competition.
   *       This endpoint is only available for perpetual futures competitions.
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
   *         description: Successfully retrieved perps positions
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 competitionId:
   *                   type: string
   *                   format: uuid
   *                 agentId:
   *                   type: string
   *                   format: uuid
   *                 positions:
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
   *                       positionId:
   *                         type: string
   *                         nullable: true
   *                         description: Provider-specific position ID
   *                       marketId:
   *                         type: string
   *                         nullable: true
   *                         description: Market identifier
   *                       marketSymbol:
   *                         type: string
   *                         nullable: true
   *                         example: "BTC"
   *                       asset:
   *                         type: string
   *                         description: Asset symbol
   *                         example: "BTC"
   *                       isLong:
   *                         type: boolean
   *                         description: Whether position is long (true) or short (false)
   *                         example: true
   *                       leverage:
   *                         type: number
   *                         description: Position leverage
   *                         example: 10
   *                       size:
   *                         type: number
   *                         description: Position size
   *                         example: 0.5
   *                       collateral:
   *                         type: number
   *                         description: Collateral/margin amount
   *                         example: 2250
   *                       averagePrice:
   *                         type: number
   *                         description: Average entry price
   *                         example: 45000
   *                       markPrice:
   *                         type: number
   *                         description: Current mark price
   *                         example: 46000
   *                       liquidationPrice:
   *                         type: number
   *                         nullable: true
   *                         description: Liquidation price
   *                         example: 40000
   *                       unrealizedPnl:
   *                         type: number
   *                         description: Unrealized PnL
   *                         example: 500
   *                       pnlPercentage:
   *                         type: number
   *                         description: PnL as percentage of collateral (from Symphony)
   *                         example: 0.05
   *                       realizedPnl:
   *                         type: number
   *                         description: Realized PnL (always 0 in current implementation)
   *                         example: 0
   *                       status:
   *                         type: string
   *                         description: Position status
   *                         example: "Open"
   *                       openedAt:
   *                         type: string
   *                         format: date-time
   *                         description: Position open timestamp
   *                       closedAt:
   *                         type: string
   *                         format: date-time
   *                         nullable: true
   *                         description: Position close timestamp (null if open)
   *                       timestamp:
   *                         type: string
   *                         format: date-time
   *                         description: Last update timestamp
   *       400:
   *         description: Bad request - Not a perpetual futures competition
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
   *                   example: "This endpoint is only available for perpetual futures competitions. Use GET /api/competitions/{id}/agents/{agentId}/trades for paper trading competitions."
   *       404:
   *         description: Competition, agent, or participation not found
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
   *                   example: "Competition not found"
   *       500:
   *         description: Server error
   */
  router.get(
    "/:competitionId/agents/:agentId/perps/positions",
    ...authMiddlewares,
    competitionController.getAgentPerpsPositionsInCompetition,
  );

  /**
   * @openapi
   * /api/competitions/{competitionId}/perps/all-positions:
   *   get:
   *     tags:
   *       - Competitions
   *     summary: Get all perps positions for a competition
   *     description: |
   *       Returns all perpetual futures positions for a competition with pagination support.
   *       Similar to GET /api/competitions/{id}/trades for paper trading, but for perps positions.
   *       By default returns only open positions. Use status query param to filter.
   *       Includes embedded agent information for each position.
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The competition ID
   *       - in: query
   *         name: status
   *         required: false
   *         schema:
   *           type: string
   *           enum: [Open, Closed, Liquidated, all]
   *           default: Open
   *         description: Filter positions by status. Use "all" to get all positions regardless of status
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 10
   *         description: Number of positions to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *         description: Number of positions to skip
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           default: ""
   *         description: Sort order (currently unused but included for consistency)
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of positions with pagination info
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 positions:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         format: uuid
   *                       competitionId:
   *                         type: string
   *                         format: uuid
   *                       agentId:
   *                         type: string
   *                         format: uuid
   *                       agent:
   *                         type: object
   *                         properties:
   *                           id:
   *                             type: string
   *                             format: uuid
   *                           name:
   *                             type: string
   *                           imageUrl:
   *                             type: string
   *                             nullable: true
   *                           description:
   *                             type: string
   *                             nullable: true
   *                       positionId:
   *                         type: string
   *                         nullable: true
   *                         description: Provider-specific position ID
   *                       marketId:
   *                         type: string
   *                         nullable: true
   *                         description: Market identifier (currently same as asset)
   *                       marketSymbol:
   *                         type: string
   *                         nullable: true
   *                         description: Market symbol (currently same as asset)
   *                       asset:
   *                         type: string
   *                         example: "BTC"
   *                       isLong:
   *                         type: boolean
   *                       leverage:
   *                         type: number
   *                         example: 10
   *                       size:
   *                         type: number
   *                         example: 0.5
   *                       collateral:
   *                         type: number
   *                         example: 1000
   *                       averagePrice:
   *                         type: number
   *                         example: 50000
   *                       markPrice:
   *                         type: number
   *                         example: 51000
   *                       liquidationPrice:
   *                         type: number
   *                         nullable: true
   *                         example: 45000
   *                       unrealizedPnl:
   *                         type: number
   *                         example: 500
   *                       pnlPercentage:
   *                         type: number
   *                         description: PnL as percentage of collateral (from Symphony)
   *                         example: 0.05
   *                       realizedPnl:
   *                         type: number
   *                         example: 0
   *                       status:
   *                         type: string
   *                         example: "Open"
   *                       openedAt:
   *                         type: string
   *                         format: date-time
   *                       closedAt:
   *                         type: string
   *                         format: date-time
   *                         nullable: true
   *                       timestamp:
   *                         type: string
   *                         format: date-time
   *                 pagination:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: integer
   *                       example: 250
   *                     limit:
   *                       type: integer
   *                       example: 10
   *                     offset:
   *                       type: integer
   *                       example: 0
   *                     hasMore:
   *                       type: boolean
   *                       example: true
   *       400:
   *         description: Competition is not a perpetual futures competition
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
   *                   example: "This endpoint is only available for perpetual futures competitions. Use GET /api/competitions/{id}/trades for paper trading competitions."
   *       404:
   *         description: Competition not found
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
   *                   example: "Competition not found"
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *       500:
   *         description: Server error
   */
  router.get(
    "/:competitionId/perps/all-positions",
    ...authMiddlewares,
    competitionController.getCompetitionPerpsPositions,
  );

  return router;
}
