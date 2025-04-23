import { BalanceManager } from './balance-manager.service';
import { PriceTracker } from './price-tracker.service';
import { TradeSimulator } from './trade-simulator.service';
import { CompetitionManager } from './competition-manager.service';
import { TeamManager } from './team-manager.service';
import { SchedulerService } from './scheduler.service';

/**
 * Service Registry
 * Manages all service instances and their dependencies
 */
class ServiceRegistry {
  private static instance: ServiceRegistry;

  // Services
  private _balanceManager: BalanceManager;
  private _priceTracker: PriceTracker;
  private _tradeSimulator: TradeSimulator;
  private _competitionManager: CompetitionManager;
  private _teamManager: TeamManager;
  private _scheduler: SchedulerService;

  private constructor() {
    // Initialize services in dependency order
    this._balanceManager = new BalanceManager();
    this._priceTracker = new PriceTracker();
    this._tradeSimulator = new TradeSimulator(this._balanceManager, this._priceTracker);
    this._competitionManager = new CompetitionManager(
      this._balanceManager,
      this._tradeSimulator,
      this._priceTracker,
    );
    this._teamManager = new TeamManager();

    // Initialize and start the scheduler
    this._scheduler = new SchedulerService(this._competitionManager);

    console.log('[ServiceRegistry] All services initialized');
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  // Service getters
  get balanceManager(): BalanceManager {
    return this._balanceManager;
  }

  get priceTracker(): PriceTracker {
    return this._priceTracker;
  }

  get tradeSimulator(): TradeSimulator {
    return this._tradeSimulator;
  }

  get competitionManager(): CompetitionManager {
    return this._competitionManager;
  }

  get teamManager(): TeamManager {
    return this._teamManager;
  }

  get scheduler(): SchedulerService {
    return this._scheduler;
  }
}

// Create and export a singleton instance
export const services = ServiceRegistry.getInstance();

// Export service types for convenience
export { BalanceManager, PriceTracker, TradeSimulator, CompetitionManager, TeamManager };
