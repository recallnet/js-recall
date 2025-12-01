import * as dotenv from "dotenv";
import cron from "node-cron";
import * as path from "path";
import { parseArgs } from "util";

import { createLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const logger = createLogger("NFLScheduleIngester");

/**
 * Parse command line arguments
 */
function parseArguments(): {
  season: string;
} {
  const { values } = parseArgs({
    options: {
      season: {
        type: "string",
        short: "s",
        default: "2025",
      },
    },
  });

  return {
    season: values.season,
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
    await services.sportsIngesterService.nflIngesterService.syncSchedule(
      args.season,
    );
  } catch (error) {
    logger.error({ error }, "Error during schedule sync");
    throw error;
  }
}

async function syncScheduleTask(): Promise<void> {
  logger.info("Running scheduled NFL schedule sync task");
  try {
    await syncSchedule();
  } catch (error) {
    logger.error({ error }, "Error during schedule sync");
  }
}

cron.schedule("*/5 * * * *", syncScheduleTask);

try {
  await syncScheduleTask();
} catch (error) {
  logger.error({ error }, "Error during schedule sync");
  process.exit(1);
}
