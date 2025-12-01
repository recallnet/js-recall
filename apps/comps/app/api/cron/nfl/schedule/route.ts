import { NextRequest } from "next/server";

import { withCronAuth } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";
import { sportsIngesterService } from "@/lib/services";

const logger = createLogger("CronNflScheduleIngester");

/**
 * Helper function to resolve the season from the request query parameters.
 * If no season is provided, the current year is used.
 * @param request - The incoming request
 * @returns The season to sync (defaults to current year for 2025 season)
 */
function resolveSeason(request: NextRequest): string {
  const requestedSeason = request.nextUrl.searchParams.get("season");
  if (requestedSeason && requestedSeason.trim().length > 0) {
    return requestedSeason.trim();
  }

  return "2025";
}

/**
 * Cron job to handle syncing of NFL schedules. Runs every 5 minutes and
 * accepts optional `season` query parameter (defaults to current year for 2025 season).
 * Requires `SPORTSDATAIO_API_KEY` environment variable.
 */
export const GET = withCronAuth(async (request: NextRequest) => {
  const startTime = Date.now();
  const season = resolveSeason(request);
  logger.info({ season }, "Starting NFL schedule ingester task...");

  try {
    const { syncedCount, errorCount, totalGames } =
      await sportsIngesterService.nflIngesterService.syncSchedule(season);

    const duration = Date.now() - startTime;
    logger.info(
      { duration, season, syncedCount, errorCount, totalGames },
      "NFL schedule ingester completed successfully",
    );

    return {
      success: true,
      duration,
      season,
      syncedCount,
      errorCount,
      totalGames,
      message: "NFL schedule ingester completed successfully",
    };
  } catch (error) {
    logger.error({ error, season }, "Error running NFL schedule ingester");
    throw error;
  }
});
