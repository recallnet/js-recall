import * as dotenv from "dotenv";
import * as path from "path";
import { parseArgs } from "util";

import { createLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const logger = createLogger("NFLPlaysIngestor");

/**
 * Parse command line arguments
 */
function parseArguments(): {
  pollInterval: number;
} {
  const { values } = parseArgs({
    options: {
      pollInterval: {
        type: "string",
        short: "p",
        default: "30000", // 30 seconds
      },
    },
  });

  return {
    pollInterval: parseInt(values.pollInterval),
  };
}

/**
 * Main ingestor function
 */
async function ingestLiveData(): Promise<void> {
  const args = parseArguments();
  const services = new ServiceRegistry();

  // Check for required environment variable
  const apiKey = process.env.SPORTSDATAIO_API_KEY;
  if (!apiKey) {
    logger.error("SPORTSDATAIO_API_KEY environment variable is required");
    process.exit(1);
  }

  logger.info("Starting NFL live data ingestion...");
  logger.info("Auto-discovering active competitions and in-progress games...");

  try {
    // Ingest all active games (pass scoring service for automatic game finalization)
    const ingestedCount =
      await services.sportsService.nflLiveIngestorService.ingestActiveGames(
        services.sportsService.gameScoringService,
      );

    if (ingestedCount === 0) {
      logger.warn(
        "No active competitions with in-progress games found initially.",
      );
    } else {
      logger.info(
        `Live data ingestion completed for ${ingestedCount} competitions`,
      );
    }

    await runPollingLoop(services, args);
  } catch (error) {
    logger.error({ error }, "Error during live data ingestion");
    throw error;
  }
}

/**
 * Run polling loop to continuously update game data
 */
async function runPollingLoop(
  services: ServiceRegistry,
  args: {
    pollInterval: number;
  },
): Promise<void> {
  const interval = setInterval(async () => {
    try {
      logger.info("Polling for active games...");
      const ingestedCount =
        await services.sportsService.nflLiveIngestorService.ingestActiveGames(
          services.sportsService.gameScoringService,
        );

      if (ingestedCount === 0) {
        logger.debug("No active games found");
      } else {
        logger.info(`Ingested data for ${ingestedCount} active games`);
      }
    } catch (error) {
      logger.error({ error }, "Error in polling loop");
    }
  }, args.pollInterval);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    logger.info("Shutting down polling loop...");
    clearInterval(interval);
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logger.info("Shutting down polling loop...");
    clearInterval(interval);
    process.exit(0);
  });
}

// Run the ingestor
await ingestLiveData();
