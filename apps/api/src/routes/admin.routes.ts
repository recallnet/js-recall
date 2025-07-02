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
   *             required: [name]
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
   *                 $ref: '#/components/schemas/CrossChainTradingType'
   *                 description: The type of cross-chain trading to allow in this competition
   *                 default: disallowAll
   *                 example: disallowAll
   *               sandboxMode:
   *                 type: boolean
   *                 description: Enable sandbox mode to automatically join newly registered agents to this competition
   *                 default: false
   *                 example: false
   *               type:
   *                 $ref: '#/components/schemas/CompetitionType'
   *                 description: The type of competition
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
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [competition]
   *                   properties:
   *                     competition:
   *                       $ref: '#/components/schemas/Competition'
   *       400:
   *         description: Missing required parameters
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Admin authentication required
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
   *             required: [agentIds]
   *             properties:
   *               competitionId:
   *                 type: string
   *                 format: uuid
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
   *                   format: uuid
   *                 description: Array of agent IDs to include in the competition
   *               tradingType:
   *                 $ref: '#/components/schemas/CrossChainTradingType'
   *                 description: Type of cross-chain trading to allow in this competition (used when creating a new competition)
   *                 default: disallowAll
   *                 example: disallowAll
   *               sandboxMode:
   *                 type: boolean
   *                 description: Enable sandbox mode to automatically join newly registered agents to this competition (used when creating a new competition)
   *                 default: false
   *                 example: false
   *               type:
   *                 $ref: '#/components/schemas/CompetitionType'
   *                 description: The type of competition
   *                 default: trading
   *                 example: trading
   *     responses:
   *       200:
   *         description: Competition started successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [competition]
   *                   properties:
   *                     competition:
   *                       $ref: '#/components/schemas/CompetitionWithAgentIds'
   *       400:
   *         description: Invalid input, invalid agent IDs, or competition already started
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Admin authentication required
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: Competition not found when using competitionId
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
   *             required: [competitionId]
   *             properties:
   *               competitionId:
   *                 type: string
   *                 format: uuid
   *                 description: ID of the competition to end
   *     responses:
   *       200:
   *         description: Competition ended successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [competition, leaderboard]
   *                   properties:
   *                     competition:
   *                       $ref: '#/components/schemas/Competition'
   *                     leaderboard:
   *                       type: array
   *                       items:
   *                         type: object
   *                         required: [agentId, value]
   *                         properties:
   *                           agentId:
   *                             type: string
   *                             format: uuid
   *                             description: Agent ID
   *                           value:
   *                             type: number
   *                             description: Final portfolio value
   *       400:
   *         description: Missing competitionId parameter
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Admin authentication required
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
   *           format: uuid
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
   *                 $ref: '#/components/schemas/CompetitionType'
   *                 description: The type of competition
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
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [competition]
   *                   properties:
   *                     competition:
   *                       $ref: '#/components/schemas/Competition'
   *       400:
   *         description: Invalid input data
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Admin authentication required
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
   *           format: uuid
   *         required: true
   *         description: ID of the competition
   *       - in: query
   *         name: agentId
   *         schema:
   *           type: string
   *           format: uuid
   *         required: false
   *         description: Optional agent ID to filter snapshots
   *     responses:
   *       200:
   *         description: Competition snapshots
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [snapshots]
   *                   properties:
   *                     snapshots:
   *                       type: array
   *                       items:
   *                         type: object
   *                         required: [id, competitionId, agentId, totalValue, timestamp]
   *                         properties:
   *                           id:
   *                             type: string
   *                             format: uuid
   *                             description: Snapshot ID
   *                           competitionId:
   *                             type: string
   *                             format: uuid
   *                             description: Competition ID
   *                           agentId:
   *                             type: string
   *                             format: uuid
   *                             description: Agent ID
   *                           totalValue:
   *                             type: number
   *                             description: Total portfolio value at snapshot time
   *                           timestamp:
   *                             type: string
   *                             format: date-time
   *                             description: Snapshot timestamp
   *       400:
   *         description: Missing competitionId or agent not in competition
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Admin authentication required
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
   *           format: uuid
   *         required: true
   *         description: ID of the competition
   *     responses:
   *       200:
   *         description: Performance reports
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [competition, leaderboard]
   *                   properties:
   *                     competition:
   *                       $ref: '#/components/schemas/Competition'
   *                     leaderboard:
   *                       type: array
   *                       description: Ranked list of active agents
   *                       items:
   *                         type: object
   *                         required: [rank, agentId, agentName, portfolioValue]
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
   *                             description: Portfolio value
   *       400:
   *         description: Missing competitionId parameter
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Admin authentication required
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
   *             required: [walletAddress]
   *             properties:
   *               walletAddress:
   *                 type: string
   *                 pattern: '^0x[a-fA-F0-9]{40}$'
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
   *                 pattern: '^0x[a-fA-F0-9]{40}$'
   *                 description: Ethereum wallet address (must start with 0x)
   *                 example: 0x1234567890123456789012345678901234567890
   *     responses:
   *       201:
   *         description: User registered successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [user]
   *                   properties:
   *                     user:
   *                       $ref: '#/components/schemas/OwnerInfo'
   *                     agent:
   *                       oneOf:
   *                         - allOf:
   *                             - $ref: '#/components/schemas/AgentPublic'
   *                             - type: object
   *                               properties:
   *                                 apiKey:
   *                                   type: string
   *                                   description: API key for the agent to use with Bearer authentication. Admin should securely provide this to the user.
   *                                   example: abc123def456_ghi789jkl012
   *                         - type: "null"
   *                       description: Created agent (if agentName was provided)
   *                     agentError:
   *                       type: string
   *                       nullable: true
   *                       description: Error message if agent creation failed
   *       400:
   *         description: Missing required parameters or invalid wallet address
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       409:
   *         description: User with this wallet address already exists
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
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [users]
   *                   properties:
   *                     users:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/OwnerInfo'
   *       401:
   *         description: Unauthorized - Admin authentication required
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
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [agents]
   *                   properties:
   *                     agents:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/AgentPublic'
   *       401:
   *         description: Unauthorized - Admin authentication required
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
   *             required: [user, agent]
   *             properties:
   *               user:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                     format: uuid
   *                     description: The user ID (owner) of the agent. Must be provided if userWalletAddress is not provided.
   *                     example: 12345678-1234-1234-1234-123456789012
   *                     nullable: true
   *                   walletAddress:
   *                     type: string
   *                     pattern: '^0x[a-fA-F0-9]{40}$'
   *                     description: The user (owner) wallet address. Must be provided if userId is not provided.
   *                     example: 0x1234567890123456789012345678901234567890
   *                     nullable: true
   *               agent:
   *                 type: object
   *                 required: [name]
   *                 properties:
   *                   name:
   *                     type: string
   *                     description: Agent name
   *                     example: My Agent
   *                   walletAddress:
   *                     type: string
   *                     pattern: '^0x[a-fA-F0-9]{40}$'
   *                     description: The agent wallet address. Must be provided if userWalletAddress is not provided.
   *                     example: 0x1234567890123456789012345678901234567890
   *                     nullable: true
   *                   email:
   *                     type: string
   *                     format: email
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
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [agent]
   *                   properties:
   *                     agent:
   *                       allOf:
   *                         - $ref: '#/components/schemas/AgentPublic'
   *                         - type: object
   *                           properties:
   *                             apiKey:
   *                               type: string
   *                               description: API key for the agent to use with Bearer authentication. Admin should securely provide this to the agent.
   *       400:
   *         description: Missing required parameters or invalid wallet address
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: User not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       409:
   *         description: User with this wallet address already exists
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
   *           format: uuid
   *         required: true
   *         description: ID of the agent
   *     responses:
   *       200:
   *         description: API key retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [agent]
   *                   properties:
   *                     agent:
   *                       type: object
   *                       required: [id, name, apiKey]
   *                       properties:
   *                         id:
   *                           type: string
   *                           format: uuid
   *                           description: Agent ID
   *                         name:
   *                           type: string
   *                           description: Agent name
   *                         apiKey:
   *                           type: string
   *                           description: The agent's API key
   *       401:
   *         description: Unauthorized - Admin authentication required
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: Agent not found
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
   *           format: uuid
   *         required: true
   *         description: ID of the agent to delete
   *     responses:
   *       200:
   *         description: Agent deleted successfully
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
   *         description: Agent ID is required
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Admin authentication required
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: Agent not found
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
   *           format: uuid
   *         required: true
   *         description: ID of the agent to deactivate
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [reason]
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
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [agent]
   *                   properties:
   *                     agent:
   *                       type: object
   *                       required: [id, name, status]
   *                       properties:
   *                         id:
   *                           type: string
   *                           format: uuid
   *                           description: Agent ID
   *                         name:
   *                           type: string
   *                           description: Agent name
   *                         status:
   *                           type: string
   *                           description: Agent status (will be inactive)
   *       400:
   *         description: Missing required parameters
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Admin authentication required
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: Agent not found
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
   *           format: uuid
   *         required: true
   *         description: ID of the agent to reactivate
   *     responses:
   *       200:
   *         description: Agent reactivated successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [agent]
   *                   properties:
   *                     agent:
   *                       type: object
   *                       required: [id, name, status]
   *                       properties:
   *                         id:
   *                           type: string
   *                           format: uuid
   *                           description: Agent ID
   *                         name:
   *                           type: string
   *                           description: Agent name
   *                         status:
   *                           type: string
   *                           description: Agent status (will be active)
   *       400:
   *         description: Agent ID is required or agent is already active
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Admin authentication required
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: Agent not found
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
   *           format: uuid
   *         required: true
   *         description: ID of the agent
   *     responses:
   *       200:
   *         description: Agent details retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [agent]
   *                   properties:
   *                     agent:
   *                       $ref: '#/components/schemas/AgentPublic'
   *       400:
   *         description: Agent ID is required
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Admin authentication required
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: Agent not found
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
   *           format: uuid
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
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [join, results]
   *                   properties:
   *                     join:
   *                       type: boolean
   *                       description: Whether to "join" the results with a left join on the users table
   *                     results:
   *                       type: object
   *                       required: [users, agents]
   *                       properties:
   *                         users:
   *                           type: array
   *                           items:
   *                             allOf:
   *                               - $ref: '#/components/schemas/OwnerInfo'
   *                               - type: object
   *                                 properties:
   *                                   type:
   *                                     type: string
   *                                     example: user
   *                         agents:
   *                           type: array
   *                           items:
   *                             allOf:
   *                               - $ref: '#/components/schemas/AgentPublic'
   *                               - type: object
   *                                 properties:
   *                                   type:
   *                                     type: string
   *                                     example: agent
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
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
   *                 format: uuid
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
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [message, dataTypes, competitionId]
   *                   properties:
   *                     message:
   *                       type: string
   *                       description: Success message
   *                     dataTypes:
   *                       type: array
   *                       items:
   *                         type: string
   *                       description: Data types that were synced
   *                     competitionId:
   *                       type: string
   *                       description: Competition ID that was synced (or 'all')
   *       401:
   *         description: Unauthorized - Admin authentication required
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
   *           enum: [trade, agent_rank_history, agent_rank, competitions_leaderboard, portfolio_snapshot]
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
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [data]
   *                   properties:
   *                     data:
   *                       type: object
   *                       required: [entries, pagination]
   *                       properties:
   *                         entries:
   *                           type: array
   *                           items:
   *                             type: object
   *                             required: [id, competitionId, agentId, dataType, data, sizeBytes, eventTimestamp, createdAt]
   *                             properties:
   *                               id:
   *                                 type: string
   *                                 format: uuid
   *                               competitionId:
   *                                 type: string
   *                                 format: uuid
   *                               agentId:
   *                                 type: string
   *                                 format: uuid
   *                               dataType:
   *                                 type: string
   *                               data:
   *                                 type: string
   *                               sizeBytes:
   *                                 type: integer
   *                               metadata:
   *                                 type: object
   *                                 nullable: true
   *                               eventTimestamp:
   *                                 type: string
   *                                 format: date-time
   *                               createdAt:
   *                                 type: string
   *                                 format: date-time
   *                         pagination:
   *                           $ref: '#/components/schemas/PaginationMeta'
   *       400:
   *         description: Bad request - Invalid parameters
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Admin authentication required
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
  router.get("/object-index", controller.getObjectIndex);

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
   *           format: uuid
   *         required: true
   *         description: ID of the competition
   *       - in: path
   *         name: agentId
   *         schema:
   *           type: string
   *           format: uuid
   *         required: true
   *         description: ID of the agent to remove
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [reason]
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
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [message, agent, competition, reason]
   *                   properties:
   *                     message:
   *                       type: string
   *                       description: Success message
   *                     agent:
   *                       type: object
   *                       required: [id, name]
   *                       properties:
   *                         id:
   *                           type: string
   *                           format: uuid
   *                         name:
   *                           type: string
   *                     competition:
   *                       type: object
   *                       required: [id, name]
   *                       properties:
   *                         id:
   *                           type: string
   *                           format: uuid
   *                         name:
   *                           type: string
   *                     reason:
   *                       type: string
   *                       description: Reason for removal
   *       400:
   *         description: Bad request - missing parameters or agent not in competition
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Admin authentication required
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
   *           format: uuid
   *         required: true
   *         description: ID of the competition
   *       - in: path
   *         name: agentId
   *         schema:
   *           type: string
   *           format: uuid
   *         required: true
   *         description: ID of the agent to reactivate
   *     responses:
   *       200:
   *         description: Agent reactivated in competition successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [message, agent, competition]
   *                   properties:
   *                     message:
   *                       type: string
   *                       description: Success message
   *                     agent:
   *                       type: object
   *                       required: [id, name]
   *                       properties:
   *                         id:
   *                           type: string
   *                           format: uuid
   *                         name:
   *                           type: string
   *                     competition:
   *                       type: object
   *                       required: [id, name]
   *                       properties:
   *                         id:
   *                           type: string
   *                           format: uuid
   *                         name:
   *                           type: string
   *       400:
   *         description: Bad request - agent not in competition or competition ended
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Admin authentication required
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
    "/competitions/:competitionId/agents/:agentId/reactivate",
    controller.reactivateAgentInCompetition,
  );

  return router;
}
