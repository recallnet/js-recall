import { BalanceManager } from "@/services/balance-manager.service.js";
import { CompetitionManager } from "@/services/competition-manager.service.js";
import { ConfigurationService } from "@/services/configuration.service.js";
import { PortfolioSnapshotter } from "@/services/portfolio-snapshotter.service.js";
import { PriceTracker } from "@/services/price-tracker.service.js";
import { SchedulerService } from "@/services/scheduler.service.js";
import { TeamManager } from "@/services/team-manager.service.js";
import { TradeSimulator } from "@/services/trade-simulator.service.js";

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
  private _configurationService: ConfigurationService;
  private _portfolioSnapshotter: PortfolioSnapshotter;
  private constructor() {
    // Initialize services in dependency order
    this._balanceManager = new BalanceManager();
    this._priceTracker = new PriceTracker();
    this._portfolioSnapshotter = new PortfolioSnapshotter(
      this._balanceManager,
      this._priceTracker,
    );
    this._tradeSimulator = new TradeSimulator(
      this._balanceManager,
      this._priceTracker,
      this._portfolioSnapshotter,
    );
    this._teamManager = new TeamManager();

    // Configuration service for dynamic settings
    this._configurationService = new ConfigurationService();

    this._competitionManager = new CompetitionManager(
      this._balanceManager,
      this._tradeSimulator,
      this._portfolioSnapshotter,
      this._teamManager,
      this._configurationService,
    );

    // Initialize and start the scheduler
    this._scheduler = new SchedulerService(
      this._competitionManager,
      this._portfolioSnapshotter,
    );

    console.log("[ServiceRegistry] All services initialized");
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

  get portfolioSnapshotter(): PortfolioSnapshotter {
    return this._portfolioSnapshotter;
  }

  get teamManager(): TeamManager {
    return this._teamManager;
  }

  get scheduler(): SchedulerService {
    return this._scheduler;
  }

  get configurationService(): ConfigurationService {
    return this._configurationService;
  }
}

// Export service types for convenience
export {
  BalanceManager,
  PriceTracker,
  TradeSimulator,
  CompetitionManager,
  TeamManager,
  ConfigurationService,
  ServiceRegistry,
  PortfolioSnapshotter,
};
