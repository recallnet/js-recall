import * as dotenv from "dotenv";
import cron from "node-cron";
import * as path from "path";

import { createLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const logger = createLogger("NFLPlaysIngestor");

/**
 * Main ingestor function
 */
async function ingestPlays(): Promise<void> {
  const services = new ServiceRegistry();

  const apiKey = process.env.SPORTSDATAIO_API_KEY;
  if (!apiKey) {
    logger.error("SPORTSDATAIO_API_KEY environment variable is required");
    process.exit(1);
  }

  logger.info("Starting NFL plays ingestion...");
  logger.info("Auto-discovering active competitions and in-progress games...");

  try {
    const ingestedCount =
      await services.sportsIngestionService.nflIngestorService.ingestActiveGames();

    if (ingestedCount === 0) {
      logger.debug("No active games found");
    } else {
      logger.info(`Ingested data for ${ingestedCount} active games`);
    }
  } catch (error) {
    logger.error({ error }, "Error during live data ingestion");
    throw error;
  }
}

async function ingestPlaysTask(): Promise<void> {
  logger.info("Running scheduled NFL plays ingestion task");
  try {
    await ingestPlays();
  } catch (error) {
    logger.error({ error }, "Error during plays ingestion");
  }
}

cron.schedule("*/1 * * * *", ingestPlaysTask);

try {
  await ingestPlaysTask();
} catch (error) {
  logger.error({ error }, "Error during plays ingestion");
  process.exit(1);
}
