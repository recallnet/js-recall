import * as dotenv from "dotenv";
import cron from "node-cron";
import * as path from "path";

import { createLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const services = new ServiceRegistry();
const logger = createLogger("SpotLiveCompetitionProcessor");

/**
 * Determine if we should process based on timing
 * Spot live competitions: Every 2 minutes (or per competition's syncIntervalMinutes)
 */
async function shouldProcessSpotLive(competitionId: string): Promise<boolean> {
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

  // Get sync interval from config (default 2 minutes)
  const spotLiveConfig =
    await services.spotDataProcessor.getCompetitionConfig(competitionId);
  const intervalMinutes = spotLiveConfig?.syncIntervalMinutes ?? 2;

  const minutesSinceLastSnapshot =
    (now.getTime() - lastSnapshot.getTime()) / (1000 * 60);

  return minutesSinceLastSnapshot >= intervalMinutes;
}

/**
 * Process spot live competitions - syncs blockchain data and creates portfolio snapshots
 */
async function processSpotLiveCompetitions() {
  const startTime = Date.now();
  logger.info("Starting spot live competition processing...");

  try {
    // Get all active spot live competitions
    const allCompetitions = await services.competitionRepository.findAll();
    const activeSpotLiveCompetitions = allCompetitions.filter(
      (c) => c.status === "active" && c.type === "spot_live_trading",
    );

    if (activeSpotLiveCompetitions.length === 0) {
      const duration = Date.now() - startTime;
      logger.info(
        `No active spot live competitions. Nothing to process. (took ${duration}ms)`,
      );
      return;
    }

    // Process each active spot live competition
    for (const activeCompetition of activeSpotLiveCompetitions) {
      // Check if we should process based on timing
      const shouldProcess = await shouldProcessSpotLive(activeCompetition.id);
      if (!shouldProcess) {
        logger.debug(
          `Skipping spot live processing for ${activeCompetition.id} - not time yet`,
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
        "Processing spot live trading competition",
      );

      try {
        // This single call orchestrates everything:
        // - Fetches on-chain trades from Spot Live Provider
        // - Filters by protocol/token whitelist
        // - Updates balances atomically
        // - Enriches transfers with price data
        // - Creates portfolio snapshots
        // - Runs self-funding monitoring
        // - Stores any alerts
        const result =
          await services.spotDataProcessor.processSpotLiveCompetition(
            activeCompetition.id,
          );

        const successfulCount = result.syncResult.successful.length;
        const failedCount = result.syncResult.failed.length;
        const totalCount = successfulCount + failedCount;

        logger.info(
          `Spot live processing complete: ${successfulCount}/${totalCount} agents processed successfully`,
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
      } catch (spotLiveError) {
        logger.error(
          { error: spotLiveError },
          `Error processing spot live competition ${activeCompetition.id}:`,
        );
        // Continue processing other competitions even if one fails
      }
    }

    const duration = Date.now() - startTime;
    logger.info(
      `Spot live processing completed for ${activeSpotLiveCompetitions.length} competition(s) in ${duration}ms!`,
    );
  } catch (error) {
    logger.error({ error }, "Error in spot live processing task:");

    throw error;
  }
}

// Schedule the task to run every 2 minutes
cron.schedule("*/2 * * * *", async () => {
  logger.info("Running scheduled spot live processing task");
  await processSpotLiveCompetitions();
});

// Also run immediately if called directly
if (process.argv.includes("--run-once")) {
  logger.info("Running spot live processing task once");
  try {
    await processSpotLiveCompetitions();
  } catch {
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Keep the process alive for cron
logger.info(
  "Spot live competition processor started - running every 2 minutes",
);
