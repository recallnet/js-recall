import { RequestHandler, Router } from "express";

import { AdminController } from "@/controllers/admin.controller.js";

export function configureAdminRoutes(
  controller: AdminController,
  ...middlewares: RequestHandler[]
) {
  const router = Router();

  if (middlewares.length) {
    router.use(...middlewares);
  }

  /**
   * @openapi
   * /api/admin/competition/create:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Create a competition
   *     description: Create a new competition without starting it. It will be in PENDING status and can be started later.
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *             properties:
   *               name:
   *                 type: string
   *                 description: Competition name
   *                 example: Spring 2023 Trading Competition
   *               description:
   *                 type: string
   *                 description: Competition description
   *                 example: A trading competition for the spring semester
   *               tradingType:
   *                 type: string
   *                 description: The type of cross-chain trading to allow in this competition
   *                 enum: [disallowAll, disallowXParent, allow]
   *                 default: disallowAll
   *                 example: disallowAll
   *               sandboxMode:
   *                 type: boolean
   *                 description: Enable sandbox mode to automatically join newly registered agents to this competition
   *                 default: false
   *                 example: false
   *               type:
   *                 type: string
   *                 description: The type of competition
   *                 enum: [trading]
   *                 default: trading
   *                 example: trading
   *               externalUrl:
   *                 type: string
   *                 description: External URL for competition details
   *                 example: https://example.com/competition-details
   *               imageUrl:
   *                 type: string
   *                 description: URL to competition image
   *                 example: https://example.com/competition-image.jpg
   *               endDate:
   *                 type: string
   *                 format: date-time
   *                 description: End date for the competition (ISO 8601 format)
   *                 example: "2024-02-15T23:59:59Z"
   *               votingStartDate:
   *                 type: string
   *                 format: date-time
   *                 description: Start date for voting (ISO 8601 format)
   *                 example: "2024-01-15T00:00:00Z"
   *               votingEndDate:
   *                 type: string
   *                 format: date-time
   *                 description: End date for voting (ISO 8601 format)
   *                 example: "2024-01-30T23:59:59Z"
   *               joinStartDate:
   *                 type: string
   *                 format: date-time
   *                 description: Start date for joining the competition (ISO 8601 format). Must be before or equal to joinEndDate if both are provided.
   *                 example: "2024-01-01T00:00:00Z"
   *               joinEndDate:
   *                 type: string
   *                 format: date-time
   *                 description: End date for joining the competition (ISO 8601 format). Must be after or equal to joinStartDate if both are provided.
   *                 example: "2024-01-14T23:59:59Z"
   *     responses:
   *       201:
   *         description: Competition created successfully
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
   *                       description: Competition description
   *                     status:
   *                       type: string
   *                       enum: [pending, active, completed]
   *                       description: Competition status
   *                     externalUrl:
   *                       type: string
   *                       description: External URL for competition details
   *                       nullable: true
   *                     imageUrl:
   *                       type: string
   *                       description: URL to competition image
   *                       nullable: true
   *                     crossChainTradingType:
   *                       type: string
   *                       enum: [disallowAll, disallowXParent, allow]
   *                       description: The type of cross-chain trading allowed in this competition
   *                     sandboxMode:
   *                       type: boolean
   *                       description: Whether sandbox mode is enabled for this competition
   *                     type:
   *                       type: string
   *                       enum: [trading]
   *                       default: trading
   *                       description: The type of competition
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                       description: Competition creation date
   *       400:
   *         description: |-
   *           Bad Request - Various validation errors:
   *           - Missing required parameters
   *           - joinStartDate must be before or equal to joinEndDate
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       500:
   *         description: Server error
   */
  router.post("/competition/create", controller.createCompetition);

  /**
   * @openapi
   * /api/admin/competition/start:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Start a competition
   *     description: Start a new or existing competition with specified agents. If competitionId is provided, it will start an existing competition. Otherwise, it will create and start a new one.
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - agentIds
   *             properties:
   *               competitionId:
   *                 type: string
   *                 description: ID of an existing competition to start. If not provided, a new competition will be created.
   *               name:
   *                 type: string
   *                 description: Competition name (required when creating a new competition)
   *                 example: Spring 2023 Trading Competition
   *               description:
   *                 type: string
   *                 description: Competition description (used when creating a new competition)
   *                 example: A trading competition for the spring semester
   *               externalUrl:
   *                 type: string
   *                 description: External URL for competition details (used when creating a new competition)
   *                 example: https://example.com/competition-details
   *               imageUrl:
   *                 type: string
   *                 description: URL to competition image (used when creating a new competition)
   *                 example: https://example.com/competition-image.jpg
   *               endDate:
   *                 type: string
   *                 format: date-time
   *                 description: End date for the competition (ISO 8601 format)
   *                 example: "2024-02-15T23:59:59Z"
   *               votingStartDate:
   *                 type: string
   *                 format: date-time
   *                 description: Start date for voting (ISO 8601 format, used when creating a new competition)
   *                 example: "2024-01-15T00:00:00Z"
   *               votingEndDate:
   *                 type: string
   *                 format: date-time
   *                 description: End date for voting (ISO 8601 format, used when creating a new competition)
   *                 example: "2024-01-30T23:59:59Z"
   *               agentIds:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Array of agent IDs to include in the competition
   *               tradingType:
   *                 type: string
   *                 description: Type of cross-chain trading to allow in this competition (used when creating a new competition)
   *                 enum: [disallowAll, disallowXParent, allow]
   *                 default: disallowAll
   *                 example: disallowAll
   *               sandboxMode:
   *                 type: boolean
   *                 description: Enable sandbox mode to automatically join newly registered agents to this competition (used when creating a new competition)
   *                 default: false
   *                 example: false
   *               type:
   *                 type: string
   *                 description: The type of competition
   *                 enum: [trading]
   *                 default: trading
   *                 example: trading
   *               tradingConstraints:
   *                 type: object
   *                 description: Trading constraints for the competition (used when creating a new competition)
   *                 properties:
   *                   minimumPairAgeHours:
   *                     type: number
   *                     minimum: 0
   *                     description: Minimum age of trading pairs in hours
   *                     example: 168
   *                   minimum24hVolumeUsd:
   *                     type: number
   *                     minimum: 0
   *                     description: Minimum 24-hour volume in USD
   *                     example: 10000
   *                   minimumLiquidityUsd:
   *                     type: number
   *                     minimum: 0
   *                     description: Minimum liquidity in USD
   *                     example: 100000
   *                   minimumFdvUsd:
   *                     type: number
   *                     minimum: 0
   *                     description: Minimum fully diluted valuation in USD
   *                     example: 100000
   *     responses:
   *       200:
   *         description: Competition started successfully
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
   *                       description: Competition description
   *                     startDate:
   *                       type: string
   *                       format: date-time
   *                       description: Competition start date
   *                     endDate:
   *                       type: string
   *                       format: date-time
   *                       nullable: true
   *                       description: Competition end date (null if not ended)
   *                     externalUrl:
   *                       type: string
   *                       description: External URL for competition details
   *                       nullable: true
   *                     imageUrl:
   *                       type: string
   *                       description: URL to competition image
   *                       nullable: true
   *                     status:
   *                       type: string
   *                       enum: [pending, active, completed]
   *                       description: Competition status
   *                     crossChainTradingType:
   *                       type: string
   *                       enum: [disallowAll, disallowXParent, allow]
   *                       description: Type of cross-chain trading allowed in this competition
   *                     sandboxMode:
   *                       type: boolean
   *                       description: Whether sandbox mode is enabled for this competition
   *                     type:
   *                       type: string
   *                       enum: [trading]
   *                       description: The type of competition
   *                     agentIds:
   *                       type: array
   *                       items:
   *                         type: string
   *                       description: Agent IDs participating in the competition
   *                 initializedAgents:
   *                   type: array
   *                   items:
   *                     type: string
   *                   description: Agent IDs that were successfully initialized for the competition
   *       400:
   *         description: Missing required parameters
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Competition not found when using competitionId
   *       500:
   *         description: Server error
   */
  router.post("/competition/start", controller.startCompetition);

  /**
   * @openapi
   * /api/admin/competition/end:
   *   post:
   *     tags:
   *       - Admin
   *     summary: End a competition
   *     description: End an active competition and finalize the results
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - competitionId
   *             properties:
   *               competitionId:
   *                 type: string
   *                 description: ID of the competition to end
   *     responses:
   *       200:
   *         description: Competition ended successfully
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
   *                       description: Competition description
   *                     startDate:
   *                       type: string
   *                       format: date-time
   *                       description: Competition start date
   *                     endDate:
   *                       type: string
   *                       format: date-time
   *                       description: Competition end date
   *                     externalUrl:
   *                       type: string
   *                       description: External URL for competition details
   *                       nullable: true
   *                     imageUrl:
   *                       type: string
   *                       description: URL to competition image
   *                       nullable: true
   *                     status:
   *                       type: string
   *                       enum: [pending, active, completed]
   *                       description: Competition status (completed)
   *                     crossChainTradingType:
   *                       type: string
   *                       enum: [disallowAll, disallowXParent, allow]
   *                       description: Type of cross-chain trading allowed in this competition
   *                     type:
   *                       type: string
   *                       enum: [trading]
   *                       description: The type of competition
   *                 leaderboard:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       agentId:
   *                         type: string
   *                         description: Agent ID
   *                       value:
   *                         type: number
   *                         description: Final portfolio value
   *       400:
   *         description: Missing competitionId parameter
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Competition not found
   *       500:
   *         description: Server error
   */
  router.post("/competition/end", controller.endCompetition);

  /**
   * @openapi
   * /api/admin/competition/{competitionId}:
   *   put:
   *     tags:
   *       - Admin
   *     summary: Update a competition
   *     description: Update competition fields (excludes startDate, endDate, status)
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the competition to update
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 description: Competition name
   *                 example: Updated Spring 2023 Trading Competition
   *               description:
   *                 type: string
   *                 description: Competition description
   *                 example: An updated trading competition for the spring semester
   *               type:
   *                 type: string
   *                 description: The type of competition
   *                 enum: [trading]
   *                 example: trading
   *               externalUrl:
   *                 type: string
   *                 description: External URL for competition details
   *                 example: https://example.com/competition
   *               imageUrl:
   *                 type: string
   *                 description: URL to competition image
   *                 example: https://example.com/image.jpg
   *               votingStartDate:
   *                 type: string
   *                 format: date-time
   *                 description: Voting start date
   *                 example: 2023-05-01T00:00:00Z
   *               votingEndDate:
   *                 type: string
   *                 format: date-time
   *                 description: Voting end date
   *                 example: 2023-05-07T23:59:59Z
   *     responses:
   *       200:
   *         description: Competition updated successfully
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
   *                       description: Competition description
   *                     type:
   *                       type: string
   *                       enum: [trading]
   *                       description: The type of competition
   *                     externalUrl:
   *                       type: string
   *                       description: External URL for competition details
   *                       nullable: true
   *                     imageUrl:
   *                       type: string
   *                       description: URL to competition image
   *                       nullable: true
   *                     startDate:
   *                       type: string
   *                       format: date-time
   *                       description: Competition start date
   *                       nullable: true
   *                     endDate:
   *                       type: string
   *                       format: date-time
   *                       description: Competition end date
   *                       nullable: true
   *                     votingStartDate:
   *                       type: string
   *                       format: date-time
   *                       description: Voting start date
   *                       nullable: true
   *                     votingEndDate:
   *                       type: string
   *                       format: date-time
   *                       description: Voting end date
   *                       nullable: true
   *                     status:
   *                       type: string
   *                       enum: [pending, active, ended]
   *                       description: Competition status
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                       description: Competition creation date
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *                       description: Competition last update date
   *       400:
   *         description: Bad request - Missing competitionId, no valid fields provided, or attempting to update restricted fields (startDate, endDate, status)
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Competition not found
   *       500:
   *         description: Server error
   */
  router.put("/competition/:competitionId", controller.updateCompetition);

  /**
   * @openapi
   * /api/admin/competition/{competitionId}/snapshots:
   *   get:
   *     tags:
   *       - Admin
   *     summary: Get competition snapshots
   *     description: Get portfolio snapshots for a competition, optionally filtered by agent
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the competition
   *       - in: query
   *         name: agentId
   *         schema:
   *           type: string
   *         required: false
   *         description: Optional agent ID to filter snapshots
   *     responses:
   *       200:
   *         description: Competition snapshots
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 snapshots:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         description: Snapshot ID
   *                       competitionId:
   *                         type: string
   *                         description: Competition ID
   *                       agentId:
   *                         type: string
   *                         description: Agent ID
   *                       totalValue:
   *                         type: number
   *                         description: Total portfolio value at snapshot time
   *                       timestamp:
   *                         type: string
   *                         format: date-time
   *                         description: Snapshot timestamp
   *       400:
   *         description: Missing competitionId or agent not in competition
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Competition or agent not found
   *       500:
   *         description: Server error
   */
  router.get(
    "/competition/:competitionId/snapshots",
    controller.getCompetitionSnapshots,
  );

  /**
   * @openapi
   * /api/admin/reports/performance:
   *   get:
   *     tags:
   *       - Admin
   *     summary: Get performance reports
   *     description: Get performance reports and leaderboard for a competition
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: competitionId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the competition
   *     responses:
   *       200:
   *         description: Performance reports
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
   *                       description: Competition description
   *                     startDate:
   *                       type: string
   *                       format: date-time
   *                       description: Competition start date
   *                     endDate:
   *                       type: string
   *                       format: date-time
   *                       nullable: true
   *                       description: Competition end date
   *                     externalUrl:
   *                       type: string
   *                       description: External URL for competition details
   *                       nullable: true
   *                     imageUrl:
   *                       type: string
   *                       description: URL to competition image
   *                       nullable: true
   *                     status:
   *                       type: string
   *                       enum: [pending, active, completed]
   *                       description: Competition status
   *                     crossChainTradingType:
   *                       type: string
   *                       enum: [disallowAll, disallowXParent, allow]
   *                       description: Type of cross-chain trading allowed in this competition
   *                     type:
   *                       type: string
   *                       enum: [trading]
   *                       description: The type of competition
   *                 leaderboard:
   *                   type: array
   *                   description: Ranked list of active agents
   *                   items:
   *                     type: object
   *                     properties:
   *                       rank:
   *                         type: integer
   *                         description: Agent rank on the leaderboard, e.g. 1st, 2nd, etc..
   *                       agentId:
   *                         type: string
   *                         description: Agent ID
   *                       agentName:
   *                         type: string
   *                         description: Agent name
   *                       portfolioValue:
   *                         type: number
   *                         description: Portfolio value
   *       400:
   *         description: Missing competitionId parameter
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Competition not found
   *       500:
   *         description: Server error
   */
  router.get("/reports/performance", controller.getPerformanceReports);

  /**
   * @openapi
   * /api/admin/users:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Register a new user
   *     description: Admin-only endpoint to register a new user and optionally create their first agent. Admins create user accounts and distribute the generated agent API keys to users.
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - walletAddress
   *             properties:
   *               walletAddress:
   *                 type: string
   *                 description: Ethereum wallet address (must start with 0x)
   *                 example: 0x1234567890123456789012345678901234567890
   *               name:
   *                 type: string
   *                 description: User's display name
   *                 example: John Doe
   *               email:
   *                 type: string
   *                 format: email
   *                 description: User email address
   *                 example: user@example.com
   *               userImageUrl:
   *                 type: string
   *                 description: URL to the user's profile image
   *                 example: "https://example.com/user-image.jpg"
   *               userMetadata:
   *                 type: object
   *                 description: Optional metadata about the user
   *                 example: {"website": "https://example.com"}
   *               agentName:
   *                 type: string
   *                 description: Name for the user's first agent (optional)
   *                 example: Trading Bot Alpha
   *               agentDescription:
   *                 type: string
   *                 description: Description of the agent (optional)
   *                 example: High-frequency trading bot specializing in DeFi
   *               agentImageUrl:
   *                 type: string
   *                 description: URL to the agent's image (optional)
   *                 example: "https://example.com/agent-image.jpg"
   *               agentMetadata:
   *                 type: object
   *                 description: Optional metadata about the agent
   *                 example: {
   *                     "ref": {
   *                       "name": "ksobot",
   *                       "version": "1.0.0",
   *                       "url": "github.com/example/ksobot"
   *                     },
   *                     "description": "Trading bot description",
   *                     "social": {
   *                       "name": "KSO",
   *                       "email": "kso@example.com",
   *                       "twitter": "hey_kso"
   *                     }
   *                   }
   *               agentWalletAddress:
   *                 type: string
   *                 description: Ethereum wallet address (must start with 0x)
   *                 example: 0x1234567890123456789012345678901234567890
   *     responses:
   *       201:
   *         description: User registered successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 user:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: User ID
   *                     walletAddress:
   *                       type: string
   *                       description: User wallet address
   *                     name:
   *                       type: string
   *                       description: User name
   *                     email:
   *                       type: string
   *                       description: User email
   *                     imageUrl:
   *                       type: string
   *                       description: URL to user's image
   *                       nullable: true
   *                     metadata:
   *                       type: object
   *                       description: Optional metadata for the user
   *                       example: { "custom": {"value": "here"} }
   *                       nullable: true
   *                     status:
   *                       type: string
   *                       description: User status
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                       description: Account creation timestamp
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *                       description: Account updated timestamp
   *                 agent:
   *                   type: object
   *                   nullable: true
   *                   description: Created agent (if agentName was provided)
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Agent ID
   *                     ownerId:
   *                       type: string
   *                       description: Agent owner ID
   *                     walletAddress:
   *                       type: string
   *                       description: Agent wallet address
   *                       nullable: true
   *                     name:
   *                       type: string
   *                       description: Agent name
   *                     email:
   *                       type: string
   *                       description: Agent email
   *                       nullable: true
   *                     description:
   *                       type: string
   *                       description: Agent description
   *                       nullable: true
   *                     imageUrl:
   *                       type: string
   *                       description: URL to agent's image
   *                       nullable: true
   *                     metadata:
   *                       type: object
   *                       description: Optional metadata for the agent
   *                       example: { "strategy": "yield-farming", "risk": "medium" }
   *                       nullable: true
   *                     apiKey:
   *                       type: string
   *                       description: API key for the agent to use with Bearer authentication. Admin should securely provide this to the user.
   *                       example: abc123def456_ghi789jkl012
   *                     status:
   *                       type: string
   *                       description: Agent status
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                       description: Agent creation timestamp
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *                       description: Agent updated timestamp
   *                 agentError:
   *                   type: string
   *                   nullable: true
   *                   description: Error message if agent creation failed
   *       400:
   *         description: Missing required parameters or invalid wallet address
   *       409:
   *         description: User with this wallet address already exists
   *       500:
   *         description: Server error
   */
  router.post("/users", controller.registerUser);

  /**
   * @openapi
   * /api/admin/users:
   *   get:
   *     tags:
   *       - Admin
   *     summary: List all users
   *     description: Get a list of all users in the system
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: List of users
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 users:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         description: User ID
   *                       walletAddress:
   *                         type: string
   *                         description: User wallet address
   *                       name:
   *                         type: string
   *                         description: User name
   *                         nullable: true
   *                       email:
   *                         type: string
   *                         description: User email
   *                         nullable: true
   *                       status:
   *                         type: string
   *                         description: User status
   *                       imageUrl:
   *                         type: string
   *                         description: URL to the user's image
   *                         nullable: true
   *                       metadata:
   *                         type: object
   *                         description: User metadata
   *                         nullable: true
   *                       createdAt:
   *                         type: string
   *                         format: date-time
   *                         description: Account creation timestamp
   *                       updatedAt:
   *                         type: string
   *                         format: date-time
   *                         description: Account update timestamp
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       500:
   *         description: Server error
   */
  router.get("/users", controller.listAllUsers);

  /**
   * @openapi
   * /api/admin/agents:
   *   get:
   *     tags:
   *       - Admin
   *     summary: List all agents
   *     description: Get a list of all agents in the system
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: List of agents
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 agents:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         description: Agent ID
   *                       ownerId:
   *                         type: string
   *                         description: Agent owner ID
   *                       name:
   *                         type: string
   *                         description: Agent name
   *                       email:
   *                         type: string
   *                         description: Agent email
   *                         nullable: true
   *                       description:
   *                         type: string
   *                         description: Agent description
   *                         nullable: true
   *                       status:
   *                         type: string
   *                         description: Agent status
   *                       imageUrl:
   *                         type: string
   *                         description: URL to the agent's image
   *                         nullable: true
   *                       metadata:
   *                         type: object
   *                         description: Optional metadata for the agent
   *                         nullable: true
   *                       createdAt:
   *                         type: string
   *                         format: date-time
   *                         description: Agent creation timestamp
   *                       updatedAt:
   *                         type: string
   *                         format: date-time
   *                         description: Agent update timestamp
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       500:
   *         description: Server error
   */
  router.get("/agents", controller.listAllAgents);

  /**
   * @openapi
   * /api/admin/agents:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Register a new agent
   *     description: Admin-only endpoint to register a new agent. Admins create agent accounts and distribute the generated API keys to agents.
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - user
   *               - agent
   *             properties:
   *               user:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                     description: The user ID (owner) of the agent. Must be provided if userWalletAddress is not provided.
   *                     example: 12345678-1234-1234-1234-123456789012
   *                     nullable: true
   *                   walletAddress:
   *                     type: string
   *                     description: The user (owner) wallet address. Must be provided if userId is not provided.
   *                     example: 0x1234567890123456789012345678901234567890
   *                     nullable: true
   *               agent:
   *                 type: object
   *                 required:
   *                   - name
   *                 properties:
   *                   name:
   *                     type: string
   *                     description: Agent name
   *                     example: My Agent
   *                   walletAddress:
   *                     type: string
   *                     description: The agent wallet address. Must be provided if userWalletAddress is not provided.
   *                     example: 0x1234567890123456789012345678901234567890
   *                     nullable: true
   *                   email:
   *                     type: string
   *                     description: Agent email
   *                     nullable: true
   *                   description:
   *                     type: string
   *                     description: Agent description
   *                     nullable: true
   *                   imageUrl:
   *                     type: string
   *                     description: URL to agent's image
   *                     nullable: true
   *                   metadata:
   *                     type: object
   *                     description: Optional metadata for the agent
   *                     example: { "strategy": "yield-farming", "risk": "medium" }
   *                     nullable: true
   *     responses:
   *       201:
   *         description: Agent registered successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 agent:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Agent ID
   *                     ownerId:
   *                       type: string
   *                       description: Agent owner ID
   *                     name:
   *                       type: string
   *                       description: Agent name
   *                     walletAddress:
   *                       type: string
   *                       description: Agent wallet address
   *                       nullable: true
   *                     email:
   *                       type: string
   *                       description: Agent email
   *                       nullable: true
   *                     description:
   *                       type: string
   *                       description: Agent description
   *                       nullable: true
   *                     imageUrl:
   *                       type: string
   *                       description: URL to agent's image
   *                       nullable: true
   *                     metadata:
   *                       type: object
   *                       description: Optional metadata for the agent
   *                       example: { "strategy": "yield-farming", "risk": "medium" }
   *                       nullable: true
   *                     apiKey:
   *                       type: string
   *                       description: API key for the agent to use with Bearer authentication. Admin should securely provide this to the agent.
   *                     status:
   *                       type: string
   *                       description: Agent status
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                       description: Agent creation timestamp
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *                       description: Agent update timestamp
   *       400:
   *         description: Missing required parameters or invalid wallet address
   *       404:
   *         description: User not found
   *       409:
   *         description: User with this wallet address already exists
   *       500:
   *         description: Server error
   */
  router.post("/agents", controller.registerAgent);

  /**
   * @openapi
   * /api/admin/agents/{agentId}/key:
   *   get:
   *     tags:
   *       - Admin
   *     summary: Get an agent's API key
   *     description: Retrieves the original API key for an agent. Use this when agents lose or misplace their API key.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: agentId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the agent
   *     responses:
   *       200:
   *         description: API key retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 agent:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Agent ID
   *                     name:
   *                       type: string
   *                       description: Agent name
   *                     apiKey:
   *                       type: string
   *                       description: The agent's API key
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Agent not found
   *       500:
   *         description: Server error
   */
  router.get("/agents/:agentId/key", controller.getAgentApiKey);

  /**
   * @openapi
   * /api/admin/agents/{agentId}:
   *   delete:
   *     tags:
   *       - Admin
   *     summary: Delete an agent
   *     description: Permanently delete an agent and all associated data
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: agentId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the agent to delete
   *     responses:
   *       200:
   *         description: Agent deleted successfully
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
   *         description: Agent ID is required
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Agent not found
   *       500:
   *         description: Server error
   */
  router.delete("/agents/:agentId", controller.deleteAgent);

  /**
   * @openapi
   * /api/admin/agents/{agentId}/deactivate:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Deactivate an agent
   *     description: Globally deactivate an agent. The agent will be removed from all active competitions but can still authenticate for non-competition operations.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: agentId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the agent to deactivate
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - reason
   *             properties:
   *               reason:
   *                 type: string
   *                 description: Reason for deactivation
   *                 example: Violated competition rules by using external API
   *     responses:
   *       200:
   *         description: Agent deactivated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 agent:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Agent ID
   *                     name:
   *                       type: string
   *                       description: Agent name
   *                     status:
   *                       type: string
   *                       description: Agent status (will be inactive)
   *       400:
   *         description: Missing required parameters
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Agent not found
   *       500:
   *         description: Server error
   */
  router.post("/agents/:agentId/deactivate", controller.deactivateAgent);

  /**
   * @openapi
   * /api/admin/agents/{agentId}/reactivate:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Reactivate an agent
   *     description: Reactivate a previously deactivated agent
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: agentId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the agent to reactivate
   *     responses:
   *       200:
   *         description: Agent reactivated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 agent:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Agent ID
   *                     name:
   *                       type: string
   *                       description: Agent name
   *                     status:
   *                       type: string
   *                       description: Agent status (will be active)
   *       400:
   *         description: Agent ID is required or agent is already active
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Agent not found
   *       500:
   *         description: Server error
   */
  router.post("/agents/:agentId/reactivate", controller.reactivateAgent);

  /**
   * @openapi
   * /api/admin/agents/{agentId}:
   *   get:
   *     tags:
   *       - Admin
   *     summary: Get agent details
   *     description: Get detailed information about a specific agent
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: agentId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the agent
   *     responses:
   *       200:
   *         description: Agent details retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 agent:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Agent ID
   *                     ownerId:
   *                       type: string
   *                       description: Agent owner ID
   *                     name:
   *                       type: string
   *                       description: Agent name
   *                     email:
   *                       type: string
   *                       description: Agent email
   *                       nullable: true
   *                     description:
   *                       type: string
   *                       description: Agent description
   *                       nullable: true
   *                     status:
   *                       type: string
   *                       description: Agent status
   *                     imageUrl:
   *                       type: string
   *                       description: URL to the agent's image
   *                       nullable: true
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                       description: Agent creation timestamp
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *                       description: Agent update timestamp
   *       400:
   *         description: Agent ID is required
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Agent not found
   *       500:
   *         description: Server error
   */
  router.get("/agents/:agentId", controller.getAgent);

  /**
   * @openapi
   * /api/admin/search:
   *   get:
   *     tags:
   *       - Admin
   *     summary: Search users and agents
   *     description: Search for users and agents based on various criteria
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: user.email
   *         schema:
   *           type: string
   *         description: Partial match for user email
   *       - in: query
   *         name: user.name
   *         schema:
   *           type: string
   *         description: Partial match for user name
   *       - in: query
   *         name: user.walletAddress
   *         schema:
   *           type: string
   *         description: Partial match for user wallet address
   *       - in: query
   *         name: user.status
   *         schema:
   *           type: string
   *           enum: [active, suspended, inactive, deleted]
   *         description: Filter by user status
   *       - in: query
   *         name: agent.name
   *         schema:
   *           type: string
   *         description: Partial match for agent name
   *       - in: query
   *         name: agent.ownerId
   *         schema:
   *           type: string
   *         description: Filter by agent owner ID
   *       - in: query
   *         name: agent.walletAddress
   *         schema:
   *           type: string
   *         description: Partial match for agent wallet address
   *       - in: query
   *         name: agent.status
   *         schema:
   *           type: string
   *           enum: [active, suspended, inactive, deleted]
   *         description: Filter by agent status
   *       - in: query
   *         name: join
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Whether to "join" the results with a left join on the users table, or return all independent results
   *     responses:
   *       200:
   *         description: Search results
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 join:
   *                   type: boolean
   *                   description: Whether to "join" the results with a left join on the users table
   *                 results:
   *                   type: object
   *                   properties:
   *                     users:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           type:
   *                             type: string
   *                             example: user
   *                           id:
   *                             type: string
   *                           walletAddress:
   *                             type: string
   *                           name:
   *                             type: string
   *                             nullable: true
   *                           email:
   *                             type: string
   *                             nullable: true
   *                           status:
   *                             type: string
   *                           imageUrl:
   *                             type: string
   *                             nullable: true
   *                           createdAt:
   *                             type: string
   *                             format: date-time
   *                           updatedAt:
   *                             type: string
   *                             format: date-time
   *                     agents:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           type:
   *                             type: string
   *                             example: agent
   *                           id:
   *                             type: string
   *                           ownerId:
   *                             type: string
   *                           name:
   *                             type: string
   *                           description:
   *                             type: string
   *                             nullable: true
   *                           email:
   *                             type: string
   *                             nullable: true
   *                           metadata:
   *                             type: object
   *                             nullable: true
   *                           status:
   *                             type: string
   *                           imageUrl:
   *                             type: string
   *                             nullable: true
   *                           createdAt:
   *                             type: string
   *                             format: date-time
   *                           updatedAt:
   *                             type: string
   *                             format: date-time
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       500:
   *         description: Server error
   */
  router.get("/search", controller.searchUsersAndAgents);

  /**
   * @openapi
   * /api/admin/object-index/sync:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Sync object index
   *     description: Manually trigger population of object_index table with competition data
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               competitionId:
   *                 type: string
   *                 description: ID of specific competition to sync (optional, syncs all if not provided)
   *               dataTypes:
   *                 type: array
   *                 items:
   *                   type: string
   *                   enum: [trade, agent_score_history, competitions_leaderboard, portfolio_snapshot, agent_score]
   *                 description: Types of data to sync (defaults to trade, agent_score_history, competitions_leaderboard)
   *     responses:
   *       200:
   *         description: Sync initiated successfully
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
   *                 dataTypes:
   *                   type: array
   *                   items:
   *                     type: string
   *                   description: Data types that were synced
   *                 competitionId:
   *                   type: string
   *                   description: Competition ID that was synced (or 'all')
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       500:
   *         description: Server error
   */
  router.post("/object-index/sync", controller.syncObjectIndex);

  /**
   * @openapi
   * /api/admin/object-index:
   *   get:
   *     tags:
   *       - Admin
   *     summary: Get object index entries
   *     description: Retrieve object index entries with optional filters
   *     security:
   *       - ApiKeyAuth: []
   *     parameters:
   *       - in: query
   *         name: competitionId
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Filter by competition ID
   *       - in: query
   *         name: agentId
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Filter by agent ID
   *       - in: query
   *         name: dataType
   *         schema:
   *           type: string
   *           enum: [trade, agent_score_history, agent_score, competitions_leaderboard, portfolio_snapshot]
   *         description: Filter by data type
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 1000
   *           default: 100
   *         description: Maximum number of entries to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *         description: Number of entries to skip
   *     responses:
   *       200:
   *         description: Object index entries retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     entries:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           id:
   *                             type: string
   *                           competitionId:
   *                             type: string
   *                           agentId:
   *                             type: string
   *                           dataType:
   *                             type: string
   *                           data:
   *                             type: string
   *                           sizeBytes:
   *                             type: integer
   *                           metadata:
   *                             type: object
   *                           eventTimestamp:
   *                             type: string
   *                             format: date-time
   *                           createdAt:
   *                             type: string
   *                             format: date-time
   *                     pagination:
   *                       type: object
   *                       properties:
   *                         total:
   *                           type: integer
   *                         limit:
   *                           type: integer
   *                         offset:
   *                           type: integer
   *       400:
   *         description: Bad request - Invalid parameters
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       500:
   *         description: Server error
   */
  router.get("/object-index", controller.getObjectIndex);

  /**
   * @openapi
   * /api/admin/competitions/{competitionId}/agents/{agentId}:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Add agent to competition
   *     description: Add an agent to a specific competition (admin operation). Requires agent owner's email to be verified for security. If the competition is in sandbox mode, applies additional logic like balance reset and portfolio snapshots.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         schema:
   *           type: string
   *           format: uuid
   *         required: true
   *         description: ID of the competition
   *       - in: path
   *         name: agentId
   *         schema:
   *           type: string
   *           format: uuid
   *         required: true
   *         description: ID of the agent to add
   *     responses:
   *       200:
   *         description: Agent added to competition successfully
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
   *                 agent:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Agent ID
   *                     name:
   *                       type: string
   *                       description: Agent name
   *                     ownerId:
   *                       type: string
   *                       description: Agent owner ID
   *                 competition:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Competition ID
   *                     name:
   *                       type: string
   *                       description: Competition name
   *                     status:
   *                       type: string
   *                       description: Competition status
   *       400:
   *         description: Bad request - missing parameters, agent already in competition, or competition ended
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       403:
   *         description: Forbidden - Agent owner's email must be verified
   *       404:
   *         description: Competition, agent, or agent owner not found
   *       500:
   *         description: Server error
   */
  router.post(
    "/competitions/:competitionId/agents/:agentId",
    controller.addAgentToCompetition,
  );

  /**
   * @openapi
   * /api/admin/competitions/{competitionId}/agents/{agentId}/remove:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Remove agent from competition
   *     description: Remove an agent from a specific competition (admin operation)
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the competition
   *       - in: path
   *         name: agentId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the agent to remove
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - reason
   *             properties:
   *               reason:
   *                 type: string
   *                 description: Reason for removing the agent
   *                 example: Violated competition rules
   *     responses:
   *       200:
   *         description: Agent removed from competition successfully
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
   *                 agent:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                     name:
   *                       type: string
   *                 competition:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                     name:
   *                       type: string
   *                 reason:
   *                   type: string
   *                   description: Reason for removal
   *       400:
   *         description: Bad request - missing parameters or agent not in competition
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Competition or agent not found
   *       500:
   *         description: Server error
   */
  router.post(
    "/competitions/:competitionId/agents/:agentId/remove",
    controller.removeAgentFromCompetition,
  );

  /**
   * @openapi
   * /api/admin/competitions/{competitionId}/agents/{agentId}/reactivate:
   *   post:
   *     tags:
   *       - Admin
   *     summary: Reactivate agent in competition
   *     description: Reactivate an agent in a specific competition (admin operation)
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the competition
   *       - in: path
   *         name: agentId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the agent to reactivate
   *     responses:
   *       200:
   *         description: Agent reactivated in competition successfully
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
   *                 agent:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                     name:
   *                       type: string
   *                 competition:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                     name:
   *                       type: string
   *       400:
   *         description: Bad request - agent not in competition or competition ended
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       404:
   *         description: Competition or agent not found
   *       500:
   *         description: Server error
   */
  router.post(
    "/competitions/:competitionId/agents/:agentId/reactivate",
    controller.reactivateAgentInCompetition,
  );

  return router;
}
