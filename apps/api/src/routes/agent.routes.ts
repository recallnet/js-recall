import { Router } from "express";

import { AgentController } from "@/controllers/agent.controller.js";

/**
 * Configure Agent Routes
 * Handles agent-specific trading operations with agent API key authentication
 * All routes require req.agentId to be set by authentication middleware
 */
export function configureAgentRoutes(agentController: AgentController): Router {
  const router = Router();

  /**
   * @openapi
   * /api/agent/profile:
   *   get:
   *     summary: Get authenticated agent profile
   *     description: Retrieve the profile information for the currently authenticated agent and its owner
   *     tags:
   *       - Agent
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Agent profile retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [agent, owner]
   *                   properties:
   *                     agent:
   *                       $ref: '#/components/schemas/AgentPublic'
   *                     owner:
   *                       $ref: '#/components/schemas/OwnerInfo'
   *       401:
   *         description: Agent not authenticated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: Agent or owner not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get("/profile", agentController.getProfile);

  /**
   * @openapi
   * /api/agent/profile:
   *   put:
   *     summary: Update authenticated agent profile
   *     description: Update the profile information for the currently authenticated agent (limited fields)
   *     tags:
   *       - Agent
   *     security:
   *       - BearerAuth: []
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
   *             additionalProperties: false
   *     responses:
   *       200:
   *         description: Agent profile updated successfully
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
   *         description: Invalid fields provided (agents can only update name, description, and imageUrl)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Agent not authenticated
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
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.put("/profile", agentController.updateProfile);

  /**
   * @openapi
   * /api/agent/balances:
   *   get:
   *     summary: Get agent balances
   *     description: Retrieve all token balances for the authenticated agent
   *     tags:
   *       - Agent
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Balances retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [agentId, balances]
   *                   properties:
   *                     agentId:
   *                       type: string
   *                       format: uuid
   *                       description: Agent ID
   *                     balances:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/Balance'
   *       401:
   *         description: Agent not authenticated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get("/balances", agentController.getBalances);

  /**
   * @openapi
   * /api/agent/portfolio:
   *   get:
   *     summary: Get agent portfolio
   *     description: |
   *       Retrieve portfolio information including total value and token breakdown for the authenticated agent.
   *       
   *       The response includes a `source` field that indicates how the portfolio was calculated:
   *       - `snapshot`: Data from a pre-calculated portfolio snapshot (faster, may be slightly outdated)
   *       - `live-calculation`: Real-time calculation based on current balances and prices (slower, always current)
   *       
   *       When `source` is `snapshot`, a `snapshotTime` field indicates when the snapshot was taken.
   *     tags:
   *       - Agent
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Portfolio retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Portfolio'
   *       401:
   *         description: Agent not authenticated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get("/portfolio", agentController.getPortfolio);

  /**
   * @openapi
   * /api/agent/trades:
   *   get:
   *     summary: Get agent trade history
   *     description: Retrieve the trading history for the authenticated agent, sorted by timestamp (newest first)
   *     tags:
   *       - Agent
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Trade history retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [agentId, trades]
   *                   properties:
   *                     agentId:
   *                       type: string
   *                       format: uuid
   *                       description: Agent ID
   *                     trades:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/Trade'
   *       401:
   *         description: Agent not authenticated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get("/trades", agentController.getTrades);

  /**
   * @openapi
   * /api/agent/reset-api-key:
   *   post:
   *     summary: Reset agent API key
   *     description: Generate a new API key for the authenticated agent (invalidates the current key)
   *     tags:
   *       - Agent
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: API key reset successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [apiKey]
   *                   properties:
   *                     apiKey:
   *                       type: string
   *                       description: The new API key (store this securely)
   *                       example: "1234567890abcdef_fedcba0987654321"
   *       401:
   *         description: Agent not authenticated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post("/reset-api-key", agentController.resetApiKey);

  return router;
}
