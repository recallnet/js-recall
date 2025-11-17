import { NextRequest } from "next/server";

import { withCronAuth } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";
import { competitionService } from "@/lib/services";

const logger = createLogger("AutoStartCompetitions");

/**
 * Cron handler wrapped with authentication
 */
export const POST = withCronAuth(async (_: NextRequest) => {
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
    logger.error({ error }, "Error checking competition start dates:");

    throw error;
  }
});
