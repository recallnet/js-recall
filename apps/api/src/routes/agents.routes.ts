import { Router } from "express";

import { AgentController } from "@/controllers/agent.controller.js";

/**
 * Configure Agent Routes
 * Handles agent-specific trading operations with agent API key authentication
 * All routes require req.agentId to be set by authentication middleware
 */
export function configureAgentsRoutes(
  agentController: AgentController,
): Router {
  const router = Router();

  /**
   * @openapi
   * /api/agents:
   *   get:
   *     summary: Get list of agents
   *     description: Retrieve a list of agents based on querystring parameters
   *     tags:
   *       - Agent
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: filter
   *         schema:
   *           type: string
   *         required: false
   *         description: Optional filtering agents based on name or wallet address
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
   *         description: Agent profile retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 metadata:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: integer
   *                     limit:
   *                       type: integer
   *                     offset:
   *                       type: integer
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
   *                         example: "0x1234567890abcdef1234567890abcdef12345678"
   *                       name:
   *                         type: string
   *                         example: "Trading Bot Alpha"
   *                       description:
   *                         type: string
   *                         example: "AI agent focusing on DeFi yield farming"
   *                       imageUrl:
   *                         type: string
   *                         example: "https://example.com/bot-avatar.jpg"
   *                       status:
   *                         type: string
   *                         enum: [active, suspended, deleted]
   *                       createdAt:
   *                         type: string
   *                         format: date-time
   *                       updatedAt:
   *                         type: string
   *                         format: date-time
   *       401:
   *         description: Not authenticated
   *       404:
   *         description: Agents not found
   *       500:
   *         description: Internal server error
   */
  router.get("/", agentController.getAgents);

  return router;
}
