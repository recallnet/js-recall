import { db } from "@/database/db.js";
import { BoostRepository } from "@/database/repositories/boost.repository.js";
import { EventProcessor } from "@/indexing/event-processor.js";
import { EventsRepository } from "@/indexing/events.repository.js";
import { IndexingService } from "@/indexing/indexing.service.js";
import { StakesRepository } from "@/indexing/stakes.repository.js";
import { indexingLogger } from "@/lib/logger.js";
import { AdminManager } from "@/services/admin-manager.service.js";
import { AgentManager } from "@/services/agent-manager.service.js";
import { AgentRankService } from "@/services/agentrank.service.js";
import { BalanceManager } from "@/services/balance-manager.service.js";
import { BoostAwardService } from "@/services/boost-award.service.js";
import { CompetitionManager } from "@/services/competition-manager.service.js";
import { CompetitionRewardService } from "@/services/competition-reward.service.js";
import { ConfigurationService } from "@/services/configuration.service.js";
import { EmailService } from "@/services/email.service.js";
import { LeaderboardService } from "@/services/leaderboard.service.js";
import { PortfolioSnapshotter } from "@/services/portfolio-snapshotter.service.js";
import { PriceTracker } from "@/services/price-tracker.service.js";
import { TradeSimulator } from "@/services/trade-simulator.service.js";
import { TradingConstraintsService } from "@/services/trading-constraints.service.js";
import { UserManager } from "@/services/user-manager.service.js";
import { VoteManager } from "@/services/vote-manager.service.js";

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
  private _userManager: UserManager;
  private _agentManager: AgentManager;
  private _adminManager: AdminManager;
  private _configurationService: ConfigurationService;
  private _portfolioSnapshotter: PortfolioSnapshotter;
  private _leaderboardService: LeaderboardService;
  private _voteManager: VoteManager;
  private _agentRankService: AgentRankService;
  private _emailService: EmailService;
  private _tradingConstraintsService: TradingConstraintsService;
  private _competitionRewardService: CompetitionRewardService;
  private readonly _boostRepository: BoostRepository;
  private readonly _stakesRepository: StakesRepository;
  private readonly _indexingService: IndexingService;
  private readonly _eventsRepository: EventsRepository;
  private readonly _eventProcessor: EventProcessor;
  private readonly _boostAwardService: BoostAwardService;

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

    // Configuration service for dynamic settings
    this._configurationService = new ConfigurationService();

    // Initialize agent rank service (no dependencies)
    this._agentRankService = new AgentRankService();

    // Initialize vote manager (no dependencies)
    this._voteManager = new VoteManager();

    // Initialize email service (no dependencies)
    this._emailService = new EmailService();

    // Initialize user and agent managers (require email service)
    this._userManager = new UserManager(this._emailService);
    this._agentManager = new AgentManager(this._emailService);
    this._adminManager = new AdminManager();

    // Initialize trading constraints service (no dependencies)
    this._tradingConstraintsService = new TradingConstraintsService();
    // Initialize core reward service (no dependencies)
    this._competitionRewardService = new CompetitionRewardService();

    this._competitionManager = new CompetitionManager(
      this._balanceManager,
      this._tradeSimulator,
      this._portfolioSnapshotter,
      this._agentManager,
      this._configurationService,
      this._agentRankService,
      this._voteManager,
      this._tradingConstraintsService,
      this._competitionRewardService,
    );

    // Initialize LeaderboardService with required dependencies
    this._leaderboardService = new LeaderboardService(this._agentManager);

    this._stakesRepository = new StakesRepository(db);
    this._eventsRepository = new EventsRepository(db);
    this._boostRepository = new BoostRepository(db);
    this._boostAwardService = new BoostAwardService(this._boostRepository);
    this._eventProcessor = new EventProcessor(
      db,
      this._eventsRepository,
      this._stakesRepository,
      this._boostAwardService,
      this._competitionManager,
      indexingLogger,
    );
    this._indexingService = new IndexingService(
      indexingLogger,
      this._eventProcessor,
    );
  }

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

  get configurationService(): ConfigurationService {
    return this._configurationService;
  }

  get voteManager(): VoteManager {
    return this._voteManager;
  }

  get agentRankService(): AgentRankService {
    return this._agentRankService;
  }

  get emailService(): EmailService {
    return this._emailService;
  }

  get tradingConstraintsService(): TradingConstraintsService {
    return this._tradingConstraintsService;
  }

  get competitionRewardService(): CompetitionRewardService {
    return this._competitionRewardService;
  }

  get indexingService(): IndexingService {
    return this._indexingService;
  }

  get stakesRepository(): StakesRepository {
    return this._stakesRepository;
  }

  get boostAwardService(): BoostAwardService {
    return this._boostAwardService;
  }
}

export {
  AdminManager,
  AgentManager,
  AgentRankService,
  BalanceManager,
  CompetitionManager,
  CompetitionRewardService,
  ConfigurationService,
  EmailService,
  LeaderboardService,
  PortfolioSnapshotter,
  PriceTracker,
  ServiceRegistry,
  TradeSimulator,
  TradingConstraintsService,
  UserManager,
  VoteManager,
};

export default ServiceRegistry;
