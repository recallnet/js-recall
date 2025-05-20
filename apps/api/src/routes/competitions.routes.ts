import { RequestHandler, Router } from "express";

import { CompetitionController } from "@/controllers/competition.controller.js";

export function configureCompetitionsRoutes(
  controller: CompetitionController,
  ...middlewares: RequestHandler[]
) {
  const router = Router();

  if (middlewares.length) {
    router.use(...middlewares);
  }

  /**
   * @openapi
   * /api/competitions:
   *   get:
   *     tags:
   *       - Competition
   *     summary: Get upcoming competitions
   *     description: Get all competitions
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *         required: false
   *         description: Optional filtering by competition status (default value is `active`)
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *         required: false
   *         description: Optional field to sort by (default value is `createdDate`)
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
   *         description: Competitions retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   description: Operation success status
   *                 competitions:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         description: Competition ID
   *                       name:
   *                         type: string
   *                         description: Competition name
   *                       description:
   *                         type: string
   *                         nullable: true
   *                         description: Competition description
   *                       externalLink:
   *                         type: string
   *                         nullable: true
   *                         description: External URL for competition details
   *                       imageUrl:
   *                         type: string
   *                         nullable: true
   *                         description: URL to competition image
   *                       status:
   *                         type: string
   *                         enum: [PENDING]
   *                         description: Competition status (always PENDING)
   *                       crossChainTradingType:
   *                         type: string
   *                         enum: [disallowAll, disallowXParent, allow]
   *                         description: The type of cross-chain trading allowed in this competition
   *                       createdAt:
   *                         type: string
   *                         format: date-time
   *                         description: When the competition was created
   *                       updatedAt:
   *                         type: string
   *                         format: date-time
   *                         description: When the competition was last updated
   *       401:
   *         description: Unauthorized - Missing or invalid authentication
   *       500:
   *         description: Server error
   */
  router.get("/", controller.getCompetitions);

  return router;
}
