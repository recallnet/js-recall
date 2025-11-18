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
  runOnce: boolean;
} {
  const { values } = parseArgs({
    options: {
      pollInterval: {
        type: "string",
        short: "p",
        default: "3000", // 3 seconds
      },
      runOnce: {
        type: "boolean",
        default: false,
      },
    },
  });

  return {
    pollInterval: parseInt(values.pollInterval as string),
    runOnce: values.runOnce as boolean,
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
    // Ingest all active games
    const ingestedCount =
      await services.nflLiveIngestorService.ingestActiveGames();

    if (ingestedCount === 0) {
      logger.warn(
        "No active competitions with in-progress games found. Ensure competitions are active and games are in progress.",
      );
      return;
    }

    logger.info("Live data ingestion completed successfully!");

    // Poll mode
    if (!args.runOnce) {
      logger.info(
        `Polling mode enabled - will refresh every ${args.pollInterval}ms`,
      );
      await runPollingLoop(services, args);
    }
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
      logger.info("Polling for updates...");

      // Ingest all active games
      const ingestedCount =
        await services.nflLiveIngestorService.ingestActiveGames();

      // Score resolved plays
      logger.debug("Scoring resolved plays...");
      await services.nflLiveIngestorService.scoreResolvedPlays(
        services.scoringManagerService,
      );

      // Check if all games are complete
      if (ingestedCount === 0) {
        logger.info("All games complete - stopping polling");
        clearInterval(interval);
        process.exit(0);
      }

      logger.info("Poll complete");
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
if (process.argv.includes("--run-once")) {
  logger.info("Running NFL live ingestor once");
  try {
    await ingestLiveData();
  } catch {
    process.exit(1);
  } finally {
    process.exit(0);
  }
} else {
  // Run in continuous mode
  await ingestLiveData();
}
