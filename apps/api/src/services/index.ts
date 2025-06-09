import { AdminManager } from "@/services/admin-manager.service.js";
import { AgentManager } from "@/services/agent-manager.service.js";
import { AuthService } from "@/services/auth.service.js";
import { BalanceManager } from "@/services/balance-manager.service.js";
import { CompetitionManager } from "@/services/competition-manager.service.js";
import { ConfigurationService } from "@/services/configuration.service.js";
import { LeaderboardService } from "@/services/leaderboard.service.js";
import { PortfolioSnapshotter } from "@/services/portfolio-snapshotter.service.js";
import { PriceTracker } from "@/services/price-tracker.service.js";
import { SchedulerService } from "@/services/scheduler.service.js";
import { TradeSimulator } from "@/services/trade-simulator.service.js";
import { UserManager } from "@/services/user-manager.service.js";
import { VoteManager } from "@/services/vote-manager.service.js";

/**
 * Service Registry
 * Manages all service instances and their dependencies
 */
class ServiceRegistry {
  private static instance: ServiceRegistry;

  // Services
  private _authService: AuthService;
  private _balanceManager: BalanceManager;
  private _priceTracker: PriceTracker;
  private _tradeSimulator: TradeSimulator;
  private _competitionManager: CompetitionManager;
  private _userManager: UserManager;
  private _agentManager: AgentManager;
  private _adminManager: AdminManager;
  private _scheduler: SchedulerService;
  private _configurationService: ConfigurationService;
  private _portfolioSnapshotter: PortfolioSnapshotter;
  private _leaderboardService: LeaderboardService;
  private _voteManager: VoteManager;

  constructor() {
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

    // Initialize user and agent managers (new architecture)
    this._userManager = new UserManager();
    this._agentManager = new AgentManager();
    this._adminManager = new AdminManager();

    // Initialize auth service (no dependencies needed)
    this._authService = new AuthService();

    // Configuration service for dynamic settings
    this._configurationService = new ConfigurationService();

    this._competitionManager = new CompetitionManager(
      this._balanceManager,
      this._tradeSimulator,
      this._portfolioSnapshotter,
      this._agentManager,
      this._configurationService,
    );

    this._leaderboardService = new LeaderboardService();

    // Initialize vote manager (no dependencies)
    this._voteManager = new VoteManager();

    // Initialize and start the scheduler
    this._scheduler = new SchedulerService(
      this._competitionManager,
      this._portfolioSnapshotter,
    );

    console.log("[ServiceRegistry] All services initialized");
  }

  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  // Service getters
  get authService(): AuthService {
    return this._authService;
  }

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

  get leaderboardService(): LeaderboardService {
    return this._leaderboardService;
  }

  get portfolioSnapshotter(): PortfolioSnapshotter {
    return this._portfolioSnapshotter;
  }

  get userManager(): UserManager {
    return this._userManager;
  }

  get agentManager(): AgentManager {
    return this._agentManager;
  }

  get adminManager(): AdminManager {
    return this._adminManager;
  }

  get scheduler(): SchedulerService {
    return this._scheduler;
  }

  get configurationService(): ConfigurationService {
    return this._configurationService;
  }

  get voteManager(): VoteManager {
    return this._voteManager;
  }
}

// Export service types for convenience
export {
  AuthService,
  BalanceManager,
  PriceTracker,
  TradeSimulator,
  CompetitionManager,
  UserManager,
  AgentManager,
  AdminManager,
  ConfigurationService,
  ServiceRegistry,
  PortfolioSnapshotter,
  LeaderboardService,
  VoteManager,
};

export default ServiceRegistry;
