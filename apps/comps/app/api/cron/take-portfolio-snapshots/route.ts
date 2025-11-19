import { NextRequest } from "next/server";

import { withCronAuth } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";
import { competitionRepository } from "@/lib/repositories";
import { portfolioSnapshotterService } from "@/lib/services";

const logger = createLogger("CronTakePortfolioSnapshots");

/**
 * Determine if we should take a snapshot based on timing
 * Trading competitions: Every 5 minutes
 */
async function shouldTakeSnapshot(competitionId: string): Promise<boolean> {
  const now = new Date();

  // Get last portfolio snapshot time from database
  const lastSnapshot =
    await competitionRepository.getLatestPortfolioSnapshotTime(competitionId);

  if (!lastSnapshot) {
    // No previous snapshot, take one now
    return true;
  }

  const minutesSinceLastSnapshot =
    (now.getTime() - lastSnapshot.getTime()) / (1000 * 60);

  // Trading competitions: snapshot every 5 minutes
  return minutesSinceLastSnapshot >= 5;
}

/**
 * Take portfolio snapshots for trading competitions only
 * Perps competitions are handled by process-perps-competitions cron job
 * Cron handler wrapped with authentication
 */
export const GET = withCronAuth(async (_: NextRequest) => {
  const startTime = Date.now();
  logger.info("Starting portfolio snapshots task...");

  try {
    // Get all active trading competitions (non-perps)
    const allCompetitions = await competitionRepository.findAll();
    const activeTradingCompetitions = allCompetitions.filter(
      (c) => c.status === "active" && c.type !== "perpetual_futures",
    );

    if (activeTradingCompetitions.length === 0) {
      const duration = Date.now() - startTime;
      logger.info(
        `There are no active trading competitions. No snapshots will be taken. (took ${duration}ms)`,
      );
      return {
        success: true,
        duration,
        processedCount: 0,
        message: "No active trading competitions to process",
      };
    }

    let processedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const results = [];

    // Process each active trading competition
    for (const activeCompetition of activeTradingCompetitions) {
      // Check if we should take a snapshot based on timing
      const shouldTake = await shouldTakeSnapshot(activeCompetition.id);
      if (!shouldTake) {
        logger.debug(
          `Skipping snapshot for trading competition ${activeCompetition.id} - not time yet`,
        );
        skippedCount++;
        continue;
      }

      // Display competition details
      logger.info(
        {
          id: activeCompetition.id,
          name: activeCompetition.name,
          status: activeCompetition.status,
          type: activeCompetition.type,
        },
        "Processing trading competition",
      );

      // Only process trading competitions
      if (activeCompetition.type === "trading") {
        // Take paper trading portfolio snapshots
        logger.info("Taking paper trading portfolio snapshots...");

        try {
          await portfolioSnapshotterService.takePortfolioSnapshots(
            activeCompetition.id,
          );
          processedCount++;
          results.push({
            competitionId: activeCompetition.id,
            competitionName: activeCompetition.name,
            success: true,
          });
        } catch (paperError) {
          logger.error(
            { paperError },
            `Error taking paper trading snapshots for ${activeCompetition.id}:`,
          );
          failedCount++;
          results.push({
            competitionId: activeCompetition.id,
            competitionName: activeCompetition.name,
            success: false,
            error:
              paperError instanceof Error
                ? paperError.message
                : String(paperError),
          });
          // Continue processing other competitions even if one fails
        }
      } else {
        // Unknown competition type - log error but continue
        const errorMessage = `Unknown competition type: ${activeCompetition.type}. Expected 'trading' or 'perpetual_futures'.`;
        logger.error(errorMessage);
        failedCount++;
        results.push({
          competitionId: activeCompetition.id,
          competitionName: activeCompetition.name,
          success: false,
          error: errorMessage,
        });
      }
    }

    const duration = Date.now() - startTime;
    logger.info(
      `Portfolio snapshots completed: ${processedCount} processed, ${skippedCount} skipped, ${failedCount} failed in ${duration}ms`,
    );

    return {
      success: true,
      duration,
      processedCount,
      skippedCount,
      failedCount,
      totalCompetitions: activeTradingCompetitions.length,
      results,
      message: "Portfolio snapshots completed",
    };
  } catch (error) {
    logger.error({ error }, "Error in portfolio snapshots task:");

    throw error;
  }
});
