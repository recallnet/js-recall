import { Router } from "express";
import client from "prom-client";

export function configureMetricsRoutes() {
  const router = Router();

  /**
   * Prometheus metrics endpoint
   * @route GET /metrics
   * @description Expose Prometheus metrics for monitoring
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
