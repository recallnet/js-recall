import { NextRequest } from "next/server";

import { withCronAuth } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";
import { sportsIngesterService } from "@/lib/services";

const logger = createLogger("CronNflPlaysIngester");

/**
 * Cron job to handle ingestion of live NFL play-by-play data for active competitions.
 * Requires `SPORTSDATAIO_API_KEY` environment variable.
 */
export const GET = withCronAuth(async (_: NextRequest) => {
  const startTime = Date.now();
  logger.info("Starting NFL plays ingester task...");

  try {
    logger.info("Fetching active competitions and games...");
    const ingestedCount =
      await sportsIngesterService.nflIngesterService.ingestGamePlays();

    const duration = Date.now() - startTime;
    logger.info(
      { duration, ingestedCount },
      "NFL plays ingester completed successfully",
    );

    return {
      success: true,
      duration,
      ingestedCount,
      message: "NFL plays ingester completed successfully",
    };
  } catch (error) {
    logger.error({ error }, "Error running NFL plays ingester");
    throw error;
  }
});
