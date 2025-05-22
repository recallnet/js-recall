import { RequestHandler, Router } from "express";

import { AuthController } from "@/controllers/auth.controller.js";

export function configureAuthRoutes(
  controller: AuthController,
  ...middlewares: RequestHandler[]
) {
  const router = Router();

  if (middlewares.length) {
    router.use(...middlewares);
  }

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
   * /api/auth/login:
   *   post:
   *     summary: Verify SIWE signature and create a session
   *     description: Verifies the SIWE message and signature, creates a session, and returns team info
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
   *                 - teamId
   *                 - wallet
   *               properties:
   *                 teamId:
   *                   type: string
   *                   nullable: true
   *                   description: The ID of the authenticated team
   *                   example: "team_123abc"
   *                 wallet:
   *                   type: string
   *                   description: The wallet address of the authenticated team
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
