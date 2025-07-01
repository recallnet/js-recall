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
   *     summary: Execute a trade
   *     description: Execute a trade between two tokens
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
   *               slippageTolerance:
   *                 type: string
   *                 description: Optional slippage tolerance in percentage
   *                 example: "0.5"
   *               fromChain:
   *                 $ref: '#/components/schemas/BlockchainType'
   *               fromSpecificChain:
   *                 $ref: '#/components/schemas/SpecificChain'
   *               toChain:
   *                 $ref: '#/components/schemas/BlockchainType'
   *               toSpecificChain:
   *                 $ref: '#/components/schemas/SpecificChain'
   *     responses:
   *       200:
   *         description: Trade executed successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   required: [transaction]
   *                   properties:
   *                     transaction:
   *                       $ref: '#/components/schemas/Trade'
   *       400:
   *         description: Invalid input parameters
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
   *       403:
   *         description: Forbidden - Competition not in progress or other restrictions
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
  router.post("/execute", controller.executeTrade);

  /**
   * @openapi
   * /api/trade/quote:
   *   get:
   *     tags:
   *       - Trade
   *     summary: Get a quote for a trade
   *     description: Get a quote for a potential trade between two tokens
   *     security:
   *       - BearerAuth: []
   *     parameters:
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
   *           $ref: '#/components/schemas/BlockchainType'
   *         required: false
   *         description: Optional blockchain type for fromToken
   *       - in: query
   *         name: fromSpecificChain
   *         schema:
   *           $ref: '#/components/schemas/SpecificChain'
   *         required: false
   *         description: Optional specific chain for fromToken
   *       - in: query
   *         name: toChain
   *         schema:
   *           $ref: '#/components/schemas/BlockchainType'
   *         required: false
   *         description: Optional blockchain type for toToken
   *       - in: query
   *         name: toSpecificChain
   *         schema:
   *           $ref: '#/components/schemas/SpecificChain'
   *         required: false
   *         description: Optional specific chain for toToken
   *     responses:
   *       200:
   *         description: Quote generated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [fromToken, toToken, fromAmount, toAmount, exchangeRate, slippage, tradeAmountUsd, prices, symbols, chains]
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
   *                   required: [fromToken, toToken]
   *                   properties:
   *                     fromToken:
   *                       type: number
   *                       description: Price of the source token in USD
   *                     toToken:
   *                       type: number
   *                       description: Price of the destination token in USD
   *                 symbols:
   *                   type: object
   *                   required: [fromTokenSymbol, toTokenSymbol]
   *                   properties:
   *                     fromTokenSymbol:
   *                       type: string
   *                       description: Symbol of the source token
   *                     toTokenSymbol:
   *                       type: string
   *                       description: Symbol of the destination token
   *                 chains:
   *                   type: object
   *                   required: [fromChain, toChain]
   *                   properties:
   *                     fromChain:
   *                       $ref: '#/components/schemas/BlockchainType'
   *                     toChain:
   *                       $ref: '#/components/schemas/BlockchainType'
   *       400:
   *         description: Invalid input parameters
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
  router.get("/quote", controller.getQuote);

  return router;
}
