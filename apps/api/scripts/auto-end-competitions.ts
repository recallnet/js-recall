import * as dotenv from "dotenv";
import cron from "node-cron";
import * as path from "path";

import { createLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const services = new ServiceRegistry();
const logger = createLogger("AutoEndCompetitions");

/**
 * Auto end competitions that have reached their end date
 */
async function autoEndCompetitions() {
  const startTime = Date.now();
  logger.info("Starting auto end competitions task...");

  try {
    logger.info("Checking NFL sports competitions for completed games...");
    await services.competitionService.processNflCompetitionAutoEndChecks();

    // Process competition end date checks
    logger.info("Checking competition end dates...");
    await services.competitionService.processCompetitionEndDateChecks();

    const duration = Date.now() - startTime;
    logger.info(
      `Auto end competitions completed successfully in ${duration}ms!`,
    );
  } catch (error) {
    logger.error({ error }, "Error checking competition end dates:");

    throw error;
  }
}

// Schedule the task to run every minute
cron.schedule("* * * * *", async () => {
  logger.info("Running scheduled auto end competitions task");
  await autoEndCompetitions();
});

// Also run immediately if called directly
if (process.argv.includes("--run-once")) {
  logger.info("Running auto end competitions task once");
  try {
    await autoEndCompetitions();
  } catch {
    process.exit(1);
  } finally {
    process.exit(0);
  }
}
