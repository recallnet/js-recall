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
 * Determine if we should take a snapshot based on timing
 * Trading competitions: Every 5 minutes
 */
async function shouldTakeSnapshot(competitionId: string): Promise<boolean> {
  const now = new Date();

  // Get last portfolio snapshot time from database
  const lastSnapshot =
    await services.competitionRepository.getLatestPortfolioSnapshotTime(
      competitionId,
    );

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
 * Perps competitions are handled by process-perps-competitions.ts
 */
async function takePortfolioSnapshots() {
  const startTime = Date.now();
  logger.info("Starting portfolio snapshots task...");

  try {
    // Get all active trading competitions (non-perps)
    const allCompetitions = await services.competitionRepository.findAll();
    const activeTradingCompetitions = allCompetitions.filter(
      (c) => c.status === "active" && c.type !== "perpetual_futures",
    );

    if (activeTradingCompetitions.length === 0) {
      const duration = Date.now() - startTime;
      logger.info(
        `There are no active trading competitions. No snapshots will be taken. (took ${duration}ms)`,
      );
      return;
    }

    // Process each active trading competition
    for (const activeCompetition of activeTradingCompetitions) {
      // Check if we should take a snapshot based on timing
      const shouldTake = await shouldTakeSnapshot(activeCompetition.id);
      if (!shouldTake) {
        logger.debug(
          `Skipping snapshot for trading competition ${activeCompetition.id} - not time yet`,
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
        "Processing trading competition",
      );

      // Only process trading competitions
      if (activeCompetition.type === "trading") {
        // Take paper trading portfolio snapshots
        logger.info("Taking paper trading portfolio snapshots...");

        try {
          await services.portfolioSnapshotterService.takePortfolioSnapshots(
            activeCompetition.id,
          );
        } catch (paperError) {
          logger.error(
            { error: paperError },
            `Error taking paper trading snapshots for ${activeCompetition.id}:`,
          );
          // Continue processing other competitions even if one fails
        }
      } else {
        // Unknown competition type - log error but continue
        const errorMessage = `Unknown competition type: ${activeCompetition.type}. Expected 'trading' or 'perpetual_futures'.`;
        logger.error(errorMessage);
      }
    }

    const duration = Date.now() - startTime;
    logger.info(
      `Portfolio snapshots completed for ${activeTradingCompetitions.length} competition(s) in ${duration}ms!`,
    );
  } catch (error) {
    logger.error({ error }, "Error in portfolio snapshots task:");

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
