import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';

const router = Router();

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Basic health check
 *     description: Check if the API is running
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Health status of the API
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   description: Current server time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                 version:
 *                   type: string
 *                   description: API version
 *       500:
 *         description: Server error
 */
router.get('/', HealthController.check);

/**
 * @openapi
 * /api/health/detailed:
 *   get:
 *     tags:
 *       - Health
 *     summary: Detailed health check
 *     description: Check if the API and all its services are running properly
 *     responses:
 *       200:
 *         description: Detailed health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Overall health status of the API
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   description: Current server time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                 version:
 *                   type: string
 *                   description: API version
 *                 services:
 *                   type: object
 *                   description: Status of individual services
 *                   properties:
 *                     priceTracker:
 *                       type: string
 *                       description: Status of the price tracker service
 *                       example: ok
 *                     balanceManager:
 *                       type: string
 *                       description: Status of the balance manager service
 *                       example: ok
 *                     tradeSimulator:
 *                       type: string
 *                       description: Status of the trade simulator service
 *                       example: ok
 *                     competitionManager:
 *                       type: string
 *                       description: Status of the competition manager service
 *                       example: ok
 *                     teamManager:
 *                       type: string
 *                       description: Status of the team manager service
 *                       example: ok
 *       500:
 *         description: Server error
 */
router.get('/detailed', HealthController.detailed);

export default router;
