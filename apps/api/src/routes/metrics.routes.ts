import { RequestHandler, Router } from "express";
import client from "prom-client";

export function configureMetricsRoutes(...middlewares: RequestHandler[]) {
  const router = Router();

  // Apply admin authentication middleware to all routes
  if (middlewares.length) {
    router.use(...middlewares);
  }

  /**
   * @openapi
   * /api/metrics:
   *   get:
   *     tags:
   *       - Admin
   *     summary: Get Prometheus metrics
   *     description: Expose Prometheus metrics for monitoring (admin-only endpoint)
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Prometheus metrics in text format
   *         content:
   *           text/plain:
   *             schema:
   *               type: string
   *               example: |
   *                 # HELP http_requests_total Total number of HTTP requests
   *                 # TYPE http_requests_total counter
   *                 http_requests_total{method="GET",route="/api/agent/profile",status_code="200"} 42
   *
   *                 # HELP http_request_duration_ms Duration of HTTP requests in milliseconds
   *                 # TYPE http_request_duration_ms histogram
   *                 http_request_duration_ms_bucket{method="GET",route="/api/agent/profile",status_code="200",le="10"} 15
   *
   *                 # HELP repository_queries_total Total number of repository queries
   *                 # TYPE repository_queries_total counter
   *                 repository_queries_total{repository="AgentRepository",method="getAgent",operation="SELECT"} 28
   *       401:
   *         description: Unauthorized - Admin authentication required
   *       500:
   *         description: Error generating metrics
   */
  router.get("/", async (req, res) => {
    try {
      res.set("Content-Type", client.register.contentType);
      const metrics = await client.register.metrics();
      res.end(metrics);
    } catch (error) {
      console.error("[Metrics] Error generating metrics:", error);
      res.status(500).end("Error generating metrics");
    }
  });

  return router;
}
