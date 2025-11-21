/**
 * NFL Mock Server for Local Development
 *
 * This is a development-only mock server that simulates the SportsDataIO API.
 * NOT intended for production use.
 *
 * Security: This server is designed to run locally on localhost only.
 * Do not expose this server to external networks.
 */
import * as dotenv from "dotenv";
import express, { Express, Request, Response } from "express";
import { Server } from "http";
import * as path from "path";
import { parseArgs } from "util";

import {
  type PlayByPlayData,
  type ScheduleGame,
  loadAllNflData,
} from "@recallnet/test-utils";

import { createLogger } from "@/lib/logger.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const logger = createLogger("NFLMockServer");

/**
 * Simple Mock SportsDataIO NFL Server
 * Serves fixture data progressively for development/testing
 * Data is loaded into memory at startup from JSON fixture files
 */
class SimpleMockSportsDataIOServer {
  private app: Express;
  private server: Server | null = null;
  private port: number;
  private currentSnapshotIndex: Map<number, number> = new Map();
  private scheduleData: Map<number, ScheduleGame[]> = new Map();
  private playByPlayData: Map<number, PlayByPlayData[]> = new Map();
  private autoAdvanceIntervals: Map<number, NodeJS.Timeout> = new Map();
  private dataLoadPromise: Promise<void>;
  private readonly MAX_AUTO_ADVANCE_GAMES = 10;

  constructor(port: number, fixtureDir: string) {
    this.port = port;
    this.app = express();
    this.dataLoadPromise = this.loadData(fixtureDir);
    this.setupRoutes();
  }

  /**
   * Load all fixture data into memory
   */
  private async loadData(fixtureDir: string): Promise<void> {
    try {
      const { schedule, playByPlay } = await loadAllNflData(fixtureDir);
      this.scheduleData = schedule;
      this.playByPlayData = playByPlay;
      logger.info(
        `Loaded ${this.scheduleData.size} seasons with schedule data`,
      );
      logger.info(
        `Loaded ${this.playByPlayData.size} games with play-by-play data`,
      );

      for (const [season, games] of this.scheduleData.entries()) {
        logger.debug(`Season ${season}: ${games.length} games`);
      }
      for (const [gameId, snapshots] of this.playByPlayData.entries()) {
        logger.debug(`Game ${gameId}: ${snapshots.length} snapshots`);
      }

      if (this.playByPlayData.size === 0) {
        logger.warn(
          `No play-by-play data found in ${fixtureDir}. Server will return 404 for all game requests.`,
        );
      }
    } catch (error) {
      logger.error({ error }, "Failed to load fixture data");
      throw error;
    }
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    this.app.use(express.json({ limit: "1mb" }));

    /**
     * GET /stats/json/schedules/:season
     * Returns schedule data for a season
     */
    this.app.get(
      "/stats/json/schedules/:season",
      (req: Request, res: Response) => {
        try {
          const seasonStr = req.params.season;

          if (!seasonStr) {
            res.status(400).json({ error: "Season is required" });
            return;
          }

          const season = parseInt(seasonStr, 10);
          if (isNaN(season)) {
            res.status(400).json({ error: "Invalid season" });
            return;
          }
          const games = this.scheduleData.get(season);

          if (!games || games.length === 0) {
            res.status(404).json({ error: "Schedule not found for season" });
            return;
          }

          logger.info(
            `Serving schedule for season ${season} (${games.length} games)`,
          );

          res.json(games);
        } catch (error) {
          logger.error({ error }, "Error serving schedule");
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );

    /**
     * GET /pbp/json/playbyplay/:providerGameId
     * Returns play-by-play data for a game
     */
    this.app.get(
      "/pbp/json/playbyplay/:providerGameId",
      (req: Request, res: Response) => {
        try {
          const providerGameId = parseInt(req.params.providerGameId || "", 10);

          if (isNaN(providerGameId)) {
            res.status(400).json({ error: "Invalid providerGameId" });
            return;
          }

          const snapshots = this.playByPlayData.get(providerGameId);

          if (!snapshots || snapshots.length === 0) {
            res.status(404).json({ error: "Game not found" });
            return;
          }

          const currentIndex =
            this.currentSnapshotIndex.get(providerGameId) || 0;
          const snapshotIndex = Math.min(currentIndex, snapshots.length - 1);
          const snapshot = snapshots[snapshotIndex];

          if (!snapshot) {
            res.status(404).json({ error: "Snapshot not found" });
            return;
          }

          logger.info(
            `Serving snapshot ${snapshotIndex}/${snapshots.length - 1} for game ${providerGameId}`,
          );

          res.json(snapshot);
        } catch (error) {
          logger.error({ error }, "Error serving play-by-play");
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );

    /**
     * POST /mock/advance/:providerGameId
     * Advances to the next snapshot for a game
     */
    this.app.post(
      "/mock/advance/:providerGameId",
      (req: Request, res: Response) => {
        try {
          const providerGameId = parseInt(req.params.providerGameId || "", 10);
          if (isNaN(providerGameId)) {
            res.status(400).json({ error: "Invalid providerGameId" });
            return;
          }

          const snapshots = this.playByPlayData.get(providerGameId);
          if (!snapshots) {
            res.status(404).json({ error: "Game not found" });
            return;
          }

          const currentIndex =
            this.currentSnapshotIndex.get(providerGameId) || 0;
          const nextIndex = Math.min(currentIndex + 1, snapshots.length - 1);

          this.currentSnapshotIndex.set(providerGameId, nextIndex);

          logger.info(
            `Advanced game ${providerGameId} to snapshot ${nextIndex}/${snapshots.length - 1}`,
          );

          res.json({
            providerGameId,
            currentSnapshot: nextIndex,
            totalSnapshots: snapshots.length,
          });
        } catch (error) {
          logger.error({ error }, "Error advancing snapshot");
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );

    /**
     * POST /mock/reset/:providerGameId
     * Resets to the first snapshot for a game
     */
    this.app.post(
      "/mock/reset/:providerGameId",
      (req: Request, res: Response) => {
        try {
          const providerGameId = parseInt(req.params.providerGameId || "", 10);
          if (isNaN(providerGameId)) {
            res.status(400).json({ error: "Invalid providerGameId" });
            return;
          }

          this.currentSnapshotIndex.set(providerGameId, 0);
          logger.info(`Reset game ${providerGameId} to snapshot 0`);

          res.json({ providerGameId, currentSnapshot: 0 });
        } catch (error) {
          logger.error({ error }, "Error resetting game");
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );

    /**
     * POST /mock/auto-advance/:providerGameId
     * Starts auto-advance for a game
     */
    this.app.post(
      "/mock/auto-advance/:providerGameId",
      (req: Request, res: Response) => {
        try {
          const providerGameId = parseInt(req.params.providerGameId || "", 10);
          if (isNaN(providerGameId)) {
            res.status(400).json({ error: "Invalid providerGameId" });
            return;
          }

          const snapshots = this.playByPlayData.get(providerGameId);
          if (!snapshots) {
            res.status(404).json({ error: "Game not found" });
            return;
          }

          if (
            this.autoAdvanceIntervals.size >= this.MAX_AUTO_ADVANCE_GAMES &&
            !this.autoAdvanceIntervals.has(providerGameId)
          ) {
            res.status(429).json({
              error: `Maximum ${this.MAX_AUTO_ADVANCE_GAMES} concurrent auto-advances reached`,
            });
            return;
          }

          const intervalInput = req.body?.intervalMs;
          let intervalMs = 30000;

          if (intervalInput !== undefined) {
            const parsed = parseInt(String(intervalInput), 10);
            if (isNaN(parsed)) {
              res.status(400).json({ error: "Invalid intervalMs value" });
              return;
            }
            if (parsed < 1000 || parsed > 300000) {
              res.status(400).json({
                error:
                  "intervalMs must be between 1000 and 300000 milliseconds",
              });
              return;
            }
            intervalMs = parsed;
          }

          const existingInterval =
            this.autoAdvanceIntervals.get(providerGameId);
          if (existingInterval) {
            clearInterval(existingInterval);
          }

          const interval = setInterval(() => {
            const currentIndex =
              this.currentSnapshotIndex.get(providerGameId) || 0;

            if (currentIndex >= snapshots.length - 1) {
              clearInterval(interval);
              this.autoAdvanceIntervals.delete(providerGameId);
              logger.info(
                `Auto-advance complete for game ${providerGameId} (reached final snapshot)`,
              );
              return;
            }

            const nextIndex = currentIndex + 1;
            this.currentSnapshotIndex.set(providerGameId, nextIndex);

            logger.info(
              `Auto-advanced game ${providerGameId} to snapshot ${nextIndex}/${snapshots.length - 1}`,
            );
          }, intervalMs);

          this.autoAdvanceIntervals.set(providerGameId, interval);

          logger.info(
            `Started auto-advance for game ${providerGameId} (interval: ${intervalMs}ms, ${snapshots.length} snapshots)`,
          );

          res.json({
            providerGameId,
            intervalMs,
            totalSnapshots: snapshots.length,
            message: "Auto-advance started",
          });
        } catch (error) {
          logger.error({ error }, "Error starting auto-advance");
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );

    /**
     * POST /mock/stop-auto-advance/:providerGameId
     * Stops auto-advance for a game
     */
    this.app.post(
      "/mock/stop-auto-advance/:providerGameId",
      (req: Request, res: Response) => {
        try {
          const providerGameId = parseInt(req.params.providerGameId || "", 10);
          if (isNaN(providerGameId)) {
            res.status(400).json({ error: "Invalid providerGameId" });
            return;
          }

          const interval = this.autoAdvanceIntervals.get(providerGameId);
          if (interval) {
            clearInterval(interval);
            this.autoAdvanceIntervals.delete(providerGameId);
            logger.info(`Stopped auto-advance for game ${providerGameId}`);
            res.json({ providerGameId, message: "Auto-advance stopped" });
          } else {
            res
              .status(404)
              .json({ error: "No auto-advance running for this game" });
          }
        } catch (error) {
          logger.error({ error }, "Error stopping auto-advance");
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );
  }

  /**
   * Start the server
   * Waits for data to be loaded before starting the server
   * Binds to localhost only for security
   */
  async start(): Promise<void> {
    await this.dataLoadPromise;

    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, "127.0.0.1", () => {
        logger.info(
          `Mock SportsDataIO NFL server running on http://localhost:${this.port}`,
        );
        logger.info(
          "Server bound to localhost only - not accessible from external networks",
        );
        resolve();
      });
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    for (const interval of this.autoAdvanceIntervals.values()) {
      clearInterval(interval);
    }
    this.autoAdvanceIntervals.clear();

    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) {
          logger.error({ error: err }, "Error stopping server");
          reject(err);
        } else {
          logger.info("Server stopped");
          resolve();
        }
      });
    });
  }
}

/**
 * Parse command line arguments
 */
function parseArguments(): {
  port: number;
  fixtureDir: string;
  autoAdvance: boolean;
  autoAdvanceInterval: number;
  autoAdvanceGameId?: number;
} {
  const { values } = parseArgs({
    options: {
      port: {
        type: "string",
        short: "p",
        default: "4569",
      },
      fixtureDir: {
        type: "string",
        short: "d",
        default: "fixtures/nfl",
      },
      autoAdvance: {
        type: "boolean",
        short: "a",
        default: false,
      },
      autoAdvanceInterval: {
        type: "string",
        short: "i",
        default: "30000",
      },
      autoAdvanceGameId: {
        type: "string",
        short: "g",
      },
    },
  });

  const port = parseInt(values.port as string, 10);
  if (isNaN(port) || port < 1024 || port > 65535) {
    throw new Error("Port must be a number between 1024 and 65535");
  }

  const autoAdvanceInterval = parseInt(
    values.autoAdvanceInterval as string,
    10,
  );
  if (isNaN(autoAdvanceInterval) || autoAdvanceInterval < 1000) {
    throw new Error("autoAdvanceInterval must be at least 1000ms");
  }

  let autoAdvanceGameId: number | undefined;
  if (values.autoAdvanceGameId) {
    const parsed = parseInt(values.autoAdvanceGameId, 10);
    if (isNaN(parsed)) {
      throw new Error("autoAdvanceGameId must be a valid number");
    }
    autoAdvanceGameId = parsed;
  }

  return {
    port,
    fixtureDir: values.fixtureDir as string,
    autoAdvance: values.autoAdvance as boolean,
    autoAdvanceInterval,
    autoAdvanceGameId,
  };
}

async function main(): Promise<void> {
  const args = parseArguments();

  logger.info("Starting NFL Mock SportsDataIO Server...");
  logger.info(`Port: ${args.port}`);
  logger.info(`fixture directory: ${args.fixtureDir}`);
  if (args.autoAdvance) {
    logger.info(
      `Auto-advance: enabled (${args.autoAdvanceInterval}ms interval)`,
    );
    if (args.autoAdvanceGameId) {
      logger.info(`Auto-advance game: ${args.autoAdvanceGameId}`);
    }
  }

  const server = new SimpleMockSportsDataIOServer(args.port, args.fixtureDir);

  await server.start();

  logger.info(`\n========================================`);
  logger.info(`Mock SportsDataIO NFL Server Ready`);
  logger.info(`Base URL: http://localhost:${args.port}`);
  logger.info(`\nEndpoints:`);
  logger.info(`  GET  /stats/json/schedules/:season`);
  logger.info(`  GET  /pbp/json/playbyplay/:providerGameId`);
  logger.info(`  POST /mock/advance/:providerGameId`);
  logger.info(`  POST /mock/reset/:providerGameId`);
  logger.info(`  POST /mock/auto-advance/:providerGameId`);
  logger.info(`  POST /mock/stop-auto-advance/:providerGameId`);
  logger.info(`\nExamples:`);
  logger.info(`  curl http://localhost:${args.port}/stats/json/schedules/2025`);
  logger.info(`  curl http://localhost:${args.port}/pbp/json/playbyplay/19068`);
  logger.info(
    `  curl -X POST http://localhost:${args.port}/mock/advance/19068`,
  );
  logger.info(`========================================\n`);

  if (args.autoAdvance && args.autoAdvanceGameId) {
    try {
      logger.info(
        `Starting auto-advance for game ${args.autoAdvanceGameId}...`,
      );
      const response = await fetch(
        `http://localhost:${args.port}/mock/auto-advance/${args.autoAdvanceGameId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intervalMs: args.autoAdvanceInterval }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      logger.info(`Auto-advance started: ${JSON.stringify(result)}`);
    } catch (error) {
      logger.error({ error }, "Failed to start auto-advance");
    }
  }

  process.on("SIGINT", async () => {
    logger.info("\nShutting down mock server...");
    await server.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.info("\nShutting down mock server...");
    await server.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error({ error }, "Fatal error starting mock server");
  process.exit(1);
});
