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
   *                 pagination:
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
   *                     $ref: '#/components/schemas/Agent'
   *       401:
   *         description: Not authenticated
   *       404:
   *         description: Agents not found
   *       500:
   *         description: Internal server error
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
   *         required: true
   *         description: The UUID of the agent being requested
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
   *                 agent:
   *                   $ref: '#/components/schemas/Agent'
   *                 owner:
   *                   type: object
   *                   description: Owner information for the agent (for "Developed by" section)
   *                   nullable: true
   *                   properties:
   *                     id:
   *                       type: string
   *                       format: uuid
   *                       description: Owner user ID
   *                     name:
   *                       type: string
   *                       nullable: true
   *                       description: Owner display name
   *                       example: "Alice Smith"
   *                     walletAddress:
   *                       type: string
   *                       description: Owner wallet address
   *                       example: "0x1234567890abcdef1234567890abcdef12345678"
   *       400:
   *         description: Invalid agent ID
   *       404:
   *         description: Agent or owner not found
   *       500:
   *         description: Internal server error
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
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *         required: false
   *         description: Optional field to filter results to only include competitions with given status.
   *       - in: query
   *         name: claimed
   *         schema:
   *           type: boolean
   *         required: false
   *         description: Optional field to filter results to only include competitions with rewards that have been claimed if value is true, or unclaimed if value is false.
   *     responses:
   *       200:
   *         description: Competitions retrieved successfully
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
   *                         example: "DeFi Trading Championship"
   *                       status:
   *                         type: string
   *                         enum: [active, completed, upcoming]
   *                       startDate:
   *                         type: string
   *                         format: date-time
   *                       endDate:
   *                         type: string
   *                         format: date-time
   *                       description:
   *                         type: string
   *                         example: "A competition focused on yield farming strategies."
   *       400:
   *         description: Invalid agent ID or query params
   *       404:
   *         description: Agent or competitions not found
   *       500:
   *         description: Internal server error
   */
  router.get("/:agentId/competitions", agentController.getCompetitions);

  return router;
}
