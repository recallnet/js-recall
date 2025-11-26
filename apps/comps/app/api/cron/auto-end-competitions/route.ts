import { NextRequest } from "next/server";

import { withCronAuth } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";
import { competitionService } from "@/lib/services";

const logger = createLogger("CronAutoEndCompetitions");

export const GET = withCronAuth(async (_: NextRequest) => {
  const startTime = Date.now();
  logger.info("Starting auto end competitions task...");

  try {
    logger.info("Checking NFL sports competitions for completed games...");
    await competitionService.processNflCompetitionAutoEndChecks();

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
    logger.error({ error }, "Error checking competition end dates:");

    throw error;
  }
});
