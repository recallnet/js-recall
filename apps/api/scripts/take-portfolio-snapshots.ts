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
    // Check if a competition is active
    const activeCompetition =
      await services.competitionService.getActiveCompetition();

    if (!activeCompetition) {
      const duration = Date.now() - startTime;
      logger.info(
        `There is no active competition. No snapshots will be taken. (took ${duration}ms)`,
      );
      return;
    }

    // Skip perps competitions - handled by separate script
    if (activeCompetition.type === "perpetual_futures") {
      return;
    }

    // Check if we should take a snapshot based on timing
    const shouldTake = await shouldTakeSnapshot(activeCompetition.id);
    if (!shouldTake) {
      const duration = Date.now() - startTime;
      logger.debug(
        `Skipping snapshot for trading competition ${activeCompetition.id} - not time yet (took ${duration}ms)`,
      );
      return;
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
