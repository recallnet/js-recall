import { sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { config } from "@/config/private";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const logger = createLogger("HealthCheck");

/**
 * Health check endpoint with database connectivity check
 * Protected by bearer token authentication
 *
 * Usage: GET /api/health
 * Header: Authorization: Bearer <HEALTH_CHECK_API_KEY>
 */

function validateBearerToken(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix
  const expectedToken = config.healthCheck.apiKey;

  if (!expectedToken) {
    logger.error(
      "[Health Check] HEALTH_CHECK_API_KEY environment variable not set",
    );
    return false;
  }

  return token === expectedToken;
}

async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  message: string;
  latencyMs?: number;
}> {
  const startTime = Date.now();

  try {
    logger.info("start");

    // Execute a simple query to verify database connectivity with a timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("Database query timeout after 5s")),
        5000,
      );
    });

    await Promise.race([
      db.execute(sql`SELECT 1 as health_check`),
      timeoutPromise,
    ]);
    logger.info("done");

    const latencyMs = Date.now() - startTime;

    return {
      healthy: true,
      message: "Database connection successful",
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    return {
      healthy: false,
      message:
        error instanceof Error ? error.message : "Unknown database error",
      latencyMs,
    };
  }
}

export async function GET(request: NextRequest) {
  // Validate bearer token
  if (!validateBearerToken(request)) {
    return NextResponse.json(
      {
        status: "error",
        message: "Unauthorized. Valid bearer token required.",
      },
      { status: 401 },
    );
  }

  // Check database health
  const dbHealth = await checkDatabaseHealth();

  const responseStatus = dbHealth.healthy ? 200 : 503;

  return NextResponse.json(
    {
      status: dbHealth.healthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      service: "comps",
      checks: {
        database: {
          healthy: dbHealth.healthy,
          message: dbHealth.message,
          latencyMs: dbHealth.latencyMs,
        },
      },
    },
    { status: responseStatus },
  );
}
