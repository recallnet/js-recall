import { Request, Response, NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../config/swagger';

/**
 * Documentation Controller
 * Handles API documentation endpoints
 */
export class DocsController {
  /**
   * Setup configuration for Swagger UI
   */
  static readonly swaggerUiOptions = {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  };

  /**
   * Get API documentation - Serves the Swagger UI
   * This is a placeholder method for route configuration - the actual UI is handled by swagger-ui-express
   */
  static getApiDocs = swaggerUi.setup(swaggerSpec, DocsController.swaggerUiOptions);

  /**
   * Middleware for serving swagger-ui assets
   */
  static serveAssets = swaggerUi.serve;

  /**
   * @param req Express request
   * @param res Express response
   * @param next Express next function
   */
  static getApiSpec(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    } catch (error) {
      next(error);
    }
  }
}
