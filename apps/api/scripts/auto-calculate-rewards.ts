import * as dotenv from "dotenv";
import cron from "node-cron";
import * as path from "path";

import { createLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const services = new ServiceRegistry();
const logger = createLogger("AutoCalculateRewards");

/**
 * Auto calculate rewards that have reached their end date
 */
async function autoCalculateRewards() {
  const startTime = Date.now();
  logger.info("Starting auto calculate rewards task...");

  try {
    // Process competition end date checks
    logger.info("Checking competition end dates...");
    await services.competitionService.processPendingRewardsCompetitions();

    const duration = Date.now() - startTime;
    logger.info(
      `Auto calculate rewards completed successfully in ${duration}ms!`,
    );
  } catch (error) {
    logger.error(
      "Error checking competition end dates:",
      error instanceof Error ? error.message : String(error),
    );

    throw error;
  }
}

// Schedule the task to run every minute
cron.schedule("* * * * *", async () => {
  logger.info("Running scheduled auto calculate rewards task");
  await autoCalculateRewards();
});

// Also run immediately if called directly
if (process.argv.includes("--run-once")) {
  logger.info("Running auto calculate rewards task once");
  try {
    await autoCalculateRewards();
  } catch {
    process.exit(1);
  } finally {
    process.exit(0);
  }
}
