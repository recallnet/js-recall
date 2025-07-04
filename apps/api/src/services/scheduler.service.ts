import { config } from "@/config/index.js";
import { CompetitionManager } from "@/services/competition-manager.service.js";

import { PortfolioSnapshotter } from "./portfolio-snapshotter.service.js";

// Keep track of all scheduler timers globally (helpful for tests)
const allSchedulerTimers = new Set<NodeJS.Timeout>();

/**
 * Scheduler Service
 * Handles scheduled tasks like regular portfolio snapshots and competition end date checks
 */
export class SchedulerService {
  private competitionManager: CompetitionManager;
  private portfolioSnapshotter: PortfolioSnapshotter;
  private snapshotInterval: number;
  private competitionEndCheckInterval: number;
  private snapshotTimer: NodeJS.Timeout | null = null;
  private competitionEndTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private isTestMode: boolean;

  constructor(
    competitionManager: CompetitionManager,
    portfolioSnapshotter: PortfolioSnapshotter,
  ) {
    this.competitionManager = competitionManager;
    this.portfolioSnapshotter = portfolioSnapshotter;
    // Check if we're in test mode
    this.isTestMode = process.env.TEST_MODE === "true";

    // Get intervals from environment config
    this.snapshotInterval = config.portfolio.snapshotIntervalMs;
    this.competitionEndCheckInterval =
      config.portfolio.competitionEndCheckIntervalMs;

    console.log(
      `[SchedulerService] Initialized with snapshot interval: ${this.snapshotInterval}ms, competition end check interval: ${this.competitionEndCheckInterval}ms${this.isTestMode ? " (TEST MODE)" : ""}`,
    );
  }

  /**
   * Start the portfolio snapshot scheduler
   */
  startSnapshotScheduler(): void {
    if (this.isShuttingDown) {
      console.log(
        "[SchedulerService] Scheduler is shutting down, cannot start",
      );
      return;
    }

    if (this.snapshotTimer) {
      console.log(
        "[SchedulerService] Snapshot scheduler already running, restarting...",
      );
      this.stopSnapshotScheduler();
    }

    // Use a much shorter interval in test mode to ensure tests run quickly
    const interval = this.isTestMode
      ? Math.min(2000, this.snapshotInterval)
      : this.snapshotInterval;

    console.log(
      `[SchedulerService] Starting portfolio snapshot scheduler at ${interval}ms intervals${this.isTestMode ? " (TEST MODE)" : ""}`,
    );

    // Schedule periodic snapshots
    this.snapshotTimer = setInterval(async () => {
      if (this.isShuttingDown) {
        this.stopSnapshotScheduler();
        return;
      }
      try {
        await this.takePortfolioSnapshots();
      } catch (error) {
        console.error(
          "[SchedulerService] Error in snapshot timer callback:",
          error,
        );
        // Don't let errors stop the scheduler in production
        if (this.isTestMode) {
          this.stopSnapshotScheduler();
        }
      }
    }, interval);

    // Add to global set of timers
    if (this.snapshotTimer) {
      allSchedulerTimers.add(this.snapshotTimer);
    }
  }

  /**
   * Start both schedulers
   */
  start(): void {
    this.startSnapshotScheduler();
    this.startCompetitionEndScheduler();
  }

  /**
   * Stop both schedulers
   */
  stop(): void {
    this.stopSnapshotScheduler();
    this.stopCompetitionEndScheduler();
  }

  /**
   * Start the competition end date check scheduler
   */
  startCompetitionEndScheduler(): void {
    if (this.isShuttingDown) {
      console.log(
        "[SchedulerService] Scheduler is shutting down, cannot start competition end scheduler",
      );
      return;
    }

    if (this.competitionEndTimer) {
      console.log(
        "[SchedulerService] Competition end scheduler already running, restarting...",
      );
      this.stopCompetitionEndScheduler();
    }

    // Use shorter interval in test mode
    const interval = this.isTestMode
      ? Math.min(5000, this.competitionEndCheckInterval)
      : this.competitionEndCheckInterval;

    console.log(
      `[SchedulerService] Starting competition end check scheduler at ${interval}ms intervals${this.isTestMode ? " (TEST MODE)" : ""}`,
    );

    // Schedule periodic competition end checks
    this.competitionEndTimer = setInterval(async () => {
      if (this.isShuttingDown) {
        this.stopCompetitionEndScheduler();
        return;
      }
      try {
        await this.checkCompetitionEndDates();
      } catch (error) {
        console.error(
          "[SchedulerService] Error in competition end timer callback:",
          error,
        );
        // Don't let errors stop the scheduler in production
        if (this.isTestMode) {
          this.stopCompetitionEndScheduler();
        }
      }
    }, interval);

    // Add to global set of timers
    if (this.competitionEndTimer) {
      allSchedulerTimers.add(this.competitionEndTimer);
    }
  }

  /**
   * Stop the competition end date check scheduler
   */
  stopCompetitionEndScheduler(): void {
    if (this.competitionEndTimer) {
      clearInterval(this.competitionEndTimer);

      // Remove from global set
      if (allSchedulerTimers.has(this.competitionEndTimer)) {
        allSchedulerTimers.delete(this.competitionEndTimer);
      }

      this.competitionEndTimer = null;
      console.log("[SchedulerService] Competition end check scheduler stopped");
    }
  }

  /**
   * Check for competitions that have reached their end date and end them
   */
  async checkCompetitionEndDates(): Promise<void> {
    if (this.isShuttingDown) {
      console.log(
        "[SchedulerService] Skipping competition end check due to shutdown in progress",
      );
      return;
    }

    try {
      console.log("[SchedulerService] Checking for competitions ready to end");
      await this.competitionManager.processCompetitionEndDateChecks();
    } catch (error) {
      console.error(
        "[SchedulerService] Error checking competition end dates:",
        error,
      );
      throw error; // Re-throw so caller can handle or log
    }
  }

  /**
   * Stop the portfolio snapshot scheduler
   */
  stopSnapshotScheduler(): void {
    this.isShuttingDown = true;
    console.log("[SchedulerService] Marking scheduler for shutdown");

    // Clear snapshot timer
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);

      // Remove from global set
      if (allSchedulerTimers.has(this.snapshotTimer)) {
        allSchedulerTimers.delete(this.snapshotTimer);
      }

      this.snapshotTimer = null;
      console.log("[SchedulerService] Portfolio snapshot scheduler stopped");
    }

    // In test mode, also clear all known timers for safety
    if (this.isTestMode) {
      console.log(
        `[SchedulerService] TEST MODE - clearing ${allSchedulerTimers.size} additional timers`,
      );
      allSchedulerTimers.forEach((timer) => {
        clearInterval(timer);
        clearTimeout(timer);
      });
      allSchedulerTimers.clear();
    }
  }

  /**
   * Take portfolio snapshots for active competition
   */
  async takePortfolioSnapshots(): Promise<void> {
    if (this.isShuttingDown) {
      console.log(
        "[SchedulerService] Skipping snapshot due to shutdown in progress",
      );
      return;
    }

    try {
      // Get active competition
      const activeCompetition =
        await this.competitionManager.getActiveCompetition();

      if (!activeCompetition) {
        console.log(
          "[SchedulerService] No active competition, skipping portfolio snapshots",
        );
        return;
      }

      console.log(
        `[SchedulerService] Taking scheduled portfolio snapshots for competition ${activeCompetition.id}`,
      );
      await this.portfolioSnapshotter.takePortfolioSnapshots(
        activeCompetition.id,
      );
    } catch (error) {
      console.error(
        "[SchedulerService] Error taking portfolio snapshots:",
        error,
      );
      throw error; // Re-throw so caller can handle or log
    }
  }

  /**
   * Get current shutdown status
   */
  isShutDown(): boolean {
    return (
      this.isShuttingDown &&
      this.snapshotTimer === null &&
      this.competitionEndTimer === null
    );
  }

  /**
   * Reset the scheduler service
   * Used primarily in tests to ensure clean state
   */
  reset(): void {
    // Ensure both schedulers are stopped
    this.stop();

    // Reset state
    this.isShuttingDown = false;

    console.log("[SchedulerService] Service reset complete");
  }

  /**
   * Static method to clear all timers globally (for test cleanup)
   */
  static clearAllTimers(): void {
    console.log(
      `[SchedulerService] Clearing all ${allSchedulerTimers.size} global timers`,
    );

    // Clear all timers in the global set
    allSchedulerTimers.forEach((timer) => {
      clearInterval(timer);
      clearTimeout(timer);
    });

    // Clear the set
    allSchedulerTimers.clear();
  }
}
