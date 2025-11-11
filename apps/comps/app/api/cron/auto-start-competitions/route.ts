import { NextRequest, NextResponse } from "next/server";

import { config } from "@/config/private";
import { createLogger } from "@/lib/logger";
import { competitionService } from "@/lib/services";

/**
 * Auto-start competitions cron endpoint
 *
 * This endpoint automatically starts competitions that have reached their start date.
 * Designed to be called by Vercel Cron or external cron services.
 *
 * Security:
 * - Protected by bearer token authentication (CRON_SECRET)
 * - Should be called every minute by cron scheduler
 *
 * Usage:
 * POST /api/cron/auto-start-competitions
 * Header: Authorization: Bearer <CRON_SECRET>
 *
 * Vercel Cron configuration (add to vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/auto-start-competitions",
 *     "schedule": "* * * * *"
 *   }]
 * }
 */

const logger = createLogger("AutoStartCompetitions");

/**
 * Validate the cron secret token
 */
function validateCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    logger.error("CRON_SECRET environment variable not set");
    return false;
  }

  return token === expectedToken;
}

/**
 * Auto start competitions that have reached their start date
 */
async function autoStartCompetitions() {
  const startTime = Date.now();
  logger.info("Starting auto start competitions task...");

  try {
    // Process competition start date checks
    logger.info("Checking competition start dates...");
    await competitionService.processCompetitionStartDateChecks();

    const duration = Date.now() - startTime;
    logger.info(
      `Auto start competitions completed successfully in ${duration}ms!`,
    );

    return {
      success: true,
      duration,
      message: "Auto start competitions completed successfully",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Error checking competition start dates:", errorMessage);

    throw error;
  }
}

/**
 * POST handler for the cron endpoint
 */
export async function POST(request: NextRequest) {
  // Validate cron secret
  if (!validateCronSecret(request)) {
    logger.warn("Unauthorized cron request attempt");
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized. Valid bearer token required.",
      },
      { status: 401 },
    );
  }

  try {
    const result = await autoStartCompetitions();

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        ...result,
      },
      { status: 200 },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("Auto start competitions failed:", errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

// Support GET for manual testing/debugging (still requires auth)
export async function GET(request: NextRequest) {
  if (!validateCronSecret(request)) {
    logger.warn("Unauthorized GET request attempt");
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized. Valid bearer token required.",
      },
      { status: 401 },
    );
  }

  return POST(request);
}
