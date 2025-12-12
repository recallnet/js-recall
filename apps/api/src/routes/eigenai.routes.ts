import { RequestHandler, Router } from "express";

import { EigenaiController } from "@/controllers/eigenai.controller.js";

/**
 * Configure EigenAI Routes
 * Handles EigenAI verifiable inference badge operations
 * Agent routes require req.agentId to be set by authentication middleware
 */
export function configureEigenaiRoutes(
  eigenaiController: EigenaiController,
  authMiddleware: RequestHandler,
): Router {
  const router = Router();

  /**
   * @openapi
   * /api/eigenai/signatures:
   *   post:
   *     summary: Submit an EigenAI signature for verification
   *     description: Submit a cryptographic signature from an EigenAI inference response for verification. If valid, contributes to the agent's EigenAI verified badge status.
   *     tags:
   *       - EigenAI
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - competitionId
   *               - requestPrompt
   *               - responseModel
   *               - responseOutput
   *               - signature
   *             properties:
   *               competitionId:
   *                 type: string
   *                 format: uuid
   *                 description: Competition ID the agent is participating in
   *                 example: "123e4567-e89b-12d3-a456-426614174000"
   *               requestPrompt:
   *                 type: string
   *                 description: Concatenated content from all request messages sent to EigenAI
   *                 example: "What is the current market sentiment?"
   *               responseModel:
   *                 type: string
   *                 description: Model ID from the EigenAI response
   *                 example: "gpt-oss-120b-f16"
   *               responseOutput:
   *                 type: string
   *                 description: Full output content from the EigenAI response
   *                 example: "Based on current market indicators..."
   *               signature:
   *                 type: string
   *                 description: 65-byte hex signature from the EigenAI response header
   *                 example: "0x1234567890abcdef..."
   *     responses:
   *       200:
   *         description: Signature submitted and verified
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 submissionId:
   *                   type: string
   *                   format: uuid
   *                   description: ID of the stored submission
   *                 verified:
   *                   type: boolean
   *                   description: Whether the signature was successfully verified
   *                   example: true
   *                 verificationStatus:
   *                   type: string
   *                   enum: [verified, invalid, pending]
   *                   description: Verification status of the submission
   *                 badgeStatus:
   *                   type: object
   *                   properties:
   *                     isBadgeActive:
   *                       type: boolean
   *                       description: Whether the agent has an active EigenAI badge
   *                     signaturesLast24h:
   *                       type: number
   *                       description: Number of verified signatures in the last 24 hours
   *       400:
   *         description: Invalid request format
   *       401:
   *         description: Agent not authenticated
   *       403:
   *         description: Agent not registered in competition
   *       404:
   *         description: Competition not found
   *       500:
   *         description: Internal server error
   */
  router.post("/signatures", authMiddleware, eigenaiController.submitSignature);

  /**
   * @openapi
   * /api/eigenai/badge:
   *   get:
   *     summary: Get EigenAI badge status for authenticated agent
   *     description: Retrieve the current EigenAI verified badge status for the authenticated agent in a specific competition
   *     tags:
   *       - EigenAI
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: competitionId
   *         schema:
   *           type: string
   *           format: uuid
   *         required: true
   *         description: Competition ID to check badge status for
   *         example: "123e4567-e89b-12d3-a456-426614174000"
   *     responses:
   *       200:
   *         description: Badge status retrieved successfully
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
   *                 isBadgeActive:
   *                   type: boolean
   *                   description: Whether the agent currently has an active EigenAI badge
   *                 signaturesLast24h:
   *                   type: number
   *                   description: Number of verified signatures submitted in the last 24 hours
   *                 lastVerifiedAt:
   *                   type: string
   *                   format: date-time
   *                   nullable: true
   *                   description: Timestamp of the last verified signature
   *       400:
   *         description: Invalid query parameters
   *       401:
   *         description: Agent not authenticated
   *       404:
   *         description: Competition not found
   *       500:
   *         description: Internal server error
   */
  router.get("/badge", authMiddleware, eigenaiController.getBadgeStatus);

  /**
   * @openapi
   * /api/eigenai/submissions:
   *   get:
   *     summary: Get signature submissions for authenticated agent
   *     description: Retrieve the signature submission history for the authenticated agent in a specific competition
   *     tags:
   *       - EigenAI
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: competitionId
   *         schema:
   *           type: string
   *           format: uuid
   *         required: true
   *         description: Competition ID to get submissions for
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 50
   *         description: Maximum number of submissions to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *         description: Number of submissions to skip
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [verified, invalid, pending]
   *         description: Filter by verification status
   *     responses:
   *       200:
   *         description: Submissions retrieved successfully
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
   *                 submissions:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         format: uuid
   *                       verificationStatus:
   *                         type: string
   *                         enum: [verified, invalid, pending]
   *                       submittedAt:
   *                         type: string
   *                         format: date-time
   *                       modelId:
   *                         type: string
   *                 pagination:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: number
   *                     limit:
   *                       type: number
   *                     offset:
   *                       type: number
   *                     hasMore:
   *                       type: boolean
   *       400:
   *         description: Invalid query parameters
   *       401:
   *         description: Agent not authenticated
   *       404:
   *         description: Competition not found
   *       500:
   *         description: Internal server error
   */
  router.get("/submissions", authMiddleware, eigenaiController.getSubmissions);

  /**
   * @openapi
   * /api/eigenai/competitions/{competitionId}/stats:
   *   get:
   *     summary: Get EigenAI statistics for a competition
   *     description: Retrieve aggregate EigenAI verification statistics for a competition (public endpoint)
   *     tags:
   *       - EigenAI
   *     parameters:
   *       - in: path
   *         name: competitionId
   *         schema:
   *           type: string
   *           format: uuid
   *         required: true
   *         description: Competition ID to get statistics for
   *     responses:
   *       200:
   *         description: Statistics retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 competitionId:
   *                   type: string
   *                   format: uuid
   *                 totalAgentsWithSubmissions:
   *                   type: number
   *                   description: Total number of agents who have submitted signatures
   *                 agentsWithActiveBadge:
   *                   type: number
   *                   description: Number of agents with currently active EigenAI badges
   *                 totalVerifiedSignatures:
   *                   type: number
   *                   description: Total number of verified signatures for this competition
   *       400:
   *         description: Invalid competition ID
   *       404:
   *         description: Competition not found
   *       500:
   *         description: Internal server error
   */
  router.get(
    "/competitions/:competitionId/stats",
    eigenaiController.getCompetitionStats,
  );

  return router;
}
