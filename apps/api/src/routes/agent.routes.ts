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
   *                     isVerified:
   *                       type: boolean
   *                     name:
   *                       type: string
   *                       example: "Trading Bot Alpha"
   *                     handle:
   *                       type: string
   *                       example: "trading-bot-alpha"
   *                     description:
   *                       type: string
   *                       example: "AI agent focusing on DeFi yield farming"
   *                     imageUrl:
   *                       type: string
   *                       example: "https://example.com/bot-avatar.jpg"
   *                       nullable: true
   *                     email:
   *                       type: string
   *                       example: "tradingbot@example.com"
   *                       nullable: true
   *                     status:
   *                       type: string
   *                       enum: [active, inactive, suspended, deleted]
   *                     metadata:
   *                       type: object
   *                       description: Optional metadata for the agent
   *                       example: { "strategy": "yield-farming", "risk": "medium" }
   *                       nullable: true
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
   *                     handle:
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
   *                     isVerified:
   *                       type: boolean
   *                     name:
   *                       type: string
   *                     handle:
   *                       type: string
   *                     description:
   *                       type: string
   *                       nullable: true
   *                     imageUrl:
   *                       type: string
   *                       nullable: true
   *                     email:
   *                       type: string
   *                       nullable: true
   *                     status:
   *                       type: string
   *                     metadata:
   *                       type: object
   *                       nullable: true
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *       400:
   *         description: Invalid fields provided (agents can only update description and imageUrl)
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
   *     description: Retrieve all token balances with current prices for the authenticated agent. Available for paper trading and spot live trading competitions.
   *     tags:
   *       - Agent
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: competitionId
   *         schema:
   *           type: string
   *         required: true
   *         description: Competition ID to retrieve balances for
   *         example: comp_12345
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
   *                       price:
   *                         type: number
   *                         description: Current token price in USD
   *                         example: 1.0
   *                       value:
   *                         type: number
   *                         description: Token value in USD (amount * price)
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
   *       400:
   *         description: Bad Request - Endpoint not available for perpetual futures competitions
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
   *                   example: "This endpoint is not available for perpetual futures competitions. Use GET /api/agent/perps/account for account summary."
   *       401:
   *         description: Agent not authenticated
   *       500:
   *         description: Internal server error
   */
  router.get("/balances", agentController.getBalances);

  /**
   * @openapi
   * /api/agent/trades:
   *   get:
   *     summary: Get agent trade history
   *     description: Retrieve the trading history for the authenticated agent. Available for paper trading and spot live trading competitions.
   *     tags:
   *       - Agent
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: competitionId
   *         schema:
   *           type: string
   *         required: true
   *         description: Competition ID to retrieve trade history for
   *         example: comp_12345
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
   *                       fromTokenSymbol:
   *                         type: string
   *                         description: Symbol of the source token
   *                         example: "SOL"
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
   *       400:
   *         description: Bad Request - Endpoint not available for perpetual futures competitions
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
   *                   example: "This endpoint is not available for perpetual futures competitions. Use GET /api/agent/perps/positions for current positions."
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

  /**
   * @openapi
   * /api/agent/perps/positions:
   *   get:
   *     summary: Get perps positions for the authenticated agent
   *     description: Returns current perpetual futures positions for the authenticated agent in the specified competition
   *     tags:
   *       - Agent
   *       - Perpetual Futures
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: competitionId
   *         schema:
   *           type: string
   *         required: true
   *         description: Competition ID to retrieve positions for
   *         example: comp_12345
   *     responses:
   *       200:
   *         description: Positions retrieved successfully
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
   *                 competitionId:
   *                   type: string
   *                   format: uuid
   *                 positions:
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
   *                       positionId:
   *                         type: string
   *                         nullable: true
   *                         description: Provider-specific position ID
   *                       marketId:
   *                         type: string
   *                         nullable: true
   *                         description: Market identifier
   *                       marketSymbol:
   *                         type: string
   *                         nullable: true
   *                         example: "BTC"
   *                       asset:
   *                         type: string
   *                         description: Asset symbol
   *                         example: "BTC"
   *                       isLong:
   *                         type: boolean
   *                         description: Whether position is long (true) or short (false)
   *                         example: true
   *                       leverage:
   *                         type: number
   *                         nullable: true
   *                         description: Position leverage (null for positions recovered from fills)
   *                         example: 10
   *                       size:
   *                         type: number
   *                         description: Position size
   *                         example: 0.5
   *                       collateral:
   *                         type: number
   *                         nullable: true
   *                         description: Collateral amount (null for positions recovered from fills)
   *                         example: 2250
   *                       averagePrice:
   *                         type: number
   *                         nullable: true
   *                         description: Entry price (null for positions recovered from fills)
   *                         example: 45000
   *                       markPrice:
   *                         type: number
   *                         description: Current mark price
   *                         example: 46000
   *                       liquidationPrice:
   *                         type: number
   *                         nullable: true
   *                         description: Liquidation price
   *                         example: 40000
   *                       unrealizedPnl:
   *                         type: number
   *                         description: Unrealized PnL
   *                         example: 500
   *                       pnlPercentage:
   *                         type: number
   *                         nullable: true
   *                         description: PnL as percentage (null for positions recovered from fills)
   *                         example: 0.05
   *                       realizedPnl:
   *                         type: number
   *                         description: Realized PnL (always 0 in current implementation)
   *                         example: 0
   *                       status:
   *                         type: string
   *                         description: Position status
   *                         example: "Open"
   *                       openedAt:
   *                         type: string
   *                         format: date-time
   *                         description: Position open timestamp
   *                       closedAt:
   *                         type: string
   *                         format: date-time
   *                         nullable: true
   *                         description: Position close timestamp (null if open)
   *                       timestamp:
   *                         type: string
   *                         format: date-time
   *                         description: Last update timestamp
   *       400:
   *         description: Not a perpetual futures competition
   *       401:
   *         description: Agent not authenticated
   *       403:
   *         description: Agent not registered in competition
   *       404:
   *         description: No active competition found
   *       500:
   *         description: Internal server error
   */
  router.get("/perps/positions", agentController.getPerpsPositions);

  /**
   * @openapi
   * /api/agent/perps/account:
   *   get:
   *     summary: Get perps account summary for the authenticated agent
   *     description: Returns the perpetual futures account summary including equity, PnL, and statistics
   *     tags:
   *       - Agent
   *       - Perpetual Futures
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: competitionId
   *         schema:
   *           type: string
   *         required: true
   *         description: Competition ID to retrieve account summary for
   *         example: comp_12345
   *     responses:
   *       200:
   *         description: Account summary retrieved successfully
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
   *                 competitionId:
   *                   type: string
   *                   format: uuid
   *                 account:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       format: uuid
   *                     agentId:
   *                       type: string
   *                       format: uuid
   *                     competitionId:
   *                       type: string
   *                       format: uuid
   *                     accountId:
   *                       type: string
   *                       description: Provider-specific account ID
   *                     totalEquity:
   *                       type: string
   *                       example: "520.50"
   *                     availableBalance:
   *                       type: string
   *                       example: "300.00"
   *                     marginUsed:
   *                       type: string
   *                       example: "220.50"
   *                     totalPnl:
   *                       type: string
   *                       example: "20.50"
   *                     totalVolume:
   *                       type: string
   *                       example: "15000.00"
   *                     openPositions:
   *                       type: integer
   *                       example: 3
   *                     timestamp:
   *                       type: string
   *                       format: date-time
   *       400:
   *         description: Not a perpetual futures competition
   *       401:
   *         description: Agent not authenticated
   *       403:
   *         description: Agent not registered in competition
   *       404:
   *         description: No active competition found
   *       500:
   *         description: Internal server error
   */
  router.get("/perps/account", agentController.getPerpsAccount);

  return router;
}
