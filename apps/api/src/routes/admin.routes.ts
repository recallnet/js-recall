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
   *         description: Missing required parameters
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
   *               type:
   *                 type: string
   *                 description: The type of competition
   *                 enum: [trading]
   *                 default: trading
   *                 example: trading
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
   *                         description: Agent rank on the leaderboard
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
   *     description: Deactivate an agent from the system. The agent will no longer be able to perform any actions.
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
   *         name: email
   *         schema:
   *           type: string
   *         description: Partial match for email address (users only)
   *       - in: query
   *         name: name
   *         schema:
   *           type: string
   *         description: Partial match for name
   *       - in: query
   *         name: walletAddress
   *         schema:
   *           type: string
   *         description: Partial match for wallet address (users only)
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [active, suspended, deleted]
   *         description: Filter by status
   *       - in: query
   *         name: searchType
   *         schema:
   *           type: string
   *           enum: [users, agents, both]
   *           default: both
   *         description: Type of entities to search
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
   *                 searchType:
   *                   type: string
   *                   description: Type of search performed
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
   *                   enum: [trade, agent_rank_history, competitions_leaderboard, portfolio_snapshot, agent_rank]
   *                 description: Types of data to sync (defaults to trade, agent_rank_history, competitions_leaderboard)
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

  return router;
}
