import * as dotenv from "dotenv";
import cron from "node-cron";
import * as path from "path";

import { createLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const services = new ServiceRegistry();
const logger = createLogger("PortfolioSnapshots");

// Store the current cron job and expression
let currentCronJob: cron.ScheduledTask | null = null;
let currentCronExpression: string | null = null;

/**
 * Take portfolio snapshots for the active competition
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
      },
      "Active Competition Details",
    );

    // Take portfolio snapshots
    logger.info("Taking portfolio snapshots...");
    await services.portfolioSnapshotter.takePortfolioSnapshots(
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

/**
 * Update the cron schedule based on active competition configuration
 */
async function updateCronSchedule() {
  try {
    const activeCompetition =
      await services.competitionManager.getActiveCompetition();

    if (!activeCompetition) {
      logger.info("No active competition - using default schedule");
      scheduleCronJob("*/5 * * * *"); // Default: every 5 minutes
      return;
    }

    // Get competition-specific cron expression
    const cronExpression =
      await services.configurationService.getPortfolioSnapshotCron(
        activeCompetition.id,
      );

    if (cronExpression !== currentCronExpression) {
      logger.info(
        `Updating cron schedule from '${currentCronExpression}' to '${cronExpression}'`,
      );
      scheduleCronJob(cronExpression);
    }
  } catch (error) {
    logger.error("Error updating cron schedule:", error);
    // Fall back to default schedule
    scheduleCronJob("*/5 * * * *");
  }
}

/**
 * Schedule or reschedule the cron job
 */
function scheduleCronJob(cronExpression: string) {
  // Stop existing job if any
  if (currentCronJob) {
    currentCronJob.stop();
  }

  // Schedule new job
  currentCronJob = cron.schedule(cronExpression, async () => {
    logger.info("Running scheduled portfolio snapshots task");
    await takePortfolioSnapshots();
  });

  currentCronExpression = cronExpression;
  logger.info(
    `Portfolio snapshots scheduled with expression: ${cronExpression}`,
  );
}

// Check for schedule updates every hour
cron.schedule("0 * * * *", async () => {
  logger.info("Checking for cron schedule updates");
  await updateCronSchedule();
});

// Initialize on startup
logger.info("Portfolio snapshot scheduler starting up...");
updateCronSchedule();

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
