import express from "express";
import client from "prom-client";

import { config } from "@/config/index.js";

/**
 * Creates and configures a dedicated metrics server
 * This server runs on a separate port for internal monitoring without authentication
 */
export function createMetricsServer(): express.Application {
  const app = express();

  // Basic middleware - no authentication required for internal metrics
  app.use(express.json({ limit: "1mb" })); // Limit request size

  // Request timeout middleware
  app.use((req, res, next) => {
    req.setTimeout(30000, () => {
      // 30 second timeout
      const err = new Error("Request timeout");
      err.name = "TimeoutError";
      next(err);
    });
    next();
  });

  /**
   * Prometheus metrics endpoint
   * This endpoint is exposed without authentication for internal monitoring
   */
  app.get("/metrics", async (req, res) => {
    try {
      res.set("Content-Type", client.register.contentType);
      const metrics = await client.register.metrics();
      res.end(metrics);
    } catch (error) {
      console.error("[MetricsServer] Error generating metrics:", error);
      res.status(500).json({ error: "Error generating metrics" });
    }
  });

  /**
   * Health check endpoint for the metrics server
   * Verifies that both the server and Prometheus metrics are working
   */
  app.get("/health", async (req, res) => {
    try {
      // Test that we can generate metrics
      const testMetrics = await client.register.metrics();
      const metricsWorking = testMetrics.length > 0;

      const healthData = {
        status: metricsWorking ? "healthy" : "degraded",
        service: "metrics-server",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || "unknown",
        checks: {
          server: "ok",
          metrics: metricsWorking ? "ok" : "degraded",
        },
      };

      res.status(metricsWorking ? 200 : 503).json(healthData);
    } catch (error) {
      console.error("[MetricsServer] Health check failed:", error);
      res.status(500).json({
        status: "unhealthy",
        service: "metrics-server",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    }
  });

  /**
   * Default endpoint - provides information about available endpoints
   */
  app.get("/", (req, res) => {
    res.status(200).json({
      service: "Recall API Metrics Server",
      endpoints: {
        metrics: "/metrics",
        health: "/health",
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Error handling middleware (must be last)
  app.use(
    (
      err: Error,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      console.error("[MetricsServer] Error:", err);
      res.status(500).json({
        error: "Internal server error",
        service: "metrics-server",
        timestamp: new Date().toISOString(),
      });
    },
  );

  return app;
}

/**
 * Starts the metrics server on the configured port
 * Returns the server instance for lifecycle management
 */
export function startMetricsServer(): import("http").Server {
  const app = createMetricsServer();
  const port = config.server.metricsPort;
  const host = config.server.metricsHost;

  const server = app.listen(port, host, () => {
    console.log(`========================================`);
    console.log(`Metrics server running on ${host}:${port}`);
    console.log(`Metrics endpoint: http://${host}:${port}/metrics`);
    console.log(`Health check: http://${host}:${port}/health`);
    console.log(
      `Security: Bound to ${host} (${host === "127.0.0.1" ? "localhost only" : "WARNING: exposed to network"})`,
    );
    console.log(`========================================`);
  });

  return server;
}
