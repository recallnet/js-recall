import * as dotenv from "dotenv";
import * as path from "path";
import { parseArgs } from "util";

import { createLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const logger = createLogger("NFLIngestor");

/**
 * Parse command line arguments
 */
function parseArguments(): {
  dir: string;
  competitionId?: string;
  replaySpeed: number;
  loop: boolean;
  runOnce: boolean;
} {
  const { values } = parseArgs({
    options: {
      dir: {
        type: "string",
        short: "d",
        default: "apps/api/baseline/nfl",
      },
      competitionId: {
        type: "string",
        short: "c",
      },
      replaySpeed: {
        type: "string",
        short: "s",
        default: "1.0",
      },
      loop: {
        type: "boolean",
        short: "l",
        default: false,
      },
      runOnce: {
        type: "boolean",
        default: false,
      },
    },
  });

  return {
    dir: values.dir as string,
    competitionId: values.competitionId as string | undefined,
    replaySpeed: parseFloat(values.replaySpeed as string),
    loop: values.loop as boolean,
    runOnce: values.runOnce as boolean,
  };
}

/**
 * Main ingestor function
 */
async function ingestNflData(): Promise<void> {
  const args = parseArguments();
  const services = new ServiceRegistry();
  const ingestor = services.nflPlaybackIngestorService;

  logger.info("Starting NFL data ingestion...");
  logger.info(`Baseline directory: ${args.dir}`);
  logger.info(`Replay speed: ${args.replaySpeed}x`);
  logger.info(`Loop mode: ${args.loop}`);
  if (args.competitionId) {
    logger.info(`Competition ID: ${args.competitionId}`);
  }

  try {
    // Load games from baseline
    const games = await ingestor.loadGames(args.dir);
    logger.info(`Loaded ${games.length} games`);

    // Ingest games into database
    const gameIdMap = await ingestor.ingestGames(games);
    logger.info(`Ingested ${gameIdMap.size} games into database`);

    // Link games to competition if specified
    if (args.competitionId) {
      const gameIds = Array.from(gameIdMap.values());
      await ingestor.linkGamesToCompetition(args.competitionId, gameIds);
      logger.info(
        `Linked ${gameIds.length} games to competition ${args.competitionId}`,
      );
    }

    // Ingest plays for each game
    for (const game of games) {
      const dbGameId = gameIdMap.get(game.globalGameId);
      if (!dbGameId) {
        logger.error(`Game ${game.globalGameId} not found in database`);
        continue;
      }

      logger.info(`Loading plays for game ${game.globalGameId}...`);
      const plays = await ingestor.loadPlays(args.dir, game.globalGameId);

      logger.info(
        `Ingesting ${plays.length} plays for game ${game.globalGameId}...`,
      );
      await ingestor.ingestPlays(dbGameId, plays, args.replaySpeed, new Date());

      // Update game status to in_progress
      await ingestor.updateGameStatus(game.globalGameId, "in_progress");
    }

    logger.info("NFL data ingestion completed successfully!");

    // In loop mode, wait and resolve plays
    if (args.loop) {
      logger.info("Loop mode enabled - will resolve plays as they lock");
      await runResolveLoop(services, args.dir, gameIdMap, games);
    }
  } catch (error) {
    logger.error("Error during NFL data ingestion:", error);
    throw error;
  }
}

/**
 * Run a loop to resolve plays as they lock
 */
async function runResolveLoop(
  services: ServiceRegistry,
  baselineDir: string,
  gameIdMap: Map<number, string>,
  games: Array<{ globalGameId: number }>,
): Promise<void> {
  const ingestor = services.nflPlaybackIngestorService;
  const gamePlaysRepo = services.gamePlaysRepository;

  // Load all plays with their outcomes
  const playsMap = new Map<
    number,
    Array<{ sequence: number; actualOutcome: "run" | "pass" | null }>
  >();

  for (const game of games) {
    const plays = await ingestor.loadPlays(baselineDir, game.globalGameId);
    playsMap.set(game.globalGameId, plays);
  }

  logger.info("Starting resolve loop...");

  // Poll every 5 seconds
  const interval = setInterval(async () => {
    try {
      // Lock expired plays
      const lockedCount = await gamePlaysRepo.lockExpiredPlays();
      if (lockedCount > 0) {
        logger.info(`Locked ${lockedCount} expired plays`);
      }

      // Resolve locked plays
      for (const game of games) {
        const dbGameId = gameIdMap.get(game.globalGameId);
        if (!dbGameId) continue;

        const plays = playsMap.get(game.globalGameId);
        if (!plays) continue;

        const dbPlays = await gamePlaysRepo.findByGameId(dbGameId);

        for (const dbPlay of dbPlays) {
          if (dbPlay.status === "locked" && !dbPlay.actualOutcome) {
            const baselinePlay = plays.find(
              (p) => p.sequence === dbPlay.sequence,
            );
            if (baselinePlay && baselinePlay.actualOutcome) {
              await ingestor.resolvePlay(
                dbGameId,
                dbPlay.sequence,
                baselinePlay.actualOutcome,
              );

              // Score the play
              await services.scoringManagerService.scorePlay(dbPlay.id);

              logger.info(
                `Resolved and scored play ${dbPlay.sequence} for game ${game.globalGameId}: ${baselinePlay.actualOutcome}`,
              );
            }
          }
        }
      }
    } catch (error) {
      logger.error("Error in resolve loop:", error);
    }
  }, 5000);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    logger.info("Shutting down resolve loop...");
    clearInterval(interval);
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logger.info("Shutting down resolve loop...");
    clearInterval(interval);
    process.exit(0);
  });
}

// Run the ingestor
if (process.argv.includes("--run-once")) {
  logger.info("Running NFL ingestor once");
  try {
    await ingestNflData();
  } catch {
    process.exit(1);
  } finally {
    process.exit(0);
  }
} else {
  // Run in continuous mode
  await ingestNflData();
}
