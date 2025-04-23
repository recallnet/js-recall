import { CompetitionManager } from './competition-manager.service';
import { config } from '../config';

// Keep track of all scheduler timers globally (helpful for tests)
const allSchedulerTimers = new Set<NodeJS.Timeout>();

/**
 * Scheduler Service
 * Handles scheduled tasks like regular portfolio snapshots
 */
export class SchedulerService {
  private competitionManager: CompetitionManager;
  private snapshotInterval: number;
  private snapshotTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private isTestMode: boolean;

  constructor(competitionManager: CompetitionManager) {
    this.competitionManager = competitionManager;
    // Check if we're in test mode
    this.isTestMode = process.env.TEST_MODE === 'true';

    // Get the snapshot interval from environment config with default
    this.snapshotInterval = config.portfolio.snapshotIntervalMs;
    console.log(
      `[SchedulerService] Initialized with snapshot interval of ${this.snapshotInterval}ms${this.isTestMode ? ' (TEST MODE)' : ''}`,
    );
  }

  /**
   * Start the portfolio snapshot scheduler
   */
  startSnapshotScheduler(): void {
    if (this.isShuttingDown) {
      console.log('[SchedulerService] Scheduler is shutting down, cannot start');
      return;
    }

    if (this.snapshotTimer) {
      console.log('[SchedulerService] Snapshot scheduler already running, restarting...');
      this.stopSnapshotScheduler();
    }

    // Use a much shorter interval in test mode to ensure tests run quickly
    const interval = this.isTestMode
      ? Math.min(2000, this.snapshotInterval)
      : this.snapshotInterval;

    console.log(
      `[SchedulerService] Starting portfolio snapshot scheduler at ${interval}ms intervals${this.isTestMode ? ' (TEST MODE)' : ''}`,
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
        console.error('[SchedulerService] Error in snapshot timer callback:', error);
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
   * Stop the portfolio snapshot scheduler
   */
  stopSnapshotScheduler(): void {
    this.isShuttingDown = true;
    console.log('[SchedulerService] Marking scheduler for shutdown');

    // Clear this instance's timer
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);

      // Remove from global set
      if (allSchedulerTimers.has(this.snapshotTimer)) {
        allSchedulerTimers.delete(this.snapshotTimer);
      }

      this.snapshotTimer = null;
      console.log('[SchedulerService] Portfolio snapshot scheduler stopped');
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
      console.log('[SchedulerService] Skipping snapshot due to shutdown in progress');
      return;
    }

    try {
      // Get active competition
      const activeCompetition = await this.competitionManager.getActiveCompetition();

      if (!activeCompetition) {
        console.log('[SchedulerService] No active competition, skipping portfolio snapshots');
        return;
      }

      console.log(
        `[SchedulerService] Taking scheduled portfolio snapshots for competition ${activeCompetition.id}`,
      );
      await this.competitionManager.takePortfolioSnapshots(activeCompetition.id);
    } catch (error) {
      console.error('[SchedulerService] Error taking portfolio snapshots:', error);
      throw error; // Re-throw so caller can handle or log
    }
  }

  /**
   * Get current shutdown status
   */
  isShutDown(): boolean {
    return this.isShuttingDown && this.snapshotTimer === null;
  }

  /**
   * Reset the scheduler service
   * Used primarily in tests to ensure clean state
   */
  reset(): void {
    // Ensure scheduler is stopped
    this.stopSnapshotScheduler();

    // Reset state
    this.isShuttingDown = false;

    // Log reset
    console.log('[SchedulerService] Service reset complete');
  }

  /**
   * Static method to clear all timers globally (for test cleanup)
   */
  static clearAllTimers(): void {
    console.log(`[SchedulerService] Clearing all ${allSchedulerTimers.size} global timers`);

    // Clear all timers in the global set
    allSchedulerTimers.forEach((timer) => {
      clearInterval(timer);
      clearTimeout(timer);
    });

    // Clear the set
    allSchedulerTimers.clear();
  }
}
