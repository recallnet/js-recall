import { NextRequest } from "next/server";

import { withCronAuth } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";
import { competitionService } from "@/lib/services";

/**
 * Auto-start competitions cron endpoint
 *
 * This endpoint automatically starts competitions that have reached their start date.
 * Designed to be called by Vercel Cron or external cron services.
 *
 * Security:
 * - Protected by bearer token authentication via withCronAuth middleware
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
 * Cron handler wrapped with authentication
 */
export const POST = withCronAuth(async (_: NextRequest) => {
  return await autoStartCompetitions();
});
