import { config } from "@/config/index.js";
import { CompetitionManager } from "@/services/competition-manager.service.js";
import { EventTracker } from "@/services/event-tracker.service.js";

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
  private eventTracker: EventTracker;
  private snapshotInterval: number;
  private competitionEndCheckInterval: number;
  private eventProcessingInterval: number;
  private snapshotTimer: NodeJS.Timeout | null = null;
  private competitionEndTimer: NodeJS.Timeout | null = null;
  private eventProcessingTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private isTestMode: boolean;

  constructor(
    competitionManager: CompetitionManager,
    portfolioSnapshotter: PortfolioSnapshotter,
    eventTracker: EventTracker,
  ) {
    this.competitionManager = competitionManager;
    this.portfolioSnapshotter = portfolioSnapshotter;
    this.eventTracker = eventTracker;
    // Check if we're in test mode
    this.isTestMode = process.env.TEST_MODE === "true";

    // Get intervals from environment config
    this.snapshotInterval = config.portfolio.snapshotIntervalMs;
    this.competitionEndCheckInterval =
      config.portfolio.competitionEndCheckIntervalMs;
    this.eventProcessingInterval = config.events?.processingIntervalMs || 30000; // 30 seconds default

    console.log(
      `[SchedulerService] Initialized with snapshot interval: ${this.snapshotInterval}ms, competition end check interval: ${this.competitionEndCheckInterval}ms, event processing interval: ${this.eventProcessingInterval}ms${this.isTestMode ? " (TEST MODE)" : ""}`,
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
    this.startEventProcessing();
  }

  /**
   * Stop both schedulers
   */
  stop(): void {
    this.stopSnapshotScheduler();
    this.stopCompetitionEndScheduler();
    this.stopEventProcessing();
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
   * Start the event processing scheduler
   */
  startEventProcessing(): void {
    if (this.isShuttingDown) {
      console.log(
        "[SchedulerService] Scheduler is shutting down, cannot start event processing",
      );
      return;
    }

    if (this.eventProcessingTimer) {
      console.log(
        "[SchedulerService] Event processing already running, restarting...",
      );
      this.stopEventProcessing();
    }

    const interval = this.isTestMode
      ? Math.min(5000, this.eventProcessingInterval)
      : this.eventProcessingInterval;

    console.log(
      `[SchedulerService] Starting event processing at ${interval}ms intervals`,
    );

    this.eventProcessingTimer = setInterval(async () => {
      if (this.isShuttingDown) {
        this.stopEventProcessing();
        return;
      }
      try {
        await this.processEvents();
      } catch (error) {
        console.error("[SchedulerService] Error in event processing:", error);
        if (this.isTestMode) {
          this.stopEventProcessing();
        }
      }
    }, interval);

    if (this.eventProcessingTimer) {
      allSchedulerTimers.add(this.eventProcessingTimer);
    }
  }

  /**
   * Stop event processing
   */
  stopEventProcessing(): void {
    if (this.eventProcessingTimer) {
      clearInterval(this.eventProcessingTimer);
      if (allSchedulerTimers.has(this.eventProcessingTimer)) {
        allSchedulerTimers.delete(this.eventProcessingTimer);
      }
      this.eventProcessingTimer = null;
      console.log("[SchedulerService] Event processing stopped");
    }
  }

  /**
   * Process unprocessed events and ship to data warehouse
   */
  async processEvents(): Promise<void> {
    if (this.isShuttingDown) {
      console.log(
        "[SchedulerService] Skipping event processing due to shutdown",
      );
      return;
    }

    try {
      const unprocessedEvents =
        await this.eventTracker.getUnprocessedEvents(100);

      if (unprocessedEvents.length === 0) {
        return; // No events to process
      }

      console.log(
        `[SchedulerService] Processing ${unprocessedEvents.length} events`,
      );

      // TODO: Implement actual data warehouse shipping logic
      // For now, we'll just log and mark as processed
      for (const event of unprocessedEvents) {
        try {
          // Simulate shipping to data warehouse
          await this.shipEventToDataWarehouse(event);

          // Mark as processed
          await this.eventTracker.markAsProcessed([event.id]);
        } catch (error) {
          console.error(
            `[SchedulerService] Failed to process event ${event.id}:`,
            error,
          );
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          await this.eventTracker.markAsProcessingFailed(
            event.id,
            errorMessage,
          );
        }
      }
    } catch (error) {
      console.error("[SchedulerService] Error processing events:", error);
      throw error;
    }
  }

  /**
   * Ship event to data warehouse
   * TODO: Implement actual data warehouse integration
   */
  private async shipEventToDataWarehouse(event: any): Promise<void> {
    // Placeholder for data warehouse integration
    // This could be:
    // - HTTP POST to data warehouse API
    // - Message queue publishing
    // - File export to S3/GCS
    // - Direct database connection to warehouse

    console.log(`[SchedulerService] Shipping event to data warehouse:`, {
      id: event.id,
      type: event.event?.type,
      source: event.event?.source,
      time: event.event?.time,
    });

    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 10));
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
