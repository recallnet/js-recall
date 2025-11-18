import * as dotenv from "dotenv";
import cron from "node-cron";
import * as path from "path";
import { parseArgs } from "util";

import { createLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const logger = createLogger("NFLScheduleIngestor");

/**
 * Parse command line arguments
 */
function parseArguments(): {
  season: number;
  runOnce: boolean;
} {
  const { values } = parseArgs({
    options: {
      season: {
        type: "string",
        short: "s",
      },
      runOnce: {
        type: "boolean",
        default: false,
      },
    },
  });

  return {
    season: values.season ? parseInt(values.season) : new Date().getFullYear(),
    runOnce: values.runOnce as boolean,
  };
}

/**
 * Sync NFL schedule for a season
 */
async function syncSchedule(): Promise<void> {
  const args = parseArguments();
  const services = new ServiceRegistry();

  // Check for required environment variable
  const apiKey = process.env.SPORTSDATAIO_API_KEY;
  if (!apiKey) {
    logger.error("SPORTSDATAIO_API_KEY environment variable is required");
    process.exit(1);
  }

  logger.info(`Starting NFL schedule sync for ${args.season} season...`);

  try {
    await services.sportsService.nflLiveIngestorService.syncSchedule(
      args.season,
    );
  } catch (error) {
    logger.error({ error }, "Error during schedule sync");
    throw error;
  }
}

// Schedule the task to run every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  logger.info("Running scheduled NFL schedule sync task");
  await syncSchedule();
});

// Run the sync
if (process.argv.includes("--run-once")) {
  logger.info("Running NFL schedule sync once");
  try {
    await syncSchedule();
  } catch {
    process.exit(1);
  } finally {
    process.exit(0);
  }
} else {
  // Run immediately
  await syncSchedule();
}
