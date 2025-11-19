import * as dotenv from "dotenv";
import cron from "node-cron";
import * as path from "path";

import { createLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const services = new ServiceRegistry();
const logger = createLogger("AutoStartCompetitions");

/**
 * Auto start competitions that have reached their start date
 */
async function autoStartCompetitions() {
  const startTime = Date.now();
  logger.info("Starting auto start competitions task...");

  try {
    // Process competition start date checks
    logger.info("Checking competition start dates...");
    await services.competitionService.processCompetitionStartDateChecks();

    const duration = Date.now() - startTime;
    logger.info(
      `Auto start competitions completed successfully in ${duration}ms!`,
    );
  } catch (error) {
    logger.error({ error }, "Error checking competition start dates:");

    throw error;
  }
}

// Schedule the task to run every minute
cron.schedule("* * * * *", async () => {
  logger.info("Running scheduled auto start competitions task");
  await autoStartCompetitions();
});

// Also run immediately if called directly
if (process.argv.includes("--run-once")) {
  logger.info("Running auto start competitions task once");
  try {
    await autoStartCompetitions();
  } catch {
    process.exit(1);
  } finally {
    process.exit(0);
  }
}
