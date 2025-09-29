import { AdminRepository } from "@recallnet/db/repositories/admin";
import { AgentRepository } from "@recallnet/db/repositories/agent";
import { AgentNonceRepository } from "@recallnet/db/repositories/agent-nonce";
import { AgentScoreRepository } from "@recallnet/db/repositories/agent-score";
import { BalanceRepository } from "@recallnet/db/repositories/balance";
import { BoostRepository } from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { CompetitionRewardsRepository } from "@recallnet/db/repositories/competition-rewards";
import { LeaderboardRepository } from "@recallnet/db/repositories/leaderboard";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import { StakesRepository } from "@recallnet/db/repositories/stakes";
import { TradeRepository } from "@recallnet/db/repositories/trade";
import { TradingConstraintsRepository } from "@recallnet/db/repositories/trading-constraints";
import { UserRepository } from "@recallnet/db/repositories/user";
import { VoteRepository } from "@recallnet/db/repositories/vote";
import {
  AdminService,
  AgentRankService,
  AgentService,
  BalanceService,
  BoostAwardService,
  BoostService,
  CalmarRatioService,
  CompetitionRewardService,
  CompetitionService,
  ConfigurationService,
  EmailService,
  LeaderboardService,
  PerpsDataProcessor,
  PortfolioSnapshotterService,
  PriceTrackerService,
  TradeSimulatorService,
  TradingConstraintsService,
  UserService,
  VoteService,
} from "@recallnet/services";
import { WalletWatchlist } from "@recallnet/services/lib";
import { MultiChainProvider } from "@recallnet/services/providers";

import config, { features } from "@/config/index.js";
import { db, dbRead } from "@/database/db.js";
import { EventProcessor } from "@/indexing/event-processor.js";
import { EventsRepository } from "@/indexing/events.repository.js";
import { IndexingService } from "@/indexing/indexing.service.js";
import {
  indexingLogger,
  repositoryLogger,
  serviceLogger,
} from "@/lib/logger.js";

/**
 * Service Registry
 * Manages all service instances and their dependencies
 */
class ServiceRegistry {
  private static instance: ServiceRegistry;

  // Services
  private _balanceService: BalanceService;
  private _priceTrackerService: PriceTrackerService;
  private _tradeSimulatorService: TradeSimulatorService;
  private _competitionService: CompetitionService;
  private _userService: UserService;
  private _agentService: AgentService;
  private _adminService: AdminService;
  private _configurationService: ConfigurationService;
  private _portfolioSnapshotterService: PortfolioSnapshotterService;
  private _leaderboardService: LeaderboardService;
  private _voteService: VoteService;
  private _agentRankService: AgentRankService;
  private _emailService: EmailService;
  private _tradingConstraintsService: TradingConstraintsService;
  private _competitionRewardService: CompetitionRewardService;
  private _perpsDataProcessor: PerpsDataProcessor;
  private _boostService: BoostService;
  private readonly _competitionRepository: CompetitionRepository;
  private readonly _boostRepository: BoostRepository;
  private readonly _stakesRepository: StakesRepository;
  private readonly _userRepository: UserRepository;
  private readonly _indexingService: IndexingService;
  private readonly _eventsRepository: EventsRepository;
  private readonly _eventProcessor: EventProcessor;
  private readonly _boostAwardService: BoostAwardService;

  constructor() {
    this._stakesRepository = new StakesRepository(db);
    this._eventsRepository = new EventsRepository(db);
    this._boostRepository = new BoostRepository(db);
    this._userRepository = new UserRepository(db, repositoryLogger);
    const balanceRepository = new BalanceRepository(
      db,
      repositoryLogger,
      config.specificChainTokens,
    );
    this._competitionRepository = new CompetitionRepository(
      db,
      dbRead,
      repositoryLogger,
    );
    const tradeRepository = new TradeRepository(
      db,
      repositoryLogger,
      balanceRepository,
    );
    const tradingConstraintsRepository = new TradingConstraintsRepository(db);
    const agentScoreRepository = new AgentScoreRepository(db, repositoryLogger);
    const competitionRewardsRepository = new CompetitionRewardsRepository(
      db,
      repositoryLogger,
    );
    const agentRepository = new AgentRepository(
      db,
      repositoryLogger,
      competitionRewardsRepository,
    );
    const voteRepository = new VoteRepository(db, repositoryLogger);
    const agentNonceRepository = new AgentNonceRepository(db);
    const leaderboardRepository = new LeaderboardRepository(
      dbRead,
      repositoryLogger,
    );
    const perpsRepository = new PerpsRepository(db, dbRead, repositoryLogger);
    const adminRepository = new AdminRepository(db, repositoryLogger);

    const walletWatchlist = new WalletWatchlist(
      config.watchlist.chainalysisApiKey,
      serviceLogger,
    );

    const multichainProvider = new MultiChainProvider(
      config.evmChains,
      config.specificChainTokens,
      serviceLogger,
    );

    // Initialize services in dependency order
    this._balanceService = new BalanceService(
      balanceRepository,
      config.specificChainBalances,
      config.specificChainTokens,
      serviceLogger,
    );
    this._priceTrackerService = new PriceTrackerService(
      multichainProvider,
      config.priceTracker.maxCacheSize,
      config.priceTracker.priceTTLMs,
      serviceLogger,
    );
    this._portfolioSnapshotterService = new PortfolioSnapshotterService(
      this._balanceService,
      this._priceTrackerService,
      this._competitionRepository,
      serviceLogger,
    );
    this._tradeSimulatorService = new TradeSimulatorService(
      this._balanceService,
      this._priceTrackerService,
      tradeRepository,
      tradingConstraintsRepository,
      config.maxTradePercentage,
      config.tradingConstraints.defaultMinimumPairAgeHours,
      config.tradingConstraints.defaultMinimum24hVolumeUsd,
      config.tradingConstraints.defaultMinimumLiquidityUsd,
      config.tradingConstraints.defaultMinimumFdvUsd,
      features.CROSS_CHAIN_TRADING_TYPE,
      config.specificChainTokens,
      serviceLogger,
    );

    // Configuration service for dynamic settings
    this._configurationService = new ConfigurationService(
      this._competitionRepository,
      serviceLogger,
    );

    // Initialize agent rank service (no dependencies)
    this._agentRankService = new AgentRankService(
      agentScoreRepository,
      this._competitionRepository,
      serviceLogger,
    );

    // Initialize vote service (no dependencies)
    this._voteService = new VoteService(
      agentRepository,
      this._competitionRepository,
      voteRepository,
      serviceLogger,
    );

    // Initialize email service (no dependencies)
    this._emailService = new EmailService(
      config.email.apiKey,
      config.email.mailingListId,
      config.email.baseUrl,
      serviceLogger,
    );

    // Initialize user, agent, and admin services
    this._userService = new UserService(
      this._emailService,
      agentRepository,
      this._userRepository,
      voteRepository,
      walletWatchlist,
      db,
      serviceLogger,
    );
    this._agentService = new AgentService(
      this._emailService,
      this._balanceService,
      this._priceTrackerService,
      this._userService,
      agentRepository,
      agentNonceRepository,
      this._competitionRepository,
      leaderboardRepository,
      perpsRepository,
      tradeRepository,
      this._userRepository,
      config.security.rootEncryptionKey,
      config.api.domain,
      serviceLogger,
    );
    this._adminService = new AdminService(
      adminRepository,
      this._userService,
      this._agentService,
      config.security.rootEncryptionKey,
      serviceLogger,
    );

    // Initialize trading constraints service (no dependencies)
    this._tradingConstraintsService = new TradingConstraintsService(
      tradingConstraintsRepository,
      config.tradingConstraints.defaultMinimumPairAgeHours,
      config.tradingConstraints.defaultMinimum24hVolumeUsd,
      config.tradingConstraints.defaultMinimumLiquidityUsd,
      config.tradingConstraints.defaultMinimumFdvUsd,
    );
    // Initialize core reward service (no dependencies)
    this._competitionRewardService = new CompetitionRewardService(
      competitionRewardsRepository,
    );
    const calmarRatioService = new CalmarRatioService(
      this._competitionRepository,
      perpsRepository,
      serviceLogger,
    );
    // Initialize PerpsDataProcessor before CompetitionManager (as it's a dependency)
    this._perpsDataProcessor = new PerpsDataProcessor(
      calmarRatioService,
      agentRepository,
      this._competitionRepository,
      perpsRepository,
      serviceLogger,
    );

    this._competitionService = new CompetitionService(
      this._balanceService,
      this._tradeSimulatorService,
      this._portfolioSnapshotterService,
      this._agentService,
      this._configurationService,
      this._agentRankService,
      this._voteService,
      this._tradingConstraintsService,
      this._competitionRewardService,
      this._perpsDataProcessor,
      agentRepository,
      agentScoreRepository,
      perpsRepository,
      this._competitionRepository,
      db,
      {
        evmChains: config.evmChains,
        maxTradePercentage: config.maxTradePercentage,
        rateLimitingMaxRequests: config.rateLimiting.maxRequests,
        rateLimitingWindowMs: config.rateLimiting.windowMs,
        specificChainBalances: config.specificChainBalances,
        onLoadCompetitionSettings: (activeCompetition) => {
          // TODO: fill this in.
        },
      },
      serviceLogger,
    );

    // Initialize LeaderboardService with required dependencies
    this._leaderboardService = new LeaderboardService(
      leaderboardRepository,
      serviceLogger,
    );

    // Initialize BoostService with its dependencies
    // TODO: Consider the best practice for services depending on repositories and/or other services.
    this._boostService = new BoostService(
      this._boostRepository,
      this._competitionRepository,
      this._userRepository,
      config.boost.noStakeBoostAmount,
      serviceLogger,
    );

    this._boostAwardService = new BoostAwardService(
      db,
      this._competitionRepository,
      this._boostRepository,
      this._stakesRepository,
      this._userService,
      config.boost.noStakeBoostAmount,
    );
    this._eventProcessor = new EventProcessor(
      db,
      this._eventsRepository,
      this._stakesRepository,
      this._boostAwardService,
      this._competitionService,
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
  get balanceService(): BalanceService {
    return this._balanceService;
  }

  get priceTrackerService(): PriceTrackerService {
    return this._priceTrackerService;
  }

  get tradeSimulatorService(): TradeSimulatorService {
    return this._tradeSimulatorService;
  }

  get competitionService(): CompetitionService {
    return this._competitionService;
  }

  get leaderboardService(): LeaderboardService {
    return this._leaderboardService;
  }

  get portfolioSnapshotterService(): PortfolioSnapshotterService {
    return this._portfolioSnapshotterService;
  }

  get userService(): UserService {
    return this._userService;
  }

  get agentService(): AgentService {
    return this._agentService;
  }

  get adminService(): AdminService {
    return this._adminService;
  }

  get configurationService(): ConfigurationService {
    return this._configurationService;
  }

  get voteService(): VoteService {
    return this._voteService;
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

  get perpsDataProcessor(): PerpsDataProcessor {
    return this._perpsDataProcessor;
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

  get boostService(): BoostService {
    return this._boostService;
  }

  get eventProcessor(): EventProcessor {
    return this._eventProcessor;
  }

  get eventsRepository(): EventsRepository {
    return this._eventsRepository;
  }
}

export {
  AdminService,
  AgentService,
  AgentRankService,
  BalanceService,
  CompetitionService,
  CompetitionRewardService,
  ConfigurationService,
  EmailService,
  LeaderboardService,
  PerpsDataProcessor,
  PortfolioSnapshotterService,
  PriceTrackerService,
  ServiceRegistry,
  TradeSimulatorService,
  TradingConstraintsService,
  UserService,
  VoteService,
};

export default ServiceRegistry;
