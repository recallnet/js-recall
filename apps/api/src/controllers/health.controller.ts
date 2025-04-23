import { Request, Response, NextFunction } from 'express';

/**
 * Health Controller
 * Handles health check endpoints
 */
export class HealthController {
  /**
   * Basic health check
   * @param req Express request
   * @param res Express response
   * @param next Express next function
   */
  static async check(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Detailed health check with service status
   * @param req Express request
   * @param res Express response
   * @param next Express next function
   */
  static async detailed(req: Request, res: Response, next: NextFunction) {
    try {
      // Since we don't have isHealthy methods on our services yet,
      // we'll just return 'ok' for all services for now
      // In a real implementation, we would check the health of each service

      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        services: {
          priceTracker: 'ok',
          balanceManager: 'ok',
          tradeSimulator: 'ok',
          competitionManager: 'ok',
          teamManager: 'ok',
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
