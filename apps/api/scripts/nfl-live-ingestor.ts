import * as dotenv from "dotenv";
import * as path from "path";
import { parseArgs } from "util";

import { createLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const logger = createLogger("NFLLiveIngestor");

/**
 * Parse command line arguments
 */
function parseArguments(): {
  season: number;
  week: number;
  competitionId?: string;
  globalGameId?: number;
  pollInterval?: number;
  runOnce: boolean;
} {
  const { values } = parseArgs({
    options: {
      season: {
        type: "string",
        short: "s",
      },
      week: {
        type: "string",
        short: "w",
      },
      competitionId: {
        type: "string",
        short: "c",
      },
      globalGameId: {
        type: "string",
        short: "g",
      },
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
    season: values.season ? parseInt(values.season) : new Date().getFullYear(),
    week: values.week ? parseInt(values.week) : 1,
    competitionId: values.competitionId as string | undefined,
    globalGameId: values.globalGameId
      ? parseInt(values.globalGameId)
      : undefined,
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
  logger.info(`Season: ${args.season}, Week: ${args.week}`);
  if (args.competitionId) {
    logger.info(`Competition ID: ${args.competitionId}`);
  }
  if (args.globalGameId) {
    logger.info(`Global Game ID: ${args.globalGameId}`);
  }

  try {
    if (args.globalGameId) {
      // Ingest specific game
      logger.info(`Ingesting game ${args.globalGameId}...`);
      const gameId = await services.nflLiveIngestorService.ingestGamePlayByPlay(
        args.globalGameId,
      );
      logger.info(`Ingested game ${args.globalGameId} -> ${gameId}`);

      // Link to competition if specified
      if (args.competitionId) {
        await services.competitionGamesRepository.create({
          competitionId: args.competitionId,
          gameId,
        });
        logger.info(
          `Linked game ${gameId} to competition ${args.competitionId}`,
        );
      }
    } else {
      // Ingest entire week
      logger.info(`Ingesting week ${args.week} of ${args.season}...`);
      const gameIds = await services.nflLiveIngestorService.ingestWeek(
        args.season,
        args.week,
        args.competitionId,
      );
      logger.info(`Ingested ${gameIds.length} games`);
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
    logger.error("Error during live data ingestion:", error);
    throw error;
  }
}

/**
 * Run polling loop to continuously update game data
 */
async function runPollingLoop(
  services: ServiceRegistry,
  args: {
    season: number;
    week: number;
    competitionId?: string;
    globalGameId?: number;
    pollInterval?: number;
  },
): Promise<void> {
  const interval = setInterval(async () => {
    try {
      logger.info("Polling for updates...");

      if (args.globalGameId) {
        await services.nflLiveIngestorService.ingestGamePlayByPlay(
          args.globalGameId,
        );
      } else {
        await services.nflLiveIngestorService.ingestWeek(
          args.season,
          args.week,
          args.competitionId,
        );
      }

      // Score resolved plays
      logger.info("Scoring resolved plays...");
      const gamePlaysRepo = services.gamePlaysRepository;
      const scoringService = services.scoringManagerService;

      // Find all resolved plays that haven't been scored yet
      // (This is a simplified approach - in production you'd track scored plays)
      const competitionGames = args.competitionId
        ? await services.competitionGamesRepository.findGameIdsByCompetitionId(
            args.competitionId,
          )
        : [];

      for (const gameId of competitionGames) {
        const plays = await gamePlaysRepo.findByGameId(gameId);
        for (const play of plays) {
          if (play.status === "resolved" && play.actualOutcome) {
            try {
              await scoringService.scorePlay(play.id);
            } catch (error) {
              // Play might already be scored, continue
              logger.debug(`Skipping play ${play.id}: ${error}`);
            }
          }
        }
      }

      logger.info("Poll complete");
    } catch (error) {
      logger.error("Error in polling loop:", error);
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
