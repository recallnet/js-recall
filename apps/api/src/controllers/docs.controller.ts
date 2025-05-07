import { NextFunction, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";

import { swaggerSpec } from "@/config/swagger.js";

export function makeDocsController() {
  /**
   * Setup configuration for Swagger UI
   */
  const swaggerUiOptions = {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    swaggerOptions: {
      docExpansion: "none",
      filter: true,
      showRequestDuration: true,
    },
  };
  /**
   * Documentation Controller
   * Handles API documentation endpoints
   */
  return {
    /**
     * Get API documentation - Serves the Swagger UI
     * This is a placeholder method for route configuration - the actual UI is handled by swagger-ui-express
     */
    getApiDocs: swaggerUi.setup(swaggerSpec, swaggerUiOptions),

    /**
     * Middleware for serving swagger-ui assets
     */
    serveAssets: swaggerUi.serve,

    /**
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    getApiSpec(req: Request, res: Response, next: NextFunction) {
      try {
        res.setHeader("Content-Type", "application/json");
        res.send(swaggerSpec);
      } catch (error) {
        next(error);
      }
    },
  };
}

export type DocsController = ReturnType<typeof makeDocsController>;
