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

    // Display competition details
    logger.info("Active Competition Details");
    logger.info(
      {
        id: activeCompetition.id,
        name: activeCompetition.name,
        status: activeCompetition.status,
      },
      "Active Competition Details",
    );

    // Take portfolio snapshots
    logger.info("Taking portfolio snapshots...");
    await services.portfolioSnapshotterService.takePortfolioSnapshots(
      activeCompetition.id,
    );

    const duration = Date.now() - startTime;
    logger.info(`Portfolio snapshots completed successfully in ${duration}ms!`);
  } catch (error) {
    logger.error(
      "Error taking portfolio snapshots:",
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
