import * as dotenv from "dotenv";
import cron from "node-cron";
import * as path from "path";

import { createLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const services = new ServiceRegistry();
const logger = createLogger("PerpsCompetitionProcessor");

/**
 * Determine if we should process based on timing
 * Perps competitions: Every 1 minute
 */
async function shouldProcessPerps(competitionId: string): Promise<boolean> {
  const now = new Date();

  // Get last portfolio snapshot time from database
  const lastSnapshot =
    await services.competitionRepository.getLatestPortfolioSnapshotTime(
      competitionId,
    );

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
 */
async function processPerpsCompetitions() {
  const startTime = Date.now();
  logger.info("Starting perps competition processing...");

  try {
    // Get all active perps competitions
    const allCompetitions = await services.competitionRepository.findAll();
    const activePerpsCompetitions = allCompetitions.filter(
      (c) => c.status === "active" && c.type === "perpetual_futures",
    );

    if (activePerpsCompetitions.length === 0) {
      const duration = Date.now() - startTime;
      logger.info(
        `No active perps competitions. Nothing to process. (took ${duration}ms)`,
      );
      return;
    }

    // Process each active perps competition
    for (const activeCompetition of activePerpsCompetitions) {
      // Check if we should process based on timing
      const shouldProcess = await shouldProcessPerps(activeCompetition.id);
      if (!shouldProcess) {
        logger.debug(
          `Skipping perps processing for ${activeCompetition.id} - not time yet`,
        );
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
        const result =
          await services.perpsDataProcessor.processPerpsCompetition(
            activeCompetition.id,
          );

        const successfulCount = result.syncResult.successful.length;
        const failedCount = result.syncResult.failed.length;
        const totalCount = successfulCount + failedCount;

        logger.info(
          `Perps processing complete: ${successfulCount}/${totalCount} agents processed successfully`,
        );

        if (failedCount > 0) {
          logger.warn(`Failed to process ${failedCount} agents`);
        }

        if (result.monitoringResult) {
          const alertsCreated = result.monitoringResult.alertsCreated;
          if (alertsCreated > 0) {
            logger.warn(
              `Self-funding monitoring created ${alertsCreated} alerts`,
            );
          }
        }
      } catch (perpsError) {
        logger.error(
          `Error processing perps competition ${activeCompetition.id}:`,
          perpsError instanceof Error ? perpsError.message : String(perpsError),
        );
        // Continue processing other competitions even if one fails
      }
    }

    const duration = Date.now() - startTime;
    logger.info(
      `Perps processing completed for ${activePerpsCompetitions.length} competition(s) in ${duration}ms!`,
    );
  } catch (error) {
    logger.error(
      "Error in perps processing task:",
      error instanceof Error ? error.message : String(error),
    );

    throw error;
  }
}

// Schedule the task to run every minute
cron.schedule("* * * * *", async () => {
  logger.info("Running scheduled perps processing task");
  await processPerpsCompetitions();
});

// Also run immediately if called directly
if (process.argv.includes("--run-once")) {
  logger.info("Running perps processing task once");
  try {
    await processPerpsCompetitions();
  } catch {
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Keep the process alive for cron
logger.info("Perps competition processor started - running every minute");
