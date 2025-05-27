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
   *                       example: "0x1234567890abcdef1234567890abcdef12345678"
   *                     name:
   *                       type: string
   *                       example: "Trading Bot Alpha"
   *                     description:
   *                       type: string
   *                       example: "AI agent focusing on DeFi yield farming"
   *                     imageUrl:
   *                       type: string
   *                       example: "https://example.com/bot-avatar.jpg"
   *                     status:
   *                       type: string
   *                       enum: [active, suspended, deleted]
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *                 owner:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       format: uuid
   *                     walletAddress:
   *                       type: string
   *                     name:
   *                       type: string
   *                     email:
   *                       type: string
   *                     imageUrl:
   *                       type: string
   *       401:
   *         description: Agent not authenticated
   *       404:
   *         description: Agent or owner not found
   *       500:
   *         description: Internal server error
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
   *                     name:
   *                       type: string
   *                     description:
   *                       type: string
   *                     imageUrl:
   *                       type: string
   *                     status:
   *                       type: string
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *       400:
   *         description: Invalid fields provided (agents can only update name, description, and imageUrl)
   *       401:
   *         description: Agent not authenticated
   *       404:
   *         description: Agent not found
   *       500:
   *         description: Internal server error
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
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 agentId:
   *                   type: string
   *                   format: uuid
   *                 balances:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       tokenAddress:
   *                         type: string
   *                         example: "0x1234567890abcdef1234567890abcdef12345678"
   *                       amount:
   *                         type: number
   *                         example: 100.5
   *                       symbol:
   *                         type: string
   *                         example: "USDC"
   *                       chain:
   *                         type: string
   *                         enum: [evm, svm]
   *                       specificChain:
   *                         type: string
   *                         example: "svm"
   *       401:
   *         description: Agent not authenticated
   *       500:
   *         description: Internal server error
   */
  router.get("/balances", agentController.getBalances);

  /**
   * @openapi
   * /api/agent/portfolio:
   *   get:
   *     summary: Get agent portfolio
   *     description: Retrieve portfolio information including total value and token breakdown for the authenticated agent
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
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 agentId:
   *                   type: string
   *                   format: uuid
   *                 totalValue:
   *                   type: number
   *                   description: Total portfolio value in USD
   *                   example: 1250.75
   *                 tokens:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       token:
   *                         type: string
   *                         description: Token address
   *                         example: "0x1234567890abcdef1234567890abcdef12345678"
   *                       amount:
   *                         type: number
   *                         description: Token amount
   *                         example: 100.5
   *                       price:
   *                         type: number
   *                         description: Token price in USD
   *                         example: 1.0
   *                       value:
   *                         type: number
   *                         description: Token value in USD
   *                         example: 100.5
   *                       chain:
   *                         type: string
   *                         enum: [evm, svm]
   *                       specificChain:
   *                         type: string
   *                         example: "svm"
   *                       symbol:
   *                         type: string
   *                         example: "USDC"
   *                 source:
   *                   type: string
   *                   description: Data source (snapshot or live-calculation)
   *                   enum: [snapshot, live-calculation]
   *                 snapshotTime:
   *                   type: string
   *                   format: date-time
   *                   description: Time of snapshot (only present if source is snapshot)
   *       401:
   *         description: Agent not authenticated
   *       500:
   *         description: Internal server error
   */
  router.get("/portfolio", agentController.getPortfolio);

  /**
   * @openapi
   * /api/agent/trades:
   *   get:
   *     summary: Get agent trade history
   *     description: Retrieve the trading history for the authenticated agent
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
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 agentId:
   *                   type: string
   *                   format: uuid
   *                 trades:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         format: uuid
   *                       agentId:
   *                         type: string
   *                         format: uuid
   *                       competitionId:
   *                         type: string
   *                         format: uuid
   *                       fromToken:
   *                         type: string
   *                         description: Source token address
   *                       toToken:
   *                         type: string
   *                         description: Destination token address
   *                       fromAmount:
   *                         type: number
   *                         description: Amount traded from source token
   *                       toAmount:
   *                         type: number
   *                         description: Amount received in destination token
   *                       price:
   *                         type: number
   *                         description: Price at which the trade was executed
   *                       tradeAmountUsd:
   *                         type: number
   *                         description: USD value of the trade at execution time
   *                       toTokenSymbol:
   *                         type: string
   *                         description: Symbol of the destination token
   *                         example: "USDC"
   *                       success:
   *                         type: boolean
   *                         description: Whether the trade was successfully completed
   *                       error:
   *                         type: string
   *                         description: Error message if the trade failed
   *                         nullable: true
   *                       reason:
   *                         type: string
   *                         description: Reason for the trade
   *                       timestamp:
   *                         type: string
   *                         format: date-time
   *                         description: When the trade was executed
   *                       fromChain:
   *                         type: string
   *                         description: Blockchain type of the source token
   *                         example: "evm"
   *                       toChain:
   *                         type: string
   *                         description: Blockchain type of the destination token
   *                         example: "svm"
   *                       fromSpecificChain:
   *                         type: string
   *                         description: Specific chain for the source token
   *                         example: "polygon"
   *                         nullable: true
   *                       toSpecificChain:
   *                         type: string
   *                         description: Specific chain for the destination token
   *                         example: "svm"
   *                         nullable: true
   *       401:
   *         description: Agent not authenticated
   *       500:
   *         description: Internal server error
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
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 apiKey:
   *                   type: string
   *                   description: The new API key (store this securely)
   *                   example: "1234567890abcdef_fedcba0987654321"
   *       401:
   *         description: Agent not authenticated
   *       500:
   *         description: Internal server error
   */
  router.post("/reset-api-key", agentController.resetApiKey);

  return router;
}
