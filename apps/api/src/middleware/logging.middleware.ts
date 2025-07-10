import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";
import client from "prom-client";

import { config } from "@/config/index.js";
import { runWithTraceContext } from "@/lib/trace-context.js";

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_ms",
  help: "Duration of HTTP requests in ms",
  labelNames: ["method", "route", "status_code"],
  buckets: [25, 50, 100, 200, 500, 1000, 2000, 5000],
});

const httpRequestTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

/**
 * Request latency logging middleware with trace ID correlation
 * Integrates with existing Express middleware pipeline
 */
export function loggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const traceId = randomUUID();
  const startTime = process.hrtime.bigint();

  // Add traceId to request for compatibility with existing patterns
  req.traceId = traceId;

  // Set up response logging
  res.on("finish", () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    // Determine route for metrics (include router's mount prefix for accuracy)
    const route = req.baseUrl + (req.route?.path || "") || req.path;
    const method = req.method;
    const statusCode = res.statusCode.toString();

    // Update Prometheus metrics
    const labels = { method, route, status_code: statusCode };
    httpRequestDuration.observe(labels, durationMs);
    httpRequestTotal.inc(labels);

    // Structured logging for all environments with sampling
    if (Math.random() < config.logging.httpSampleRate) {
      const isDev = config.server.nodeEnv === "development";
      if (isDev) {
        // Detailed logging in development
        console.log(
          `[${traceId}] ${method} ${req.originalUrl} - ${durationMs.toFixed(2)}ms - ${statusCode}`,
        );
      } else {
        // Concise structured logging in production (for log aggregation)
        console.log(
          JSON.stringify({
            traceId,
            method,
            path: req.originalUrl,
            duration: durationMs,
            statusCode,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    }
  });

  // Run the rest of the request with trace context
  runWithTraceContext(traceId, startTime, () => {
    next();
  });
}
