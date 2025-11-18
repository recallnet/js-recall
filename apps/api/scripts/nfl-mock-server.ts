import * as dotenv from "dotenv";
import express, { Express, Request, Response } from "express";
import * as fs from "fs/promises";
import { Server } from "http";
import * as path from "path";
import { parseArgs } from "util";

import { createLogger } from "@/lib/logger.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const logger = createLogger("NFLMockServer");

/**
 * Simple Mock SportsDataIO NFL Server
 * Serves baseline data progressively for development/testing
 */
class SimpleMockSportsDataIOServer {
  private app: Express;
  private server: Server | null = null;
  private port: number;
  private baselineDir: string;
  private currentSnapshotIndex: Map<number, number> = new Map();
  private snapshotFiles: Map<number, string[]> = new Map();
  private autoAdvanceIntervals: Map<number, NodeJS.Timeout> = new Map();

  constructor(port: number, baselineDir: string) {
    this.port = port;
    this.baselineDir = baselineDir;
    this.app = express();
    this.setupRoutes();
  }

  /**
   * Load available snapshot files for a game
   */
  private async loadSnapshotFiles(globalGameId: number): Promise<string[]> {
    if (this.snapshotFiles.has(globalGameId)) {
      return this.snapshotFiles.get(globalGameId)!;
    }

    const playsDir = path.join(this.baselineDir, "plays");
    const files: string[] = [];

    // Look for numbered snapshots
    let index = 0;
    while (true) {
      const filePath = path.join(playsDir, `${globalGameId}-${index}.json`);
      try {
        await fs.access(filePath);
        files.push(filePath);
        index++;
      } catch {
        break;
      }
    }

    this.snapshotFiles.set(globalGameId, files);
    logger.info(`Loaded ${files.length} snapshots for game ${globalGameId}`);
    return files;
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    this.app.use(express.json());

    // GET /scores/json/Schedules/:season
    this.app.get(
      "/scores/json/Schedules/:season",
      async (req: Request, res: Response) => {
        try {
          const season = req.params.season;

          if (!season) {
            res.status(400).json({ error: "Season is required" });
            return;
          }

          // Look for schedule files in baseline/nfl/schedule/
          const scheduleDir = path.join(this.baselineDir, "schedule");
          const files: string[] = [];

          // Look for numbered schedule files
          let index = 0;
          while (true) {
            const filePath = path.join(scheduleDir, `${season}-${index}.json`);
            try {
              await fs.access(filePath);
              files.push(filePath);
              index++;
            } catch {
              break;
            }
          }

          if (files.length === 0) {
            res.status(404).json({ error: "Schedule not found for season" });
            return;
          }

          // Combine all schedule files into one array
          const allGames = [];
          for (const file of files) {
            const content = await fs.readFile(file, "utf-8");
            const games = JSON.parse(content);
            allGames.push(...games);
          }

          logger.info(
            `Serving schedule for season ${season} (${allGames.length} games from ${files.length} files)`,
          );

          res.json(allGames);
        } catch (error) {
          logger.error({ error }, "Error serving schedule");
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );

    // GET /pbp/json/PlayByPlay/:globalGameId
    this.app.get(
      "/pbp/json/PlayByPlay/:globalGameId",
      async (req: Request, res: Response) => {
        try {
          const globalGameId = parseInt(req.params.globalGameId || "", 10);

          if (isNaN(globalGameId)) {
            res.status(400).json({ error: "Invalid globalGameId" });
            return;
          }

          const snapshots = await this.loadSnapshotFiles(globalGameId);

          if (snapshots.length === 0) {
            res.status(404).json({ error: "Game not found" });
            return;
          }

          const currentIndex = this.currentSnapshotIndex.get(globalGameId) || 0;
          const snapshotIndex = Math.min(currentIndex, snapshots.length - 1);
          const snapshotPath = snapshots[snapshotIndex];

          if (!snapshotPath) {
            res.status(404).json({ error: "Snapshot not found" });
            return;
          }

          const content = await fs.readFile(snapshotPath, "utf-8");
          const data = JSON.parse(content);

          logger.info(
            `Serving snapshot ${snapshotIndex}/${snapshots.length - 1} for game ${globalGameId}`,
          );

          res.json(data);
        } catch (error) {
          logger.error({ error }, "Error serving play-by-play");
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );

    // POST /mock/advance/:globalGameId
    this.app.post(
      "/mock/advance/:globalGameId",
      async (req: Request, res: Response) => {
        try {
          const globalGameId = parseInt(req.params.globalGameId || "", 10);
          if (isNaN(globalGameId)) {
            res.status(400).json({ error: "Invalid globalGameId" });
            return;
          }

          const snapshots = await this.loadSnapshotFiles(globalGameId);
          const currentIndex = this.currentSnapshotIndex.get(globalGameId) || 0;
          const nextIndex = Math.min(currentIndex + 1, snapshots.length - 1);

          this.currentSnapshotIndex.set(globalGameId, nextIndex);

          logger.info(
            `Advanced game ${globalGameId} to snapshot ${nextIndex}/${snapshots.length - 1}`,
          );

          res.json({
            globalGameId,
            currentSnapshot: nextIndex,
            totalSnapshots: snapshots.length,
          });
        } catch (error) {
          logger.error({ error }, "Error advancing snapshot");
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );

    // POST /mock/reset/:globalGameId
    this.app.post(
      "/mock/reset/:globalGameId",
      (req: Request, res: Response) => {
        const globalGameId = parseInt(req.params.globalGameId || "", 10);
        if (isNaN(globalGameId)) {
          res.status(400).json({ error: "Invalid globalGameId" });
          return;
        }

        this.currentSnapshotIndex.set(globalGameId, 0);
        logger.info(`Reset game ${globalGameId} to snapshot 0`);

        res.json({ globalGameId, currentSnapshot: 0 });
      },
    );

    // POST /mock/auto-advance/:globalGameId
    this.app.post(
      "/mock/auto-advance/:globalGameId",
      async (req: Request, res: Response) => {
        try {
          const globalGameId = parseInt(req.params.globalGameId || "", 10);
          if (isNaN(globalGameId)) {
            res.status(400).json({ error: "Invalid globalGameId" });
            return;
          }

          const intervalMs = parseInt(
            (req.body?.intervalMs as string) || "30000",
            10,
          );

          const snapshots = await this.loadSnapshotFiles(globalGameId);

          // Stop existing interval if any
          const existingInterval = this.autoAdvanceIntervals.get(globalGameId);
          if (existingInterval) {
            clearInterval(existingInterval);
          }

          // Start auto-advance interval
          const interval = setInterval(async () => {
            const currentIndex =
              this.currentSnapshotIndex.get(globalGameId) || 0;

            if (currentIndex >= snapshots.length - 1) {
              clearInterval(interval);
              this.autoAdvanceIntervals.delete(globalGameId);
              logger.info(
                `Auto-advance complete for game ${globalGameId} (reached final snapshot)`,
              );
              return;
            }

            const nextIndex = currentIndex + 1;
            this.currentSnapshotIndex.set(globalGameId, nextIndex);

            logger.info(
              `Auto-advanced game ${globalGameId} to snapshot ${nextIndex}/${snapshots.length - 1}`,
            );
          }, intervalMs);

          this.autoAdvanceIntervals.set(globalGameId, interval);

          logger.info(
            `Started auto-advance for game ${globalGameId} (interval: ${intervalMs}ms, ${snapshots.length} snapshots)`,
          );

          res.json({
            globalGameId,
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

    // POST /mock/stop-auto-advance/:globalGameId
    this.app.post(
      "/mock/stop-auto-advance/:globalGameId",
      (req: Request, res: Response) => {
        const globalGameId = parseInt(req.params.globalGameId || "", 10);
        if (isNaN(globalGameId)) {
          res.status(400).json({ error: "Invalid globalGameId" });
          return;
        }

        const interval = this.autoAdvanceIntervals.get(globalGameId);
        if (interval) {
          clearInterval(interval);
          this.autoAdvanceIntervals.delete(globalGameId);
          logger.info(`Stopped auto-advance for game ${globalGameId}`);
          res.json({ globalGameId, message: "Auto-advance stopped" });
        } else {
          res
            .status(404)
            .json({ error: "No auto-advance running for this game" });
        }
      },
    );
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        logger.info(
          `Mock SportsDataIO NFL server running on port ${this.port}`,
        );
        resolve();
      });
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    // Clear all auto-advance intervals
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
  baselineDir: string;
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
      baselineDir: {
        type: "string",
        short: "d",
        default: "baseline/nfl",
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

  return {
    port: parseInt(values.port as string),
    baselineDir: values.baselineDir as string,
    autoAdvance: values.autoAdvance as boolean,
    autoAdvanceInterval: parseInt(values.autoAdvanceInterval as string),
    autoAdvanceGameId: values.autoAdvanceGameId
      ? parseInt(values.autoAdvanceGameId)
      : undefined,
  };
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = parseArguments();

  logger.info("Starting NFL Mock SportsDataIO Server...");
  logger.info(`Port: ${args.port}`);
  logger.info(`Baseline directory: ${args.baselineDir}`);
  if (args.autoAdvance) {
    logger.info(
      `Auto-advance: enabled (${args.autoAdvanceInterval}ms interval)`,
    );
    if (args.autoAdvanceGameId) {
      logger.info(`Auto-advance game: ${args.autoAdvanceGameId}`);
    }
  }

  const server = new SimpleMockSportsDataIOServer(args.port, args.baselineDir);

  await server.start();

  logger.info(`\n========================================`);
  logger.info(`Mock SportsDataIO NFL Server Ready`);
  logger.info(`Base URL: http://localhost:${args.port}`);
  logger.info(`\nEndpoints:`);
  logger.info(`  GET  /scores/json/Schedules/:season`);
  logger.info(`  GET  /pbp/json/PlayByPlay/:globalGameId`);
  logger.info(`  POST /mock/advance/:globalGameId`);
  logger.info(`  POST /mock/reset/:globalGameId`);
  logger.info(`  POST /mock/auto-advance/:globalGameId`);
  logger.info(`  POST /mock/stop-auto-advance/:globalGameId`);
  logger.info(`\nExamples:`);
  logger.info(
    `  curl http://localhost:${args.port}/scores/json/Schedules/2025`,
  );
  logger.info(`  curl http://localhost:${args.port}/pbp/json/PlayByPlay/19068`);
  logger.info(
    `  curl -X POST http://localhost:${args.port}/mock/advance/19068`,
  );
  logger.info(`========================================\n`);

  // Start auto-advance if requested
  if (args.autoAdvance && args.autoAdvanceGameId) {
    logger.info(`Starting auto-advance for game ${args.autoAdvanceGameId}...`);
    const response = await fetch(
      `http://localhost:${args.port}/mock/auto-advance/${args.autoAdvanceGameId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intervalMs: args.autoAdvanceInterval }),
      },
    );
    const result = await response.json();
    logger.info(`Auto-advance started: ${JSON.stringify(result)}`);
  }

  // Handle graceful shutdown
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
