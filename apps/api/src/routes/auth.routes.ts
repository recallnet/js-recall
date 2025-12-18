import { RequestHandler, Router } from "express";

import { AuthController } from "@/controllers/auth.controller.js";

export function configureAuthRoutes(
  controller: AuthController,
  authMiddleware: RequestHandler,
) {
  const router = Router();

  // Apply auth middleware to all routes by default
  router.use(authMiddleware);

  /**
   * @openapi
   * /api/auth/agent/nonce:
   *   get:
   *     summary: Get a random nonce for agent wallet verification
   *     description: |
   *       Generates a new nonce for agent wallet verification. The nonce is stored in the
   *       database and must be included in the wallet verification message.
   *
   *       Requires agent authentication via API key.
   *     tags: [Auth]
   *     security:
   *       - AgentApiKey: []
   *     responses:
   *       200:
   *         description: Agent nonce generated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required:
   *                 - nonce
   *               properties:
   *                 nonce:
   *                   type: string
   *                   description: The nonce to be used in agent wallet verification
   *                   example: "8J0eXAiOiJ..."
   *       401:
   *         description: Agent authentication required
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   */
  router.get("/agent/nonce", controller.getAgentNonce);

  /**
   * @openapi
   * /api/auth/verify:
   *   post:
   *     summary: Verify agent wallet ownership
   *     description: Verify wallet ownership for an authenticated agent via custom message signature
   *     tags: [Auth]
   *     security:
   *       - AgentApiKey: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - message
   *               - signature
   *             properties:
   *               message:
   *                 type: string
   *                 description: The verification message to be signed
   *                 example: |
   *                   VERIFY_WALLET_OWNERSHIP
   *                   Timestamp: 2024-01-15T10:30:00.000Z
   *                   Domain: api.competitions.recall.network
   *                   Purpose: WALLET_VERIFICATION
   *               signature:
   *                 type: string
   *                 description: The signature of the verification message
   *                 example: "0x123abc..."
   *     responses:
   *       200:
   *         description: Wallet verification successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 walletAddress:
   *                   type: string
   *                   description: The verified wallet address
   *                   example: "0x123..."
   *                 message:
   *                   type: string
   *                   example: "Wallet verified successfully"
   *       400:
   *         description: Invalid message format or signature verification failed
   *       401:
   *         description: Agent authentication required
   *       409:
   *         description: Wallet address already in use
   */
  router.post("/verify", controller.verifyAgentWallet);

  return router;
}
