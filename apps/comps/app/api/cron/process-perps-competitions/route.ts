import { NextRequest } from "next/server";

import { withCronAuth } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";
import { competitionRepository } from "@/lib/repositories";
import { perpsDataProcessor } from "@/lib/services";

const logger = createLogger("CronProcessPerpsCompetitions");

/**
 * Determine if we should process based on timing
 * Perps competitions: Every 1 minute
 */
async function shouldProcessPerps(competitionId: string): Promise<boolean> {
  const now = new Date();

  // Get last portfolio snapshot time from database
  const lastSnapshot =
    await competitionRepository.getLatestPortfolioSnapshotTime(competitionId);

  if (!lastSnapshot) {
    // No previous snapshot, process now
    return true;
  }

  const minutesSinceLastSnapshot =
    (now.getTime() - lastSnapshot.getTime()) / (1000 * 60);

  // Perps competitions: process every 1 minute
  return minutesSinceLastSnapshot >= 1;
}

/**
 * Process perps competitions - creates portfolio snapshots and calculates risk metrics
 * Cron handler wrapped with authentication
 */
export const GET = withCronAuth(async (_: NextRequest) => {
  const startTime = Date.now();
  logger.info("Starting perps competition processing...");

  try {
    // Get all active perps competitions
    const allCompetitions = await competitionRepository.findAll();
    const activePerpsCompetitions = allCompetitions.filter(
      (c) => c.status === "active" && c.type === "perpetual_futures",
    );

    if (activePerpsCompetitions.length === 0) {
      const duration = Date.now() - startTime;
      logger.info(
        `No active perps competitions. Nothing to process. (took ${duration}ms)`,
      );
      return {
        success: true,
        duration,
        processedCount: 0,
        message: "No active perps competitions to process",
      };
    }

    let processedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const results = [];

    // Process each active perps competition
    for (const activeCompetition of activePerpsCompetitions) {
      // Check if we should process based on timing
      const shouldProcess = await shouldProcessPerps(activeCompetition.id);
      if (!shouldProcess) {
        logger.debug(
          `Skipping perps processing for ${activeCompetition.id} - not time yet`,
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
        "Processing perpetual futures competition",
      );

      try {
        // This single call orchestrates everything:
        // - Fetches data from Symphony provider
        // - Stores account summaries, positions, sync data
        // - Creates portfolio snapshots
        // - Calculates risk metrics (Calmar, Sortino)
        // - Runs self-funding monitoring
        // - Stores any alerts
        const result = await perpsDataProcessor.processPerpsCompetition(
          activeCompetition.id,
        );

        const successfulCount = result.syncResult.successful.length;
        const failedSyncCount = result.syncResult.failed.length;
        const totalCount = successfulCount + failedSyncCount;

        logger.info(
          `Perps processing complete: ${successfulCount}/${totalCount} agents processed successfully`,
        );

        if (failedSyncCount > 0) {
          logger.warn(`Failed to process ${failedSyncCount} agents`);
        }

        if (result.monitoringResult) {
          const alertsCreated = result.monitoringResult.alertsCreated;
          if (alertsCreated > 0) {
            logger.warn(
              `Self-funding monitoring created ${alertsCreated} alerts`,
            );
          }
        }

        processedCount++;
        results.push({
          competitionId: activeCompetition.id,
          competitionName: activeCompetition.name,
          success: true,
          agentsProcessed: successfulCount,
          agentsFailed: failedSyncCount,
          alertsCreated: result.monitoringResult?.alertsCreated ?? 0,
        });
      } catch (perpsError) {
        logger.error(
          { perpsError },
          `Error processing perps competition ${activeCompetition.id}:`,
        );
        failedCount++;
        results.push({
          competitionId: activeCompetition.id,
          competitionName: activeCompetition.name,
          success: false,
          error:
            perpsError instanceof Error
              ? perpsError.message
              : String(perpsError),
        });
        // Continue processing other competitions even if one fails
      }
    }

    const duration = Date.now() - startTime;
    logger.info(
      `Perps processing completed: ${processedCount} processed, ${skippedCount} skipped, ${failedCount} failed in ${duration}ms`,
    );

    return {
      success: true,
      duration,
      processedCount,
      skippedCount,
      failedCount,
      totalCompetitions: activePerpsCompetitions.length,
      results,
      message: "Perps competition processing completed",
    };
  } catch (error) {
    logger.error({ error }, "Error in perps processing task:");

    throw error;
  }
});
