import * as dotenv from "dotenv";
import cron from "node-cron";
import * as path from "path";

import { createLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const logger = createLogger("NFLPlaysIngester");

/**
 * Main ingester function for NFL plays
 */
async function ingestPlays(): Promise<void> {
  const services = new ServiceRegistry();

  const apiKey = process.env.SPORTSDATAIO_API_KEY;
  if (!apiKey) {
    logger.error("SPORTSDATAIO_API_KEY environment variable is required");
    process.exit(1);
  }

  logger.info("Starting NFL plays ingester...");
  logger.info("Auto-discovering active competitions and in-progress games...");

  try {
    const { count, gameIds } =
      await services.sportsIngesterService.nflIngesterService.ingestGamePlays();

    if (count === 0) {
      logger.debug("No games found (active or unscored)");
    } else {
      logger.info({ count, gameIds }, "Ingested plays for games");
    }
  } catch (error) {
    logger.error({ error }, "Error during live data ingester");
    throw error;
  }
}

async function ingestPlaysTask(): Promise<void> {
  logger.info("Running scheduled NFL plays ingester task");
  try {
    await ingestPlays();
  } catch (error) {
    logger.error({ error }, "Error during plays ingester");
  }
}

cron.schedule("*/1 * * * *", ingestPlaysTask);

try {
  await ingestPlaysTask();
} catch (error) {
  logger.error({ error }, "Error during plays ingester");
  process.exit(1);
}
