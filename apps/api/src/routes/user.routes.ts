import { Router } from "express";

import { RewardsController } from "@/controllers/rewards.controller.js";
import { UserController } from "@/controllers/user.controller.js";

/**
 * Configure User Routes
 * Handles user-specific operations with SIWE session authentication
 * All routes require req.userId to be set by authentication middleware
 */
export function configureUserRoutes(
  userController: UserController,
  rewardsController: RewardsController,
): Router {
  const router = Router();

  /**
   * @openapi
   * /api/user/profile:
   *   get:
   *     summary: Get authenticated user profile
   *     description: Retrieve the profile information for the currently authenticated user
   *     tags:
   *       - User
   *     security:
   *       - PrivyCookie: []
   *     responses:
   *       200:
   *         description: User profile retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 user:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       format: uuid
   *                     walletAddress:
   *                       type: string
   *                       example: "0x1234567890abcdef1234567890abcdef12345678"
   *                     walletLastVerifiedAt:
   *                       type: string
   *                       format: date-time
   *                     embeddedWalletAddress:
   *                       type: string
   *                       example: "0x1234567890abcdef1234567890abcdef12345678"
   *                     privyId:
   *                       type: string
   *                       example: "1234567890abcdef1234567890abcdef12345678"
   *                     name:
   *                       type: string
   *                       example: "John Doe"
   *                     email:
   *                       type: string
   *                       example: "john@example.com"
   *                     isSubscribed:
   *                       type: boolean
   *                       example: true
   *                     imageUrl:
   *                       type: string
   *                       example: "https://example.com/avatar.jpg"
   *                     status:
   *                       type: string
   *                       enum: [active, inactive, suspended, deleted]
   *                     metadata:
   *                       type: object
   *                       example: { "foo": "bar" }
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *                     lastLoginAt:
   *                       type: string
   *                       format: date-time
   *       401:
   *         description: User not authenticated
   *       404:
   *         description: User not found
   *       500:
   *         description: Internal server error
   */
  router.get("/profile", userController.getProfile);

  /**
   * @openapi
   * /api/user/wallet/link:
   *   post:
   *     summary: Link a wallet to the authenticated user
   *     description: Link a wallet to the authenticated user
   *     tags:
   *       - User
   *     security:
   *       - PrivyCookie: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               walletAddress:
   *                 type: string
   *                 description: The wallet address to link to the user
   *                 example: "0x1234567890abcdef1234567890abcdef12345678"
   *             additionalProperties: false
   *     responses:
   *       200:
   *         description: Wallet linked successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 user:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       format: uuid
   *                     walletAddress:
   *                       type: string
   *                       example: "0x1234567890abcdef1234567890abcdef12345678"
   *                     walletLastVerifiedAt:
   *                       type: string
   *                       format: date-time
   *                     embeddedWalletAddress:
   *                       type: string
   *                       example: "0x1234567890abcdef1234567890abcdef12345678"
   *                     privyId:
   *                       type: string
   *                       example: "1234567890abcdef1234567890abcdef12345678"
   *                     name:
   *                       type: string
   *                       example: "John Doe"
   *                     email:
   *                       type: string
   *                       example: "john@example.com"
   *                     isSubscribed:
   *                       type: boolean
   *                       example: true
   *                     imageUrl:
   *                       type: string
   *                       example: "https://example.com/avatar.jpg"
   *                     status:
   *                       type: string
   *                       enum: [active, inactive, suspended, deleted]
   *                     metadata:
   *                       type: object
   *                       example: { "foo": "bar" }
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *                     lastLoginAt:
   *                       type: string
   *                       format: date-time
   *       401:
   *         description: User not authenticated
   *       404:
   *         description: User not found
   *       500:
   *         description: Internal server error
   */
  router.post("/wallet/link", userController.linkWallet);

  /**
   * @openapi
   * /api/user/profile:
   *   put:
   *     summary: Update authenticated user profile
   *     description: Update the profile information for the currently authenticated user (limited fields)
   *     tags:
   *       - User
   *     security:
   *       - PrivyCookie: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 description: User's display name
   *                 example: "John Doe"
   *               imageUrl:
   *                 type: string
   *                 description: URL to user's profile image
   *                 example: "https://example.com/avatar.jpg"
   *               metadata:
   *                 type: object
   *                 description: User's metadata
   *                 example: { "foo": "bar" }
   *             additionalProperties: false
   *     responses:
   *       200:
   *         description: Profile updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 user:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       format: uuid
   *                     walletAddress:
   *                       type: string
   *                       nullable: true
   *                     walletLastVerifiedAt:
   *                       type: string
   *                       format: date-time
   *                     embeddedWalletAddress:
   *                       type: string
   *                       nullable: true
   *                     privyId:
   *                       type: string
   *                       nullable: true
   *                     name:
   *                       type: string
   *                     email:
   *                       type: string
   *                       nullable: true
   *                     isSubscribed:
   *                       type: boolean
   *                       example: true
   *                     imageUrl:
   *                       type: string
   *                       nullable: true
   *                     metadata:
   *                       type: object
   *                       nullable: true
   *                     status:
   *                       type: string
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *                     lastLoginAt:
   *                       type: string
   *                       format: date-time
   *       400:
   *         description: Invalid fields provided (users can only update name and imageUrl)
   *       401:
   *         description: User not authenticated
   *       404:
   *         description: User not found
   *       500:
   *         description: Internal server error
   */
  router.put("/profile", userController.updateProfile);

  /**
   * @openapi
   * /api/user/agents:
   *   post:
   *     summary: Create a new agent
   *     description: Create a new agent for the authenticated user
   *     tags:
   *       - User
   *     security:
   *       - PrivyCookie: []
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
   *                 description: Agent name (must be unique for this user)
   *                 example: "Trading Bot Alpha"
   *               description:
   *                 type: string
   *                 description: Optional agent description
   *                 example: "An AI agent that focuses on DeFi yield farming"
   *               imageUrl:
   *                 type: string
   *                 description: Optional URL to agent's profile image
   *                 example: "https://example.com/bot-avatar.jpg"
   *               metadata:
   *                 type: object
   *                 description: Optional metadata for the agent
   *                 example: { "strategy": "yield-farming", "risk": "medium" }
   *     responses:
   *       201:
   *         description: Agent created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 agent:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       format: uuid
   *                     ownerId:
   *                       type: string
   *                       format: uuid
   *                     walletAddress:
   *                       type: string
   *                       nullable: true
   *                     name:
   *                       type: string
   *                     email:
   *                       type: string
   *                       nullable: true
   *                     description:
   *                       type: string
   *                       nullable: true
   *                     imageUrl:
   *                       type: string
   *                       nullable: true
   *                     metadata:
   *                       type: object
   *                       nullable: true
   *                     status:
   *                       type: string
   *                       enum: [active, inactive, suspended, deleted]
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *       400:
   *         description: Invalid input (name is required)
   *       401:
   *         description: User not authenticated
   *       404:
   *         description: User not found
   *       409:
   *         description: Agent with this name already exists for this user
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
   *                   example: "An agent with the name \"Trading Bot Alpha\" already exists for this user"
   *       500:
   *         description: Internal server error
   */
  router.post("/agents", userController.createAgent);

  /**
   * @openapi
   * /api/user/agents:
   *   get:
   *     summary: Get user's agents
   *     description: Retrieve all agents owned by the authenticated user
   *     tags:
   *       - User
   *     security:
   *       - PrivyCookie: []
   *     responses:
   *       200:
   *         description: Agents retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 userId:
   *                   type: string
   *                   format: uuid
   *                 agents:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         format: uuid
   *                       ownerId:
   *                         type: string
   *                         format: uuid
   *                       walletAddress:
   *                         type: string
   *                         nullable: true
   *                       name:
   *                         type: string
   *                       description:
   *                         type: string
   *                         nullable: true
   *                       email:
   *                         type: string
   *                       imageUrl:
   *                         type: string
   *                       metadata:
   *                         type: object
   *                       status:
   *                         type: string
   *                         enum: [active, inactive, suspended, deleted]
   *                       stats:
   *                         type: object
   *                         properties:
   *                           completedCompetitions:
   *                             type: integer
   *                           totalTrades:
   *                             type: integer
   *                             description: "Total number of trades across all paper trading competitions"
   *                           totalPositions:
   *                             type: integer
   *                             description: "Total number of positions across all perpetual futures competitions"
   *                           bestPlacement:
   *                             type: object
   *                             nullable: true
   *                             description: "Best placement across all competitions (null if no ranking data available)"
   *                             properties:
   *                               competitionId:
   *                                 type: string
   *                               rank:
   *                                 type: integer
   *                               score:
   *                                 type: number
   *                               totalAgents:
   *                                 type: integer
   *                           rank:
   *                             type: integer
   *                           score:
   *                             type: number
   *                       trophies:
   *                         type: array
   *                         description: "Trophies earned from ended competitions"
   *                         items:
   *                           type: object
   *                           properties:
   *                             competitionId:
   *                               type: string
   *                               description: "Competition ID"
   *                             name:
   *                               type: string
   *                               description: "Competition name"
   *                             rank:
   *                               type: number
   *                               description: "Agent's final rank in the competition"
   *                             imageUrl:
   *                               type: string
   *                               description: "Competition image URL"
   *                             createdAt:
   *                               type: string
   *                               format: date-time
   *                               description: "When the trophy was awarded (competition end date)"
   *                       skills:
   *                         type: array
   *                         items:
   *                           type: string
   *                       hasUnclaimedRewards:
   *                         type: boolean
   *                       deactivationReason:
   *                         type: string
   *                         nullable: true
   *                         description: Reason for deactivation (if status is inactive)
   *                       deactivationDate:
   *                         type: string
   *                         format: date-time
   *                         nullable: true
   *                         description: Date when agent was deactivated (if status is inactive)
   *                       createdAt:
   *                         type: string
   *                         format: date-time
   *                       updatedAt:
   *                         type: string
   *                         format: date-time
   *       401:
   *         description: User not authenticated
   *       500:
   *         description: Internal server error
   */
  router.get("/agents", userController.getAgents);

  /**
   * @openapi
   * /api/user/agents/{agentId}:
   *   get:
   *     summary: Get specific agent details
   *     description: Retrieve details of a specific agent owned by the authenticated user
   *     tags:
   *       - User
   *     security:
   *       - PrivyCookie: []
   *     parameters:
   *       - in: path
   *         name: agentId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The ID of the agent to retrieve
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
   *                   example: true
   *                 agent:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       format: uuid
   *                     ownerId:
   *                       type: string
   *                       format: uuid
   *                     walletAddress:
   *                       type: string
   *                       nullable: true
   *                     name:
   *                       type: string
   *                     email:
   *                       type: string
   *                       nullable: true
   *                     description:
   *                       type: string
   *                       nullable: true
   *                     imageUrl:
   *                       type: string
   *                       nullable: true
   *                     metadata:
   *                       type: object
   *                       nullable: true
   *                     status:
   *                       type: string
   *                       enum: [active, inactive, suspended, deleted]
   *                     stats:
   *                       type: object
   *                       properties:
   *                         completedCompetitions:
   *                           type: integer
   *                         totalTrades:
   *                           type: integer
   *                           description: "Total number of trades across all paper trading competitions"
   *                         totalPositions:
   *                           type: integer
   *                           description: "Total number of positions across all perpetual futures competitions"
   *                         bestPlacement:
   *                           type: object
   *                           nullable: true
   *                           description: "Best placement across all competitions (null if no ranking data available)"
   *                           properties:
   *                             competitionId:
   *                               type: string
   *                             rank:
   *                               type: integer
   *                             score:
   *                               type: integer
   *                             totalAgents:
   *                               type: integer
   *                         rank:
   *                           type: integer
   *                         score:
   *                           type: number
   *                     trophies:
   *                       type: array
   *                       description: "Trophies earned from ended competitions"
   *                       items:
   *                         type: object
   *                         properties:
   *                           competitionId:
   *                             type: string
   *                             description: "Competition ID"
   *                           name:
   *                             type: string
   *                             description: "Competition name"
   *                           rank:
   *                             type: number
   *                             description: "Agent's final rank in the competition"
   *                           imageUrl:
   *                             type: string
   *                             description: "Competition image URL"
   *                           createdAt:
   *                             type: string
   *                             format: date-time
   *                             description: "When the trophy was awarded (competition end date)"
   *                     skills:
   *                       type: array
   *                       items:
   *                         type: string
   *                     hasUnclaimedRewards:
   *                       type: boolean
   *                     deactivationReason:
   *                       type: string
   *                       nullable: true
   *                       description: Reason for deactivation (if status is inactive)
   *                     deactivationDate:
   *                       type: string
   *                       format: date-time
   *                       nullable: true
   *                       description: Date when agent was deactivated (if status is inactive)
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *       400:
   *         description: Agent ID is required
   *       401:
   *         description: User not authenticated
   *       403:
   *         description: Access denied (user doesn't own this agent)
   *       404:
   *         description: Agent not found
   *       500:
   *         description: Internal server error
   */
  router.get("/agents/:agentId", userController.getAgent);

  /**
   * @openapi
   * /api/user/agents/{agentId}/api-key:
   *   get:
   *     summary: Get agent API key
   *     description: Retrieve the API key for a specific agent owned by the authenticated user. This endpoint provides access to sensitive credentials and should be used sparingly. Requires email verification for security.
   *     tags:
   *       - User
   *     security:
   *       - PrivyCookie: []
   *     parameters:
   *       - in: path
   *         name: agentId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The ID of the agent to get the API key for
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
   *                   example: true
   *                 agentId:
   *                   type: string
   *                   format: uuid
   *                   description: The ID of the agent
   *                 agentName:
   *                   type: string
   *                   description: The name of the agent
   *                   example: "Trading Bot Alpha"
   *                 apiKey:
   *                   type: string
   *                   description: The decrypted API key for the agent (store this securely)
   *                   example: "1234567890abcdef_fedcba0987654321"
   *       400:
   *         description: Invalid agent ID format
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 message:
   *                   type: string
   *                   example: "Invalid request format: Agent ID is required"
   *       401:
   *         description: User not authenticated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 message:
   *                   type: string
   *                   example: "Authentication required"
   *       403:
   *         description: Access denied (user doesn't own this agent or email verification required)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 message:
   *                   type: string
   *                   example: "Email verification required to access agent API keys"
   *       404:
   *         description: Agent not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 message:
   *                   type: string
   *                   example: "Agent not found"
   *       500:
   *         description: Internal server error (e.g., decryption failure)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 message:
   *                   type: string
   *                   example: "Failed to decrypt API key"
   */
  router.get("/agents/:agentId/api-key", userController.getAgentApiKey);

  /**
   * @openapi
   * /api/user/agents/{agentId}/profile:
   *   put:
   *     summary: Update agent profile
   *     description: Update the profile information for a specific agent owned by the authenticated user
   *     tags:
   *       - User
   *     security:
   *       - PrivyCookie: []
   *     parameters:
   *       - in: path
   *         name: agentId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The ID of the agent to update
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 description: Agent's display name
   *                 example: "Trading Bot Beta"
   *               description:
   *                 type: string
   *                 description: Agent description
   *                 example: "Updated description of trading strategy"
   *               imageUrl:
   *                 type: string
   *                 description: URL to agent's profile image
   *                 example: "https://example.com/new-bot-avatar.jpg"
   *               email:
   *                 type: string
   *                 description: Agent email
   *                 example: "tradingbot@example.com"
   *               metadata:
   *                 type: object
   *                 description: Optional metadata for the agent
   *             additionalProperties: false
   *     responses:
   *       200:
   *         description: Agent profile updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 agent:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       format: uuid
   *                     ownerId:
   *                       type: string
   *                       format: uuid
   *                     walletAddress:
   *                       type: string
   *                       nullable: true
   *                     isVerified:
   *                       type: boolean
   *                     name:
   *                       type: string
   *                     email:
   *                       type: string
   *                       nullable: true
   *                     description:
   *                       type: string
   *                     imageUrl:
   *                       type: string
   *                     metadata:
   *                       type: object
   *                       nullable: true
   *                     status:
   *                       type: string
   *                       enum: [active, inactive, suspended, deleted]
   *                     deactivationReason:
   *                       type: string
   *                       nullable: true
   *                       description: Reason for deactivation (if status is inactive)
   *                     deactivationDate:
   *                       type: string
   *                       format: date-time
   *                       nullable: true
   *                       description: Date when agent was deactivated (if status is inactive)
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *       400:
   *         description: Invalid fields provided or missing agentId
   *       401:
   *         description: User not authenticated
   *       403:
   *         description: Access denied (user doesn't own this agent)
   *       404:
   *         description: Agent not found
   *       500:
   *         description: Internal server error
   */
  router.put("/agents/:agentId/profile", userController.updateAgentProfile);

  /**
   * @openapi
   * /api/user/competitions:
   *   get:
   *     summary: Get competitions for user's agents
   *     description: Retrieve all competitions that the authenticated user's agents have ever been registered for, regardless of current participation status
   *     tags:
   *       - User
   *     security:
   *       - PrivyCookie: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 10
   *         description: Number of competitions to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *         description: Number of competitions to skip
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *         description: |
   *           Optional field(s) to sort by. Supports single or multiple fields separated by commas.
   *           Prefix with '-' for descending order (e.g., '-startDate' or 'name,-createdAt').
   *           Available fields: name, startDate, endDate, createdAt, status, agentName, rank.
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *         description: Optional filter for the competition status. Possible values ("ended", "active", "pending")
   *       - in: query
   *         name: claimed
   *         schema:
   *           type: boolean
   *         description: Optional filter for agents with claimed (claimed=true) or unclaimed rewards (claimed=false). Note, because rewards are not implemented, THIS IS NOT IMPLEMENTED YET.
   *     responses:
   *       200:
   *         description: User agent competitions retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 competitions:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         format: uuid
   *                       name:
   *                         type: string
   *                       description:
   *                         type: string
   *                       externalUrl:
   *                         type: string
   *                         nullable: true
   *                       imageUrl:
   *                         type: string
   *                         nullable: true
   *                       status:
   *                         type: string
   *                         enum: [upcoming, active, ended]
   *                       startDate:
   *                         type: string
   *                         format: date-time
   *                       endDate:
   *                         type: string
   *                         format: date-time
   *                       crossChainTradingType:
   *                         type: string
   *                         enum: [single_chain, cross_chain]
   *                       createdAt:
   *                         type: string
   *                         format: date-time
   *                       updatedAt:
   *                         type: string
   *                         format: date-time
   *                       registeredParticipants:
   *                         type: integer
   *                         description: Number of participants registered for this competition
   *                         example: 10
   *                       maxParticipants:
   *                         type: integer
   *                         nullable: true
   *                         description: Maximum number of participants allowed to register for this competition. null means no limit.
   *                         example: 50
   *                       agents:
   *                         type: array
   *                         items:
   *                           type: object
   *                           properties:
   *                             id:
   *                               type: string
   *                               format: uuid
   *                             ownerId:
   *                               type: string
   *                               format: uuid
   *                             name:
   *                               type: string
   *                             walletAddress:
   *                               type: string
   *                             email:
   *                               type: string
   *                               format: email
   *                             description:
   *                               type: string
   *                             imageUrl:
   *                               type: string
   *                             metadata:
   *                               type: object
   *                               description: Optional metadata for the agent
   *                               example: { "strategy": "yield-farming", "risk": "medium" }
   *                               nullable: true
   *                             status:
   *                               type: string
   *                             createdAt:
   *                               type: string
   *                               format: date-time
   *                             updatedAt:
   *                               type: string
   *                               format: date-time
   *                 total:
   *                   type: integer
   *                   description: Total number of competitions
   *                 pagination:
   *                   type: object
   *                   properties:
   *                     limit:
   *                       type: integer
   *                     offset:
   *                       type: integer
   *                     total:
   *                       type: integer
   *       400:
   *         description: Invalid query parameters
   *       401:
   *         description: User not authenticated
   *       500:
   *         description: Internal server error
   */
  router.get("/competitions", userController.getCompetitions);

  /**
   * @openapi
   * /api/user/subscribe:
   *   post:
   *     summary: Subscribe to Loops mailing list
   *     description: Subscribe the authenticated user to the Loops mailing list
   *     tags:
   *       - User
   *     security:
   *       - PrivyCookie: []
   *     responses:
   *       200:
   *         description: User subscribed to Loops mailing list successfully, or already subscribed
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 userId:
   *                   type: string
   *                   format: uuid
   *                 isSubscribed:
   *                   type: boolean
   *                   example: true
   *       401:
   *         description: User not authenticated
   *       404:
   *         description: User not found
   *       500:
   *         description: Internal server error
   *       502:
   *         description: Failed to subscribe user to mailing list
   */
  router.post("/subscribe", userController.subscribe);
  /**
   *
   * @openapi
   * /api/user/unsubscribe:
   *   post:
   *     summary: Unsubscribe from Loops mailing list
   *     description: Unsubscribe the authenticated user from the Loops mailing list
   *     tags:
   *       - User
   *     security:
   *       - PrivyCookie: []
   *     responses:
   *       200:
   *         description: User unsubscribed from Loops mailing list successfully, or already unsubscribed
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 userId:
   *                   type: string
   *                   format: uuid
   *                 isSubscribed:
   *                   type: boolean
   *                   example: false
   *       401:
   *         description: User not authenticated
   *       404:
   *         description: User not found
   *       500:
   *         description: Internal server error
   *       502:
   *         description: Failed to unsubscribe user from mailing list
   */
  router.post("/unsubscribe", userController.unsubscribe);

  /**
   * @openapi
   * /api/user/rewards/total:
   *   get:
   *     summary: Get total claimable rewards for the authenticated user
   *     description: |
   *       Retrieves the total amount of unclaimed rewards for the authenticated user's wallet address.
   *       This endpoint sums all non-claimed rewards from the rewards table for the user's address.
   *       Users should have one rewards entry per competition.
   *     tags:
   *       - User
   *     security:
   *       - SIWESession: []
   *     responses:
   *       200:
   *         description: Total claimable rewards retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 address:
   *                   type: string
   *                   description: The authenticated user's wallet address
   *                   example: "0x1234567890abcdef1234567890abcdef12345678"
   *                 totalClaimableRewards:
   *                   type: string
   *                   description: The total amount of unclaimed rewards as a string (to handle large numbers)
   *                   example: "1000000000000000000"
   *       400:
   *         description: Invalid request parameters
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 error:
   *                   type: string
   *             examples:
   *               missing_address:
   *                 value:
   *                   success: false
   *                   error: "Invalid request format: address is required"
   *               invalid_format:
   *                 value:
   *                   success: false
   *                   error: "Invalid request format: Invalid Ethereum address format"
   *       401:
   *         description: User not authenticated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 error:
   *                   type: string
   *             example:
   *               success: false
   *               error: "User not authenticated"
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 error:
   *                   type: string
   *             example:
   *               success: false
   *               error: "Internal server error"
   */
  router.get("/rewards/total", rewardsController.getTotalClaimableRewards);

  /**
   * @openapi
   * /api/user/rewards/proofs:
   *   get:
   *     summary: Get rewards with proofs for the authenticated user
   *     description: |
   *       Retrieves all unclaimed rewards for the authenticated user's wallet address along with their Merkle proofs.
   *       Each reward includes the merkle root (encoded in Hex), the amount (as string), and the proof (encoded in Hex).
   *       This endpoint is used for claiming rewards on-chain.
   *     tags:
   *       - User
   *     security:
   *       - SIWESession: []
   *     responses:
   *       200:
   *         description: Rewards with proofs retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 address:
   *                   type: string
   *                   description: The authenticated user's wallet address
   *                   example: "0x1234567890abcdef1234567890abcdef12345678"
   *                 rewards:
   *                   type: array
   *                   description: Array of rewards with their proofs
   *                   items:
   *                     type: object
   *                     properties:
   *                       merkleRoot:
   *                         type: string
   *                         description: The Merkle root hash encoded in Hex
   *                         example: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12"
   *                       amount:
   *                         type: string
   *                         description: The reward amount as a string (to handle large numbers)
   *                         example: "1000000000000000000"
   *                       proof:
   *                         type: array
   *                         description: Array of proof hashes encoded in Hex
   *                         items:
   *                           type: string
   *                           example: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
   *       400:
   *         description: Invalid request parameters
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 error:
   *                   type: string
   *             examples:
   *               missing_address:
   *                 value:
   *                   success: false
   *                   error: "Invalid request format: address is required"
   *               invalid_format:
   *                 value:
   *                   success: false
   *                   error: "Invalid request format: Invalid Ethereum address format"
   *       401:
   *         description: User not authenticated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 error:
   *                   type: string
   *             example:
   *               success: false
   *               error: "User not authenticated"
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 error:
   *                   type: string
   *             example:
   *               success: false
   *               error: "Internal server error"
   */
  router.get("/rewards/proofs", rewardsController.getRewardsWithProofs);

  return router;
}
