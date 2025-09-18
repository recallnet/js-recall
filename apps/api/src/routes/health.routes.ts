import { RequestHandler, Router } from "express";

import { HealthController } from "@/controllers/health.controller.js";

export function configureHealthRoutes(
  controller: HealthController,
  ...middlewares: RequestHandler[]
) {
  const router = Router();

  if (middlewares.length) {
    router.use(...middlewares);
  }

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
  router.get("/", controller.check);

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
   *                     priceTrackerService:
   *                       type: string
   *                       description: Status of the price tracker service
   *                       example: ok
   *                     balanceService:
   *                       type: string
   *                       description: Status of the balance manager service
   *                       example: ok
   *                     tradeSimulatorService:
   *                       type: string
   *                       description: Status of the trade simulator service
   *                       example: ok
   *                     competitionService:
   *                       type: string
   *                       description: Status of the competition manager service
   *                       example: ok
   *                     userService:
   *                       type: string
   *                       description: Status of the user manager service
   *                       example: ok
   *                     agentService:
   *                       type: string
   *                       description: Status of the agent manager service
   *                       example: ok
   *       500:
   *         description: Server error
   */
  router.get("/detailed", controller.detailed);

  return router;
}
