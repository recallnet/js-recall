import { Router } from 'express';
import { CompetitionController } from '../controllers/competition.controller';

const router = Router();

/**
 * @openapi
 * /api/competition/leaderboard:
 *   get:
 *     tags:
 *       - Competition
 *     summary: Get competition leaderboard
 *     description: Get the leaderboard for the active competition or a specific competition. Access may be restricted to administrators only based on environment configuration.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         schema:
 *           type: string
 *         required: true
 *         description: Bearer token for authentication (format "Bearer YOUR_API_KEY")
 *         example: "Bearer abc123def456_ghi789jkl012"
 *       - in: query
 *         name: competitionId
 *         schema:
 *           type: string
 *         required: false
 *         description: Optional competition ID (if not provided, the active competition is used)
 *     responses:
 *       200:
 *         description: Competition leaderboard
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Operation success status
 *                 competition:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Competition ID
 *                     name:
 *                       type: string
 *                       description: Competition name
 *                     description:
 *                       type: string
 *                       nullable: true
 *                       description: Competition description
 *                     startDate:
 *                       type: string
 *                       format: date-time
 *                       description: Competition start date
 *                     endDate:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       description: Competition end date
 *                     status:
 *                       type: string
 *                       enum: [PENDING, ACTIVE, COMPLETED]
 *                       description: Competition status
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       description: When the competition was created
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: When the competition was last updated
 *                 leaderboard:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       rank:
 *                         type: integer
 *                         description: Team rank on the leaderboard
 *                       teamId:
 *                         type: string
 *                         description: Team ID
 *                       teamName:
 *                         type: string
 *                         description: Team name
 *                       portfolioValue:
 *                         type: number
 *                         description: Current portfolio value in USD
 *                       active:
 *                         type: boolean
 *                         description: Whether the team is active
 *                       deactivationReason:
 *                         type: string
 *                         nullable: true
 *                         description: Reason for deactivation if applicable
 *                 hasInactiveTeams:
 *                   type: boolean
 *                   description: Indicates if any teams are inactive
 *       400:
 *         description: Bad request - No active competition and no competitionId provided
 *       401:
 *         description: Unauthorized - Missing or invalid authentication
 *       403:
 *         description: Forbidden - Access denied due to permission restrictions or team not participating in the competition
 *       404:
 *         description: Competition not found
 *       500:
 *         description: Server error
 */
router.get('/leaderboard', CompetitionController.getLeaderboard);

/**
 * @openapi
 * /api/competition/status:
 *   get:
 *     tags:
 *       - Competition
 *     summary: Get competition status
 *     description: Get the status of the active competition
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         schema:
 *           type: string
 *         required: true
 *         description: Bearer token for authentication (format "Bearer YOUR_API_KEY")
 *         example: "Bearer abc123def456_ghi789jkl012"
 *     responses:
 *       200:
 *         description: Competition status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Operation success status
 *                 active:
 *                   type: boolean
 *                   description: Whether there is an active competition
 *                 competition:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Competition ID
 *                     name:
 *                       type: string
 *                       description: Competition name
 *                     description:
 *                       type: string
 *                       nullable: true
 *                       description: Competition description
 *                     startDate:
 *                       type: string
 *                       format: date-time
 *                       description: Competition start date
 *                     endDate:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       description: Competition end date
 *                     status:
 *                       type: string
 *                       enum: [PENDING, ACTIVE, COMPLETED]
 *                       description: Competition status
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       description: When the competition was created
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: When the competition was last updated
 *                 message:
 *                   type: string
 *                   description: Additional information about the competition status
 *                   nullable: true
 *                 participating:
 *                   type: boolean
 *                   description: Whether the authenticated team is participating in the competition
 *                   nullable: true
 *       401:
 *         description: Unauthorized - Missing or invalid authentication
 *       500:
 *         description: Server error
 */
router.get('/status', CompetitionController.getStatus);

/**
 * @openapi
 * /api/competition/rules:
 *   get:
 *     tags:
 *       - Competition
 *     summary: Get competition rules
 *     description: Get the rules, rate limits, and other configuration details for the competition
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         schema:
 *           type: string
 *         required: true
 *         description: Bearer token for authentication (format "Bearer YOUR_API_KEY")
 *         example: "Bearer abc123def456_ghi789jkl012"
 *     responses:
 *       200:
 *         description: Competition rules retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Operation success status
 *                 rules:
 *                   type: object
 *                   properties:
 *                     tradingRules:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: List of trading rules for the competition
 *                     rateLimits:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Rate limits for API endpoints
 *                     availableChains:
 *                       type: object
 *                       properties:
 *                         svm:
 *                           type: boolean
 *                           description: Whether Solana (SVM) is available
 *                         evm:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: List of available EVM chains
 *                     slippageFormula:
 *                       type: string
 *                       description: Formula used for calculating slippage
 *                     portfolioSnapshots:
 *                       type: object
 *                       properties:
 *                         interval:
 *                           type: string
 *                           description: Interval between portfolio snapshots
 *       400:
 *         description: Bad request - No active competition
 *       401:
 *         description: Unauthorized - Missing or invalid authentication
 *       403:
 *         description: Forbidden - Team not participating in the competition
 *       500:
 *         description: Server error
 */
router.get('/rules', CompetitionController.getRules);

export default router;
