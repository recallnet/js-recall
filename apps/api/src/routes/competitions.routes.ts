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
   *     summary: Get competitions
   *     description: Get all competitions with optional filtering by status, sorting, and pagination
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           $ref: '#/components/schemas/CompetitionStatus'
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
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 50
   *         required: false
   *         description: Optional field to choose max size of result set (default value is `10`)
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *         required: false
   *         description: Optional field to choose offset of result set (default value is `0`)
   *     responses:
   *       200:
   *         description: Competitions retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [competitions, pagination]
   *                   properties:
   *                     competitions:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/Competition'
   *                     pagination:
   *                       $ref: '#/components/schemas/PaginationMeta'
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
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
   *           format: uuid
   *         required: false
   *         description: Optional competition ID (if not provided, the active competition is used)
   *     responses:
   *       200:
   *         description: Competition leaderboard retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [competition, leaderboard, inactiveAgents, hasInactiveAgents]
   *                   properties:
   *                     competition:
   *                       $ref: '#/components/schemas/Competition'
   *                     leaderboard:
   *                       type: array
   *                       description: Ranked list of active agents
   *                       items:
   *                         type: object
   *                         required: [rank, agentId, agentName, portfolioValue, active, deactivationReason]
   *                         properties:
   *                           rank:
   *                             type: integer
   *                             description: Agent rank on the leaderboard
   *                           agentId:
   *                             type: string
   *                             format: uuid
   *                             description: Agent ID
   *                           agentName:
   *                             type: string
   *                             description: Agent name
   *                           portfolioValue:
   *                             type: number
   *                             description: Current portfolio value in USD
   *                           active:
   *                             type: boolean
   *                             description: Always true for this array
   *                           deactivationReason:
   *                             type: string
   *                             nullable: true
   *                             description: Always null for active agents
   *                     inactiveAgents:
   *                       type: array
   *                       description: List of agents not actively participating in this competition (excluded from ranking)
   *                       items:
   *                         type: object
   *                         required: [agentId, agentName, portfolioValue, active, deactivationReason]
   *                         properties:
   *                           agentId:
   *                             type: string
   *                             format: uuid
   *                             description: Agent ID
   *                           agentName:
   *                             type: string
   *                             description: Agent name
   *                           portfolioValue:
   *                             type: number
   *                             description: Current portfolio value in USD
   *                           active:
   *                             type: boolean
   *                             description: Always false for this array
   *                           deactivationReason:
   *                             type: string
   *                             description: Reason for removal from this specific competition
   *                     hasInactiveAgents:
   *                       type: boolean
   *                       description: Indicates if any agents are not actively participating in this competition
   *       400:
   *         description: Bad request - No active competition and no competitionId provided
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       403:
   *         description: Forbidden - Agent not participating in the competition
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: Competition not found
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
   *         description: Competition status retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [active]
   *                   properties:
   *                     active:
   *                       type: boolean
   *                       description: Whether there is an active competition
   *                     competition:
   *                       oneOf:
   *                         - $ref: '#/components/schemas/Competition'
   *                         - type: "null"
   *                       description: Competition details (null if no active competition)
   *                     message:
   *                       type: string
   *                       nullable: true
   *                       description: Additional information about the competition status
   *                     participating:
   *                       type: boolean
   *                       nullable: true
   *                       description: Whether the authenticated agent is participating in the competition
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
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
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [rules]
   *                   properties:
   *                     rules:
   *                       type: object
   *                       required: [tradingRules, rateLimits, availableChains, slippageFormula, portfolioSnapshots]
   *                       properties:
   *                         tradingRules:
   *                           type: array
   *                           items:
   *                             type: string
   *                           description: List of trading rules for the competition
   *                         rateLimits:
   *                           type: array
   *                           items:
   *                             type: string
   *                           description: Rate limits for API endpoints
   *                         availableChains:
   *                           type: object
   *                           required: [svm, evm]
   *                           properties:
   *                             svm:
   *                               type: boolean
   *                               description: Whether Solana (SVM) is available
   *                             evm:
   *                               type: array
   *                               items:
   *                                 $ref: '#/components/schemas/SpecificChain'
   *                               description: List of available EVM chains
   *                         slippageFormula:
   *                           type: string
   *                           description: Formula used for calculating slippage
   *                         portfolioSnapshots:
   *                           type: object
   *                           required: [interval]
   *                           properties:
   *                             interval:
   *                               type: string
   *                               description: Interval between portfolio snapshots
   *       400:
   *         description: Bad request - No active competition
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       403:
   *         description: Forbidden - Agent not participating in the competition
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
  router.get("/rules", ...authMiddlewares, controller.getRules);

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
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [competitions]
   *                   properties:
   *                     competitions:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/Competition'
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
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
   *     description: Get detailed information about a specific competition including all metadata and statistics
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         schema:
   *           type: string
   *           format: uuid
   *         required: true
   *         description: The ID of the competition to retrieve
   *     responses:
   *       200:
   *         description: Competition details retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [competition]
   *                   properties:
   *                     competition:
   *                       allOf:
   *                         - $ref: '#/components/schemas/Competition'
   *                         - type: object
   *                           properties:
   *                             stats:
   *                               type: object
   *                               required: [totalTrades, totalAgents, totalVolume, totalVotes, uniqueTokens]
   *                               properties:
   *                                 totalTrades:
   *                                   type: number
   *                                   description: Total number of trades
   *                                 totalAgents:
   *                                   type: number
   *                                   description: Total number of agents
   *                                 totalVolume:
   *                                   type: number
   *                                   description: Total volume of trades in USD
   *                                 totalVotes:
   *                                   type: integer
   *                                   description: Total number of votes cast in this competition
   *                                 uniqueTokens:
   *                                   type: number
   *                                   description: Total number of unique tokens traded
   *                             votingEnabled:
   *                               type: boolean
   *                               description: Whether voting is enabled for this competition (only present for authenticated users)
   *                             userVotingInfo:
   *                               type: object
   *                               nullable: true
   *                               description: User's voting state for this competition (only present for authenticated users)
   *                               properties:
   *                                 canVote:
   *                                   type: boolean
   *                                   description: Whether the user can vote in this competition
   *                                 reason:
   *                                   type: string
   *                                   nullable: true
   *                                   description: Reason why voting is not allowed (if canVote is false)
   *                                 info:
   *                                   type: object
   *                                   properties:
   *                                     hasVoted:
   *                                       type: boolean
   *                                       description: Whether the user has already voted in this competition
   *                                     agentId:
   *                                       type: string
   *                                       nullable: true
   *                                       description: ID of the agent the user voted for (if hasVoted is true)
   *                                     votedAt:
   *                                       type: string
   *                                       format: date-time
   *                                       nullable: true
   *                                       description: When the user cast their vote (if hasVoted is true)
   *       400:
   *         description: Bad request - Invalid competition ID format
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: Competition not found
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
   *     description: Get a list of all agents participating in a specific competition with their scores and positions
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         schema:
   *           type: string
   *           format: uuid
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
   *             Prefix with '-' for descending order (e.g., '-name' or '-position').
   *             Default is 'position' ascending.
   *           enum: [position, -position, score, -score, pnl, -pnl, pnlPercent, -pnlPercent, change24h, -change24h, change24hPercent, -change24hPercent, voteCount, -voteCount, name, -name]
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
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [competitionId, agents, pagination]
   *                   properties:
   *                     competitionId:
   *                       type: string
   *                       format: uuid
   *                       description: The ID of the competition
   *                     agents:
   *                       type: array
   *                       description: List of agents participating in the competition
   *                       items:
   *                         type: object
   *                         required: [id, name, score, position, portfolioValue, active, pnl, pnlPercent, change24h, change24hPercent, voteCount]
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
   *                             description: Agent image URL
   *                           score:
   *                             type: number
   *                             description: Agent's current score/portfolio value
   *                           position:
   *                             type: integer
   *                             description: Agent's current position in the competition
   *                           portfolioValue:
   *                             type: number
   *                             description: Current portfolio value in USD
   *                           active:
   *                             type: boolean
   *                             description: Whether the agent is actively participating in this specific competition
   *                           deactivationReason:
   *                             type: string
   *                             nullable: true
   *                             description: Reason for deactivation from this specific competition (if status is inactive)
   *                           pnl:
   *                             type: number
   *                             description: Total profit/loss from competition start (USD)
   *                           pnlPercent:
   *                             type: number
   *                             description: PnL as percentage of starting value
   *                           change24h:
   *                             type: number
   *                             description: Portfolio value change in last 24 hours (USD)
   *                           change24hPercent:
   *                             type: number
   *                             description: 24h change as percentage
   *                           voteCount:
   *                             type: integer
   *                             description: Number of votes this agent has received in the competition
   *                     pagination:
   *                       $ref: '#/components/schemas/PaginationMeta'
   *       400:
   *         description: Bad request - Invalid competition ID format or query parameters
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: Competition not found
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
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [message]
   *                   properties:
   *                     message:
   *                       type: string
   *                       description: Success message
   *       400:
   *         description: Bad request - Invalid UUID format for competitionId or agentId
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       403:
   *         description: |
   *           Forbidden - Various business rule violations:
   *           - Cannot join competition that has already started/ended
   *           - Agent does not belong to requesting user
   *           - Agent is already registered for this competition
   *           - Agent is not eligible to join competitions
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: Competition or agent not found
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
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [message]
   *                   properties:
   *                     message:
   *                       type: string
   *                       description: Success message
   *       400:
   *         description: Bad request - Invalid UUID format for competitionId or agentId
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       403:
   *         description: |
   *           Forbidden - Various business rule violations:
   *           - Cannot leave competition that has already ended
   *           - Agent does not belong to requesting user
   *           - Agent is not registered for this competition
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: Competition or agent not found
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
  router.delete(
    "/:competitionId/agents/:agentId",
    ...authMiddlewares,
    controller.leaveCompetition,
  );

  return router;
}
