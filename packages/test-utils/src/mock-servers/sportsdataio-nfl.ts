import express, { Express, Request, Response } from "express";
import * as fs from "fs/promises";
import { Server } from "http";
import * as path from "path";
import { Logger } from "pino";

/**
 * Mock SportsDataIO NFL Server
 * Simulates the SportsDataIO Play-by-Play API for testing
 */
export class MockSportsDataIONflServer {
  private app: Express;
  private server: Server | null = null;
  private port: number;
  private logger: Logger;
  private baselineDir: string;
  private currentSnapshotIndex: Map<number, number> = new Map();
  private snapshotFiles: Map<number, string[]> = new Map();

  constructor(port: number, logger: Logger, baselineDir: string) {
    this.port = port;
    this.logger = logger;
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

    // Look for numbered snapshots (19068-0.json, 19068-1.json, etc.)
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

    // If no numbered files, try the base file
    if (files.length === 0) {
      const basePath = path.join(playsDir, `${globalGameId}.json`);
      try {
        await fs.access(basePath);
        files.push(basePath);
      } catch {
        // No files found
      }
    }

    this.snapshotFiles.set(globalGameId, files);
    return files;
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    this.app.use(express.json());

    /**
     * GET /pbp/json/PlayByPlay/:globalGameId
     * Returns play-by-play data for a game
     */
    this.app.get(
      "/pbp/json/PlayByPlay/:globalGameId",
      async (req: Request, res: Response) => {
        try {
          const globalGameId = parseInt(req.params.globalGameId || "", 10);

          if (isNaN(globalGameId)) {
            res.status(400).json({ error: "Invalid globalGameId" });
            return;
          }

          // Load available snapshots
          const snapshots = await this.loadSnapshotFiles(globalGameId);

          if (snapshots.length === 0) {
            res.status(404).json({ error: "Game not found" });
            return;
          }

          // Get current snapshot index (defaults to 0)
          const currentIndex = this.currentSnapshotIndex.get(globalGameId) || 0;
          const snapshotIndex = Math.min(currentIndex, snapshots.length - 1);
          const snapshotPath = snapshots[snapshotIndex];
          if (!snapshotPath) {
            res.status(404).json({ error: "Snapshot not found" });
            return;
          }

          // Read and return the snapshot
          const content = await fs.readFile(snapshotPath, "utf-8");
          const data = JSON.parse(content);

          this.logger.info(
            `[MockSportsDataIO] Serving snapshot ${snapshotIndex} for game ${globalGameId} (${snapshots.length} total)`,
          );

          res.json(data);
        } catch (error) {
          this.logger.error(
            { error },
            "[MockSportsDataIO] Error serving play-by-play",
          );
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );

    /**
     * GET /scores/json/Scores/:season/:week
     * Returns scores for all games in a week
     */
    this.app.get(
      "/scores/json/Scores/:season/:week",
      async (req: Request, res: Response) => {
        try {
          const season = parseInt(req.params.season || "", 10);
          const week = parseInt(req.params.week || "", 10);

          // For now, return empty array or mock data
          // In the future, could load from games.json
          res.json([]);
        } catch (error) {
          this.logger.error(
            { error },
            "[MockSportsDataIO] Error serving scores",
          );
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );

    /**
     * POST /mock/advance/:globalGameId
     * Advance to next snapshot (for testing)
     */
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

          this.logger.info(
            `[MockSportsDataIO] Advanced game ${globalGameId} to snapshot ${nextIndex}/${snapshots.length - 1}`,
          );

          res.json({
            globalGameId,
            currentSnapshot: nextIndex,
            totalSnapshots: snapshots.length,
          });
        } catch (error) {
          this.logger.error(
            { error },
            "[MockSportsDataIO] Error advancing snapshot",
          );
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );

    /**
     * POST /mock/reset/:globalGameId
     * Reset to first snapshot (for testing)
     */
    this.app.post(
      "/mock/reset/:globalGameId",
      (req: Request, res: Response) => {
        const globalGameId = parseInt(req.params.globalGameId || "", 10);
        if (isNaN(globalGameId)) {
          res.status(400).json({ error: "Invalid globalGameId" });
          return;
        }

        this.currentSnapshotIndex.set(globalGameId, 0);

        this.logger.info(
          `[MockSportsDataIO] Reset game ${globalGameId} to snapshot 0`,
        );

        res.json({ globalGameId, currentSnapshot: 0 });
      },
    );

    /**
     * POST /mock/auto-advance/:globalGameId
     * Auto-advance snapshots every N seconds
     */
    this.app.post(
      "/mock/auto-advance/:globalGameId",
      async (req: Request, res: Response) => {
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

        // Start auto-advance interval
        const interval = setInterval(async () => {
          const currentIndex = this.currentSnapshotIndex.get(globalGameId) || 0;

          if (currentIndex >= snapshots.length - 1) {
            clearInterval(interval);
            this.logger.info(
              `[MockSportsDataIO] Auto-advance complete for game ${globalGameId}`,
            );
            return;
          }

          const nextIndex = currentIndex + 1;
          this.currentSnapshotIndex.set(globalGameId, nextIndex);

          this.logger.info(
            `[MockSportsDataIO] Auto-advanced game ${globalGameId} to snapshot ${nextIndex}`,
          );
        }, intervalMs);

        res.json({
          globalGameId,
          intervalMs,
          totalSnapshots: snapshots.length,
          message: "Auto-advance started",
        });
      },
    );
  }

  /**
   * Start the mock server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        this.logger.info(
          `[MockSportsDataIO] Mock SportsDataIO NFL server running on port ${this.port}`,
        );
        resolve();
      });
    });
  }

  /**
   * Stop the mock server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) {
          this.logger.error(
            { error: err },
            "[MockSportsDataIO] Error stopping server",
          );
          reject(err);
        } else {
          this.logger.info("[MockSportsDataIO] Server stopped");
          resolve();
        }
      });
    });
  }

  /**
   * Get the base URL for the mock server
   */
  getBaseUrl(): string {
    return `http://localhost:${this.port}`;
  }
}
