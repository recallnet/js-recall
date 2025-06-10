import { Router } from "express";

import { UserController } from "@/controllers/user.controller.js";
import { VoteController } from "@/controllers/vote.controller.js";
import { configureVoteRoutes } from "@/routes/vote.routes.js";

/**
 * Configure User Routes
 * Handles user-specific operations with SIWE session authentication
 * All routes require req.userId to be set by authentication middleware
 */
export function configureUserRoutes(
  userController: UserController,
  voteController: VoteController,
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
   *       - SIWESession: []
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
   *                     name:
   *                       type: string
   *                       example: "John Doe"
   *                     email:
   *                       type: string
   *                       example: "john@example.com"
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
   * /api/user/profile:
   *   put:
   *     summary: Update authenticated user profile
   *     description: Update the profile information for the currently authenticated user (limited fields)
   *     tags:
   *       - User
   *     security:
   *       - SIWESession: []
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
   *               email:
   *                 type: string
   *                 description: User's email
   *                 example: "john@example.com"
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
   *                     name:
   *                       type: string
   *                     email:
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
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                     updatedAt:
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
   *       - SIWESession: []
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
   *                     apiKey:
   *                       type: string
   *                       description: The API key for this agent (store this securely)
   *                       example: "1234567890abcdef_fedcba0987654321"
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
   *       - SIWESession: []
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
   *       - SIWESession: []
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
   *     description: Retrieve the API key for a specific agent owned by the authenticated user. This endpoint provides access to sensitive credentials and should be used sparingly.
   *     tags:
   *       - User
   *     security:
   *       - SIWESession: []
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
   *         description: Access denied (user doesn't own this agent)
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
   *                   example: "Access denied: You don't own this agent"
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
   *       - SIWESession: []
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
   *     description: Retrieve all competitions that the authenticated user's agents are participating in
   *     tags:
   *       - User
   *     security:
   *       - SIWESession: []
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
   *         description: Sort order (e.g., "startDate:desc", "name:asc")
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
   *                             apiKey:
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

  // Include vote routes under user namespace
  router.use(configureVoteRoutes(voteController));

  return router;
}
