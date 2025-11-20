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
  private async loadSnapshotFiles(providerGameId: number): Promise<string[]> {
    if (this.snapshotFiles.has(providerGameId)) {
      return this.snapshotFiles.get(providerGameId)!;
    }

    const playsDir = path.join(this.baselineDir, "plays");
    const files: string[] = [];

    // Look for numbered snapshots (19068-0.json, 19068-1.json, etc.)
    let index = 0;
    while (true) {
      const filePath = path.join(playsDir, `${providerGameId}-${index}.json`);
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
      const basePath = path.join(playsDir, `${providerGameId}.json`);
      try {
        await fs.access(basePath);
        files.push(basePath);
      } catch {
        // No files found
      }
    }

    this.snapshotFiles.set(providerGameId, files);
    return files;
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    this.app.use(express.json());

    /**
     * GET /pbp/json/playbyplay/:providerGameId
     * Returns play-by-play data for a game
     */
    this.app.get(
      "/pbp/json/playbyplay/:providerGameId",
      async (req: Request, res: Response) => {
        try {
          const providerGameId = parseInt(req.params.providerGameId || "", 10);

          if (isNaN(providerGameId)) {
            res.status(400).json({ error: "Invalid providerGameId" });
            return;
          }

          // Load available snapshots
          const snapshots = await this.loadSnapshotFiles(providerGameId);

          if (snapshots.length === 0) {
            res.status(404).json({ error: "Game not found" });
            return;
          }

          // Get current snapshot index (defaults to 0)
          const currentIndex =
            this.currentSnapshotIndex.get(providerGameId) || 0;
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
            `[MockSportsDataIO] Serving snapshot ${snapshotIndex} for game ${providerGameId} (${snapshots.length} total)`,
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
     * POST /mock/advance/:providerGameId
     * Advance to next snapshot (for testing)
     */
    this.app.post(
      "/mock/advance/:providerGameId",
      async (req: Request, res: Response) => {
        try {
          const providerGameId = parseInt(req.params.providerGameId || "", 10);
          if (isNaN(providerGameId)) {
            res.status(400).json({ error: "Invalid providerGameId" });
            return;
          }

          const snapshots = await this.loadSnapshotFiles(providerGameId);

          const currentIndex =
            this.currentSnapshotIndex.get(providerGameId) || 0;
          const nextIndex = Math.min(currentIndex + 1, snapshots.length - 1);

          this.currentSnapshotIndex.set(providerGameId, nextIndex);

          this.logger.info(
            `[MockSportsDataIO] Advanced game ${providerGameId} to snapshot ${nextIndex}/${snapshots.length - 1}`,
          );

          res.json({
            providerGameId,
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
     * POST /mock/reset/:providerGameId
     * Reset to first snapshot (for testing)
     */
    this.app.post(
      "/mock/reset/:providerGameId",
      (req: Request, res: Response) => {
        const providerGameId = parseInt(req.params.providerGameId || "", 10);
        if (isNaN(providerGameId)) {
          res.status(400).json({ error: "Invalid providerGameId" });
          return;
        }

        this.currentSnapshotIndex.set(providerGameId, 0);

        this.logger.info(
          `[MockSportsDataIO] Reset game ${providerGameId} to snapshot 0`,
        );

        res.json({ providerGameId, currentSnapshot: 0 });
      },
    );

    /**
     * POST /mock/auto-advance/:providerGameId
     * Auto-advance snapshots every N seconds
     */
    this.app.post(
      "/mock/auto-advance/:providerGameId",
      async (req: Request, res: Response) => {
        const providerGameId = parseInt(req.params.providerGameId || "", 10);
        if (isNaN(providerGameId)) {
          res.status(400).json({ error: "Invalid providerGameId" });
          return;
        }

        const intervalMs = parseInt(
          (req.body?.intervalMs as string) || "30000",
          10,
        );

        const snapshots = await this.loadSnapshotFiles(providerGameId);

        // Start auto-advance interval
        const interval = setInterval(async () => {
          const currentIndex =
            this.currentSnapshotIndex.get(providerGameId) || 0;

          if (currentIndex >= snapshots.length - 1) {
            clearInterval(interval);
            this.logger.info(
              `[MockSportsDataIO] Auto-advance complete for game ${providerGameId}`,
            );
            return;
          }

          const nextIndex = currentIndex + 1;
          this.currentSnapshotIndex.set(providerGameId, nextIndex);

          this.logger.info(
            `[MockSportsDataIO] Auto-advanced game ${providerGameId} to snapshot ${nextIndex}`,
          );
        }, intervalMs);

        res.json({
          providerGameId,
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
