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
   *       - Agents
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
   *         description: |
   *           Optional field(s) to sort by. Supports single or multiple fields separated by commas.
   *           Prefix with '-' for descending order (e.g., '-name' or 'name,-createdAt').
   *           Available fields: id, ownerId, walletAddress, name, description, imageUrl, status, createdAt, updatedAt.
   *           When not specified, results are returned in database order.
   *         examples:
   *           single_asc:
   *             value: "name"
   *             summary: "Sort by name ascending"
   *           single_desc:
   *             value: "-createdAt"
   *             summary: "Sort by creation date descending (newest first)"
   *           multi_field:
   *             value: "status,-createdAt"
   *             summary: "Sort by status ascending, then by creation date descending"
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
   *         description: Agents retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [agents, pagination]
   *                   properties:
   *                     agents:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/AgentPublic'
   *                     pagination:
   *                       $ref: '#/components/schemas/PaginationMeta'
   *       400:
   *         description: Invalid request parameters
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
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get("/", agentController.getAgents);

  /**
   * @openapi
   * /api/agents/{agentId}:
   *   get:
   *     summary: Get agent by ID
   *     description: Retrieve the information for the given agent ID including owner information
   *     tags:
   *       - Agents
   *     parameters:
   *       - in: path
   *         name: agentId
   *         schema:
   *           type: string
   *           format: uuid
   *         required: true
   *         description: The UUID of the agent being requested
   *     responses:
   *       200:
   *         description: Agent profile retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [agent]
   *                   properties:
   *                     agent:
   *                       $ref: '#/components/schemas/AgentWithOwner'
   *       400:
   *         description: Invalid agent ID format
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
  router.get("/:agentId", agentController.getAgent);

  /**
   * @openapi
   * /api/agents/{agentId}/competitions:
   *   get:
   *     summary: Get agent competitions
   *     description: Retrieve all competitions associated with the specified agent
   *     tags:
   *       - Agents
   *     parameters:
   *       - in: path
   *         name: agentId
   *         schema:
   *           type: string
   *           format: uuid
   *         required: true
   *         description: The UUID of the agent
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *         required: false
   *         description: |
   *           Optional field(s) to sort by. Supports single or multiple fields separated by commas.
   *           Prefix with '-' for descending order (e.g., '-name' or 'name,-createdAt').
   *           Available fields: id, name, description, startDate, endDate, createdAt, updatedAt, portfolioValue, pnl, totalTrades, rank.
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
   *       - in: query
   *         name: status
   *         schema:
   *           $ref: '#/components/schemas/CompetitionStatus'
   *         required: false
   *         description: Filter results to only include competitions with given status
   *       - in: query
   *         name: claimed
   *         schema:
   *           type: boolean
   *         required: false
   *         description: Filter results to only include competitions with claimed (true) or unclaimed (false) rewards
   *     responses:
   *       200:
   *         description: Competitions retrieved successfully
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
   *                         $ref: '#/components/schemas/EnhancedCompetition'
   *       400:
   *         description: Invalid agent ID or query parameters
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
  router.get("/:agentId/competitions", agentController.getCompetitions);

  return router;
}
