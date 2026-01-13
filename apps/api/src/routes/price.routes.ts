import { RequestHandler, Router } from "express";

import { PriceController } from "@/controllers/price.controller.js";

export function configurePriceRoutes(
  controller: PriceController,
  ...middlewares: RequestHandler[]
) {
  const router = Router();

  if (middlewares.length) {
    router.use(...middlewares);
  }

  /**
   * @openapi
   * /api/price:
   *   get:
   *     tags:
   *       - Price
   *     summary: Get price for a token
   *     description: Get the current price of a specified token
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: token
   *         schema:
   *           type: string
   *         required: true
   *         description: Token address
   *         example: So11111111111111111111111111111111111111112
   *       - in: query
   *         name: chain
   *         schema:
   *           type: string
   *           enum: [evm, svm]
   *         required: false
   *         description: Blockchain type of the token
   *         example: svm
   *       - in: query
   *         name: specificChain
   *         schema:
   *           type: string
   *           enum: [eth, polygon, arbitrum, optimism, avalanche, base, linea, zksync, scroll, mantle, svm]
   *         required: false
   *         description: Specific chain for EVM tokens
   *         example: eth
   *     responses:
   *       200:
   *         description: Token price information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Whether the price was successfully retrieved
   *                 price:
   *                   type: number
   *                   nullable: true
   *                   description: Current price of the token in USD
   *                 token:
   *                   type: string
   *                   description: Token address
   *                 chain:
   *                   type: string
   *                   enum: [evm, svm]
   *                   description: Blockchain type of the token
   *                 specificChain:
   *                   type: string
   *                   nullable: true
   *                   description: Specific chain for EVM tokens
   *                 symbol:
   *                   type: string
   *                   description: Token symbol
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                   description: Timestamp when the price was fetched
   *       400:
   *         description: Invalid request parameters
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *       500:
   *         description: Server error
   */
  router.get("/", controller.getPrice);

  return router;
}
