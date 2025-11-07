import { RequestHandler, Router } from "express";

import { TradeController } from "@/controllers/trade.controller.js";

export function configureTradeRoutes(
  controller: TradeController,
  ...middlewares: RequestHandler[]
) {
  const router: Router = Router();

  if (middlewares.length) {
    router.use(...middlewares);
  }

  /**
   * @openapi
   * /api/trade/execute:
   *   post:
   *     tags:
   *       - Trade
   *     summary: Execute a trade (Paper Trading Only)
   *     description: Execute a trade between two tokens. Only available during paper trading competitions.
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - fromToken
   *               - toToken
   *               - amount
   *               - reason
   *               - competitionId
   *             properties:
   *               fromToken:
   *                 type: string
   *                 description: Token address to sell
   *                 example: "So11111111111111111111111111111111111111112"
   *               toToken:
   *                 type: string
   *                 description: Token address to buy
   *                 example: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
   *               amount:
   *                 type: string
   *                 description: Amount of fromToken to trade
   *                 example: "1.5"
   *               reason:
   *                 type: string
   *                 description: Reason for executing this trade
   *                 example: "Strong upward momentum in the market combined with positive news on this token's ecosystem growth."
   *               competitionId:
   *                 type: string
   *                 description: Competition ID
   *                 example: "comp_12345"
   *               slippageTolerance:
   *                 type: string
   *                 description: Optional slippage tolerance in percentage
   *                 example: "0.5"
   *               fromChain:
   *                 type: string
   *                 description: Optional - Blockchain type for fromToken
   *                 example: "svm"
   *               fromSpecificChain:
   *                 type: string
   *                 description: Optional - Specific chain for fromToken
   *                 example: "mainnet"
   *               toChain:
   *                 type: string
   *                 description: Optional - Blockchain type for toToken
   *                 example: "svm"
   *               toSpecificChain:
   *                 type: string
   *                 description: Optional - Specific chain for toToken
   *                 example: "mainnet"
   *     responses:
   *       200:
   *         description: Trade executed successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Whether the trade was successfully executed
   *                 transaction:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Unique trade ID
   *                     agentId:
   *                       type: string
   *                       description: Agent ID that executed the trade
   *                     competitionId:
   *                       type: string
   *                       description: ID of the competition this trade is part of
   *                     fromToken:
   *                       type: string
   *                       description: Token address that was sold
   *                     toToken:
   *                       type: string
   *                       description: Token address that was bought
   *                     fromAmount:
   *                       type: number
   *                       description: Amount of fromToken that was sold
   *                     toAmount:
   *                       type: number
   *                       description: Amount of toToken that was received
   *                     price:
   *                       type: number
   *                       description: Price at which the trade was executed
   *                     success:
   *                       type: boolean
   *                       description: Whether the trade was successfully completed
   *                     error:
   *                       type: string
   *                       nullable: true
   *                       description: Error message if the trade failed
   *                     reason:
   *                       type: string
   *                       description: Reason provided for executing the trade
   *                     tradeAmountUsd:
   *                       type: number
   *                       description: The USD value of the trade at execution time
   *                     timestamp:
   *                       type: string
   *                       format: date-time
   *                       description: Timestamp of when the trade was executed
   *                     fromChain:
   *                       type: string
   *                       description: Blockchain type of the source token
   *                     toChain:
   *                       type: string
   *                       description: Blockchain type of the destination token
   *                     fromSpecificChain:
   *                       type: string
   *                       description: Specific chain for the source token
   *                     toSpecificChain:
   *                       type: string
   *                       description: Specific chain for the destination token
   *                     toTokenSymbol:
   *                       type: string
   *                       description: Symbol of the destination token
   *                     fromTokenSymbol:
   *                       type: string
   *                       description: Symbol of the source token
   *       400:
   *         description: Invalid input parameters or endpoint not available for perpetual futures competitions
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
   *                   example: "This endpoint is not available for perpetual futures competitions. Perpetual futures positions are managed through Symphony, not through this API."
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *       403:
   *         description: Forbidden - Competition not in progress or other restrictions
   *       500:
   *         description: Server error
   */
  router.post("/execute", controller.executeTrade);

  /**
   * @openapi
   * /api/trade/quote:
   *   get:
   *     tags:
   *       - Trade
   *     summary: Get a quote for a trade (Paper Trading Only)
   *     description: Get a quote for a potential trade between two tokens. Only available during paper trading competitions.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: competitionId
   *         schema:
   *           type: string
   *         required: true
   *         description: Competition ID to get quote for
   *         example: comp_12345
   *       - in: query
   *         name: fromToken
   *         schema:
   *           type: string
   *         required: true
   *         description: Token address to sell
   *         example: So11111111111111111111111111111111111111112
   *       - in: query
   *         name: toToken
   *         schema:
   *           type: string
   *         required: true
   *         description: Token address to buy
   *         example: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
   *       - in: query
   *         name: amount
   *         schema:
   *           type: string
   *         required: true
   *         description: Amount of fromToken to get quote for
   *         example: 1.5
   *       - in: query
   *         name: fromChain
   *         schema:
   *           type: string
   *         required: false
   *         description: Optional blockchain type for fromToken
   *         example: svm
   *       - in: query
   *         name: fromSpecificChain
   *         schema:
   *           type: string
   *         required: false
   *         description: Optional specific chain for fromToken
   *         example: mainnet
   *       - in: query
   *         name: toChain
   *         schema:
   *           type: string
   *         required: false
   *         description: Optional blockchain type for toToken
   *         example: svm
   *       - in: query
   *         name: toSpecificChain
   *         schema:
   *           type: string
   *         required: false
   *         description: Optional specific chain for toToken
   *         example: mainnet
   *     responses:
   *       200:
   *         description: Quote generated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 fromToken:
   *                   type: string
   *                   description: Token address being sold
   *                 toToken:
   *                   type: string
   *                   description: Token address being bought
   *                 fromAmount:
   *                   type: number
   *                   description: Amount of fromToken to be sold
   *                 toAmount:
   *                   type: number
   *                   description: Estimated amount of toToken to be received
   *                 exchangeRate:
   *                   type: number
   *                   description: Exchange rate between the tokens (toAmount / fromAmount)
   *                 slippage:
   *                   type: number
   *                   description: Applied slippage percentage for this trade size
   *                 tradeAmountUsd:
   *                   type: number
   *                   description: Estimated USD value of the trade
   *                 prices:
   *                   type: object
   *                   properties:
   *                     fromToken:
   *                       type: number
   *                       description: Price of the source token in USD
   *                     toToken:
   *                       type: number
   *                       description: Price of the destination token in USD
   *                 symbols:
   *                   type: object
   *                   properties:
   *                     fromTokenSymbol:
   *                       type: string
   *                       description: Symbol of the source token
   *                     toTokenSymbol:
   *                       type: string
   *                       description: Symbol of the destination token
   *                 chains:
   *                   type: object
   *                   properties:
   *                     fromChain:
   *                       type: string
   *                       description: Blockchain type of the source token
   *                     toChain:
   *                       type: string
   *                       description: Blockchain type of the destination token
   *       400:
   *         description: Invalid input parameters or endpoint not available for perpetual futures competitions
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
   *                   example: "This endpoint is not available for perpetual futures competitions. Perpetual futures positions are managed through Symphony, not through this API."
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *       500:
   *         description: Server error
   */
  router.get("/quote", controller.getQuote);

  return router;
}
