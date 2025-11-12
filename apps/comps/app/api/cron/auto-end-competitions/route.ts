import { NextRequest } from "next/server";

import { withCronAuth } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";
import { competitionService } from "@/lib/services";

const logger = createLogger("CronAutoEndCompetitions");

/**
 * Auto start competitions that have reached their start date
 */
async function autoEndCompetitions() {
  const startTime = Date.now();
  logger.info("Starting auto end competitions task...");

  try {
    // Process competition end date checks
    logger.info("Checking competition end dates...");
    await competitionService.processCompetitionEndDateChecks();

    const duration = Date.now() - startTime;
    logger.info(
      `Auto end competitions completed successfully in ${duration}ms!`,
    );

    return {
      success: true,
      duration,
      message: "Auto end competitions completed successfully",
    };
  } catch (error) {
    logger.error(
      "Error checking competition end dates:",
      error instanceof Error ? error.message : String(error),
    );

    throw error;
  }
}

export const POST = withCronAuth(async (_: NextRequest) => {
  return await autoEndCompetitions();
});
