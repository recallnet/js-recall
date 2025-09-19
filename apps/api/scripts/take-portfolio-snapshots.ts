import * as dotenv from "dotenv";
import cron from "node-cron";
import * as path from "path";

import { createLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const services = new ServiceRegistry();
const logger = createLogger("PortfolioSnapshots");

/**
 * Take portfolio snapshots for the active competition
 * Routes to appropriate processor based on competition type
 */
async function takePortfolioSnapshots() {
  const startTime = Date.now();
  logger.info("Starting portfolio snapshots task...");

  try {
    // Check if a competition is active
    const activeCompetition =
      await services.competitionManager.getActiveCompetition();

    if (!activeCompetition) {
      const duration = Date.now() - startTime;
      logger.info(
        `There is no active competition. No snapshots will be taken. (took ${duration}ms)`,
      );
      return;
    }

    // Display competition details
    logger.info("Active Competition Details");
    logger.info(
      {
        id: activeCompetition.id,
        name: activeCompetition.name,
        status: activeCompetition.status,
        type: activeCompetition.type,
      },
      "Active Competition Details",
    );

    // Route based on competition type
    if (activeCompetition.type === "perpetual_futures") {
      // Process perps competition
      logger.info("Processing perpetual futures competition...");

      try {
        // This single call orchestrates everything:
        // - Fetches data from Symphony provider
        // - Stores account summaries, positions, sync data
        // - Creates portfolio snapshots
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
          "Error processing perps competition:",
          perpsError instanceof Error ? perpsError.message : String(perpsError),
        );
        throw perpsError;
      }
    } else if (activeCompetition.type === "trading") {
      // Take paper trading portfolio snapshots
      logger.info("Taking paper trading portfolio snapshots...");

      try {
        await services.portfolioSnapshotter.takePortfolioSnapshots(
          activeCompetition.id,
        );
      } catch (paperError) {
        logger.error(
          "Error taking paper trading snapshots:",
          paperError instanceof Error ? paperError.message : String(paperError),
        );
        throw paperError;
      }
    } else {
      // Unknown competition type - throw error to fail fast
      const errorMessage = `Unknown competition type: ${activeCompetition.type}. Expected 'trading' or 'perpetual_futures'.`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    const duration = Date.now() - startTime;
    logger.info(`Portfolio snapshots completed successfully in ${duration}ms!`);
  } catch (error) {
    logger.error(
      "Error in portfolio snapshots task:",
      error instanceof Error ? error.message : String(error),
    );

    throw error;
  }
}

// Schedule the task to run every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  logger.info("Running scheduled portfolio snapshots task");
  await takePortfolioSnapshots();
});

// Also run immediately if called directly
if (process.argv.includes("--run-once")) {
  logger.info("Running portfolio snapshots task once");
  try {
    await takePortfolioSnapshots();
  } catch {
    process.exit(1);
  } finally {
    process.exit(0);
  }
}
