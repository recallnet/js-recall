import { RequestHandler, Router } from "express";

import { AuthController } from "@/controllers/auth.controller.js";

export function configureAuthRoutes(
  controller: AuthController,
  sessionMiddleware: RequestHandler,
  agentAuthMiddleware: RequestHandler,
) {
  const router = Router();

  // Apply session middleware to all routes by default
  router.use(sessionMiddleware);

  /**
   * @openapi
   * /api/auth/nonce:
   *   get:
   *     summary: Get a random nonce for SIWE authentication
   *     description: Generates a new nonce and stores it in the session for SIWE message verification
   *     tags: [Auth]
   *     responses:
   *       200:
   *         description: A new nonce generated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required:
   *                 - nonce
   *               properties:
   *                 nonce:
   *                   type: string
   *                   description: The nonce to be used in the SIWE message
   *                   example: "8J0eXAiOiJ..."
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
  router.get("/nonce", controller.getNonce);

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
  router.get("/agent/nonce", agentAuthMiddleware, controller.getAgentNonce);

  /**
   * @openapi
   * /api/auth/login:
   *   post:
   *     summary: Verify SIWE signature and create a session
   *     description: Verifies the SIWE message and signature, creates a session, and returns agent info
   *     tags: [Auth]
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
   *                 description: The SIWE message to be verified
   *                 example: "service.example.com wants you to sign in with your Ethereum account:\n0x123...\n\nI accept the ServiceOrg Terms of Service: https://service.example.com/tos\n\nURI: https://service.example.com/login\nVersion: 1\nChain ID: 1\nNonce: 8J0eXAiOiJ...\nIssued At: 2023-01-01T00:00:00.000Z"
   *               signature:
   *                 type: string
   *                 description: The signature of the SIWE message
   *                 example: "0x123abc..."
   *     responses:
   *       200:
   *         description: Authentication successful, session created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required:
   *                 - agentId
   *                 - wallet
   *               properties:
   *                 agentId:
   *                   type: string
   *                   nullable: true
   *                   description: The ID of the authenticated agent
   *                   example: "agent_123abc"
   *                 wallet:
   *                   type: string
   *                   description: The wallet address of the authenticated agent
   *                   example: "0x123..."
   *       401:
   *         description: Authentication failed
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required:
   *                 - error
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Unauthorized: signature validation issues"
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
  router.post("/login", controller.login);

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
  router.post("/verify", agentAuthMiddleware, controller.verifyAgentWallet);

  /**
   * @openapi
   * /api/auth/logout:
   *   post:
   *     summary: Logout the current user by destroying the session
   *     description: Clears the session data and destroys the session cookie
   *     tags: [Auth]
   *     responses:
   *       200:
   *         description: Logout successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required:
   *                 - message
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Logged out successfully"
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
  router.post("/logout", controller.logout);

  return router;
}
