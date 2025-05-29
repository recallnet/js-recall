import { Router } from "express";

import { UserController } from "@/controllers/user.controller.js";

/**
 * Configure User Routes
 * Handles user-specific operations with SIWE session authentication
 * All routes require req.userId to be set by authentication middleware
 */
export function configureUserRoutes(userController: UserController): Router {
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

  return router;
}
