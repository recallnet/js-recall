import express, { Express, Request, Response } from "express";
import * as fs from "fs/promises";
import { Server } from "http";
import * as path from "path";
import { Logger } from "pino";

/**
 * Schedule game data from SportsDataIO
 */
export interface ScheduleGame {
  GameKey: string;
  GlobalGameID: number;
  SeasonType: number;
  Season: number;
  Week: number;
  Date: string;
  AwayTeam: string;
  HomeTeam: string;
  Status: string;
  [key: string]: unknown;
}

/**
 * Play-by-play data from SportsDataIO
 */
export interface PlayByPlayData {
  Score: {
    GlobalGameID: number;
    GameKey: string;
    [key: string]: unknown;
  };
  Quarters: unknown[];
  Plays: unknown[];
}

/**
 * Load schedule data from JSON files
 * Loads all schedule files (season-0.json, season-1.json, etc.) into memory
 * @param baselineDir Base directory containing nfl/schedule folder
 * @returns Map of season number to array of games
 */
export async function loadScheduleData(
  baselineDir: string,
  logger: Logger,
): Promise<Map<number, ScheduleGame[]>> {
  const scheduleMap = new Map<number, ScheduleGame[]>();
  const scheduleDir = path.join(baselineDir, "schedule");

  try {
    // Check if directory exists
    await fs.access(scheduleDir);
  } catch {
    // Directory doesn't exist, return empty map
    return scheduleMap;
  }

  // Read all files in schedule directory
  const files = await fs.readdir(scheduleDir);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  for (const file of jsonFiles) {
    // Parse filename to get season (e.g., "2025-0.json" -> season 2025)
    const match = file.match(/^(\d+)-\d+\.json$/);
    if (!match || !match[1]) continue;

    const season = parseInt(match[1], 10);
    const filePath = path.join(scheduleDir, file);

    try {
      const content = await fs.readFile(filePath, "utf-8");
      const games = JSON.parse(content) as ScheduleGame[];

      // Merge with existing games for this season
      const existing = scheduleMap.get(season) || [];
      scheduleMap.set(season, [...existing, ...games]);
    } catch (error) {
      logger.error({ error }, `Error loading schedule file ${file}:`);
    }
  }

  return scheduleMap;
}

/**
 * Load play-by-play snapshots from JSON files
 * Loads all snapshot files (19068-0.json, 19068-1.json, etc.) into memory
 * @param baselineDir Base directory containing nfl/plays folder
 * @returns Map of providerGameId to array of snapshots
 */
export async function loadPlayByPlaySnapshots(
  baselineDir: string,
  logger: Logger,
): Promise<Map<number, PlayByPlayData[]>> {
  const snapshotsMap = new Map<number, PlayByPlayData[]>();
  const playsDir = path.join(baselineDir, "plays");

  try {
    // Check if directory exists
    await fs.access(playsDir);
  } catch {
    // Directory doesn't exist, return empty map
    return snapshotsMap;
  }

  // Read all files in plays directory
  const files = await fs.readdir(playsDir);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  // Group files by providerGameId
  const gameFiles = new Map<number, string[]>();

  for (const file of jsonFiles) {
    // Parse filename: "19068-0.json" or "19068.json" or "19068-full.json"
    const match = file.match(/^(\d+)(-(\d+)|-(full))?\.json$/);
    if (!match || !match[1]) continue;

    const providerGameId = parseInt(match[1], 10);
    const index = match[3] ? parseInt(match[3], 10) : match[4] ? 999 : 0;

    const existing = gameFiles.get(providerGameId) || [];
    existing.push(file);
    gameFiles.set(providerGameId, existing);
  }

  // Load and sort snapshots for each game
  for (const [providerGameId, files] of gameFiles.entries()) {
    const snapshots: PlayByPlayData[] = [];

    // Sort files by index
    const sortedFiles = files.sort((a, b) => {
      const getIndex = (f: string): number => {
        const match = f.match(/^(\d+)-(\d+)\.json$/);
        if (match && match[2]) return parseInt(match[2], 10);
        if (f.includes("-full")) return 999;
        return 0;
      };
      return getIndex(a) - getIndex(b);
    });

    // Load each snapshot
    for (const file of sortedFiles) {
      const filePath = path.join(playsDir, file);
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const data = JSON.parse(content) as PlayByPlayData;
        snapshots.push(data);
      } catch (error) {
        logger.error({ error }, `Error loading play file ${file}:`);
      }
    }

    if (snapshots.length > 0) {
      snapshotsMap.set(providerGameId, snapshots);
    }
  }

  return snapshotsMap;
}

/**
 * Load all NFL mock data (schedule + play-by-play)
 * @param baselineDir Base directory containing nfl/ folder
 * @returns Object with schedule and playByPlay maps
 */
export async function loadAllNflData(
  baselineDir: string,
  logger: Logger,
): Promise<{
  schedule: Map<number, ScheduleGame[]>;
  playByPlay: Map<number, PlayByPlayData[]>;
}> {
  const [schedule, playByPlay] = await Promise.all([
    loadScheduleData(baselineDir, logger),
    loadPlayByPlaySnapshots(baselineDir, logger),
  ]);

  return { schedule, playByPlay };
}

/**
 * Mock SportsDataIO API Server
 * Simulates the SportsDataIO Play-by-Play and Schedule API for testing
 * Data is loaded into memory at startup from JSON baseline files
 */
export class MockSportsDataIOServer {
  private app: Express;
  private server: Server | null = null;
  private port: number;
  private logger: Logger;
  private currentSnapshotIndex: Map<number, number> = new Map();
  private playByPlayData: Map<number, PlayByPlayData[]> = new Map();

  private dataLoadPromise: Promise<void>;

  constructor(port: number, logger: Logger, baselineDir: string) {
    this.port = port;
    this.logger = logger;
    this.app = express();

    // Load data asynchronously (will be awaited in start())
    this.dataLoadPromise = this.loadData(baselineDir);

    this.setupRoutes();
  }

  /**
   * Load all baseline data into memory
   */
  private async loadData(baselineDir: string): Promise<void> {
    const { playByPlay } = await loadAllNflData(baselineDir, this.logger);
    this.playByPlayData = playByPlay;

    this.logger.info(
      `[MockSportsDataIO] Loaded ${this.playByPlayData.size} games with play-by-play data`,
    );

    // Log snapshot counts
    for (const [gameId, snapshots] of this.playByPlayData.entries()) {
      this.logger.debug(
        `[MockSportsDataIO] Game ${gameId}: ${snapshots.length} snapshots`,
      );
    }
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
      (req: Request, res: Response) => {
        try {
          const providerGameId = parseInt(req.params.providerGameId || "", 10);

          if (isNaN(providerGameId)) {
            res.status(400).json({ error: "Invalid providerGameId" });
            return;
          }

          // Get snapshots from memory
          const snapshots = this.playByPlayData.get(providerGameId);

          if (!snapshots || snapshots.length === 0) {
            res.status(404).json({ error: "Game not found" });
            return;
          }

          // Get current snapshot index (defaults to 0)
          const currentIndex =
            this.currentSnapshotIndex.get(providerGameId) || 0;
          const snapshotIndex = Math.min(currentIndex, snapshots.length - 1);
          const snapshot = snapshots[snapshotIndex];

          if (!snapshot) {
            res.status(404).json({ error: "Snapshot not found" });
            return;
          }

          this.logger.info(
            `[MockSportsDataIO] Serving snapshot ${snapshotIndex} for game ${providerGameId} (${snapshots.length} total)`,
          );

          res.json(snapshot);
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
      (req: Request, res: Response) => {
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

        const intervalMs = parseInt(
          (req.body?.intervalMs as string) || "30000",
          10,
        );

        // Start auto-advance interval
        const interval = setInterval(() => {
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
   * Waits for data to be loaded before starting the server
   */
  async start(): Promise<void> {
    // Wait for data to be loaded
    await this.dataLoadPromise;

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
