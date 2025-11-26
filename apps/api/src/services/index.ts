import { PrivyClient } from "@privy-io/server-auth";
import { Hex } from "viem";

import { AdminRepository } from "@recallnet/db/repositories/admin";
import { AgentRepository } from "@recallnet/db/repositories/agent";
import { AgentNonceRepository } from "@recallnet/db/repositories/agent-nonce";
import { AgentScoreRepository } from "@recallnet/db/repositories/agent-score";
import { ArenaRepository } from "@recallnet/db/repositories/arena";
import { BalanceRepository } from "@recallnet/db/repositories/balance";
import { BoostRepository } from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { CompetitionRewardsRepository } from "@recallnet/db/repositories/competition-rewards";
import { ConvictionClaimsRepository } from "@recallnet/db/repositories/conviction-claims";
import { EventsRepository } from "@recallnet/db/repositories/indexing-events";
import { LeaderboardRepository } from "@recallnet/db/repositories/leaderboard";
import { PaperTradingConfigRepository } from "@recallnet/db/repositories/paper-trading-config";
import { PaperTradingInitialBalancesRepository } from "@recallnet/db/repositories/paper-trading-initial-balances";
import { PartnerRepository } from "@recallnet/db/repositories/partner";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import { RewardsRepository } from "@recallnet/db/repositories/rewards";
import { StakesRepository } from "@recallnet/db/repositories/stakes";
import { TradeRepository } from "@recallnet/db/repositories/trade";
import { TradingConstraintsRepository } from "@recallnet/db/repositories/trading-constraints";
import { UserRepository } from "@recallnet/db/repositories/user";
import {
  AdminService,
  AgentRankService,
  AgentService,
  ArenaService,
  BalanceService,
  BoostAwardService,
  BoostService,
  CalmarRatioService,
  CompetitionRewardService,
  CompetitionService,
  EmailService,
  LeaderboardService,
  PartnerService,
  PerpsDataProcessor,
  PortfolioSnapshotterService,
  PriceTrackerService,
  RewardsService,
  RiskMetricsService,
  SimulatedTradeExecutionService,
  SortinoRatioService,
  SportsIngesterService,
  SportsService,
  TradeSimulatorService,
  TradingConstraintsService,
  UserService,
} from "@recallnet/services";
import {
  EventProcessor,
  IndexingService,
  TransactionProcessor,
} from "@recallnet/services/indexing";
import { MockPrivyClient } from "@recallnet/services/lib";
import { WalletWatchlist } from "@recallnet/services/lib";
import {
  DexScreenerProvider,
  MultiChainProvider,
} from "@recallnet/services/providers";
import {
  ExternallyOwnedAccountAllocator,
  Network,
  NoopRewardsAllocator,
  RewardsAllocator,
  SafeTransactionProposer,
} from "@recallnet/staking-contracts";

import config from "@/config/index.js";
import { db, dbRead } from "@/database/db.js";
import {
  configLogger,
  createLogger,
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
  private _simulatedTradeExecutionService: SimulatedTradeExecutionService;
  private _competitionService: CompetitionService;
  private _userService: UserService;
  private _agentService: AgentService;
  private _adminService: AdminService;
  private _arenaService: ArenaService;
  private _partnerService: PartnerService;
  private _portfolioSnapshotterService: PortfolioSnapshotterService;
  private _leaderboardService: LeaderboardService;
  private _agentRankService: AgentRankService;
  private _emailService: EmailService;
  private _tradingConstraintsService: TradingConstraintsService;
  private _competitionRewardService: CompetitionRewardService;
  private _perpsDataProcessor: PerpsDataProcessor;
  private _boostService: BoostService;
  private readonly _competitionRepository: CompetitionRepository;
  private readonly _agentRepository: AgentRepository;
  private readonly _perpsRepository: PerpsRepository;
  private readonly _boostRepository: BoostRepository;
  private readonly _stakesRepository: StakesRepository;
  private readonly _userRepository: UserRepository;
  private readonly _arenaRepository: ArenaRepository;
  private readonly _partnerRepository: PartnerRepository;
  private readonly _paperTradingConfigRepository: PaperTradingConfigRepository;
  private readonly _paperTradingInitialBalancesRepository: PaperTradingInitialBalancesRepository;
  private readonly _eventsRepository: EventsRepository;
  private readonly _convictionClaimsRepository: ConvictionClaimsRepository;
  private readonly _boostAwardService: BoostAwardService;
  private readonly _privyClient: PrivyClient;
  private _rewardsService: RewardsService;
  private readonly _rewardsRepository: RewardsRepository;
  private readonly _rewardsAllocator: RewardsAllocator;
  private readonly _sportsService: SportsService;
  private readonly _sportsIngesterService: SportsIngesterService;
  private _eventIndexingService?: IndexingService;
  private _transactionIndexingService?: IndexingService;
  private _eventProcessor?: EventProcessor;
  private _transactionProcessor?: TransactionProcessor;

  constructor() {
    // Initialize Privy client (use MockPrivyClient in test mode to avoid real API calls)
    if (config.server.nodeEnv === "test") {
      this._privyClient = new MockPrivyClient(
        config.privy.appId,
        config.privy.appSecret,
      ) as unknown as PrivyClient;
    } else {
      this._privyClient = new PrivyClient(
        config.privy.appId,
        config.privy.appSecret,
      );
    }
    this._stakesRepository = new StakesRepository(db);
    this._eventsRepository = new EventsRepository(db);
    this._boostRepository = new BoostRepository(db);
    this._userRepository = new UserRepository(db, repositoryLogger);
    this._rewardsRepository = new RewardsRepository(db, repositoryLogger);

    // Initialize RewardsAllocator (use MockRewardsAllocator in test mode to avoid blockchain interactions)
    this._rewardsAllocator = this.getRewardsAllocator();

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
    const competitionRewardsRepository = new CompetitionRewardsRepository(
      db,
      repositoryLogger,
    );
    this._agentRepository = new AgentRepository(
      db,
      repositoryLogger,
      competitionRewardsRepository,
    );
    const tradeRepository = new TradeRepository(
      db,
      repositoryLogger,
      balanceRepository,
    );
    const tradingConstraintsRepository = new TradingConstraintsRepository(db);
    this._paperTradingConfigRepository = new PaperTradingConfigRepository(db);
    this._paperTradingInitialBalancesRepository =
      new PaperTradingInitialBalancesRepository(db);
    const agentScoreRepository = new AgentScoreRepository(db, repositoryLogger);
    const agentNonceRepository = new AgentNonceRepository(db);
    const leaderboardRepository = new LeaderboardRepository(
      dbRead,
      repositoryLogger,
    );
    this._perpsRepository = new PerpsRepository(db, dbRead, repositoryLogger);
    const adminRepository = new AdminRepository(db, repositoryLogger);
    this._arenaRepository = new ArenaRepository(db, dbRead, repositoryLogger);
    this._partnerRepository = new PartnerRepository(
      db,
      dbRead,
      repositoryLogger,
    );

    // Initialize Sports Service (encapsulates all NFL sports prediction functionality)
    this._sportsService = new SportsService(
      db,
      this._competitionRepository,
      serviceLogger,
    );
    this._sportsIngesterService = new SportsIngesterService(
      this._sportsService,
      serviceLogger,
      config,
    );

    const walletWatchlist = new WalletWatchlist(config, serviceLogger);

    const multichainProvider = new MultiChainProvider(config, serviceLogger);

    const dexScreenerProvider = new DexScreenerProvider(
      config.specificChainTokens,
      serviceLogger,
    );

    // Initialize services in dependency order
    this._balanceService = new BalanceService(
      balanceRepository,
      this._paperTradingInitialBalancesRepository,
      serviceLogger,
    );
    this._priceTrackerService = new PriceTrackerService(
      multichainProvider,
      config,
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
      serviceLogger,
    );

    // Initialize agent rank service (no dependencies)
    this._agentRankService = new AgentRankService(
      agentScoreRepository,
      this._competitionRepository,
      serviceLogger,
    );

    // Initialize email service (no dependencies)
    this._emailService = new EmailService(config, serviceLogger);

    // Initialize user, agent, and admin services
    this._userService = new UserService(
      this._emailService,
      this._agentRepository,
      this._userRepository,
      this._boostRepository,
      walletWatchlist,
      db,
      serviceLogger,
    );
    this._agentService = new AgentService(
      this._emailService,
      this._balanceService,
      this._priceTrackerService,
      this._userService,
      this._agentRepository,
      agentNonceRepository,
      this._competitionRepository,
      leaderboardRepository,
      this._perpsRepository,
      tradeRepository,
      this._userRepository,
      config,
      serviceLogger,
    );
    this._adminService = new AdminService(
      adminRepository,
      this._userService,
      this._agentService,
      config,
      serviceLogger,
    );

    // Initialize trading constraints service (no dependencies)
    this._tradingConstraintsService = new TradingConstraintsService(
      tradingConstraintsRepository,
      config,
    );
    // Initialize core reward service (no dependencies)
    this._competitionRewardService = new CompetitionRewardService(
      competitionRewardsRepository,
    );
    const calmarRatioService = new CalmarRatioService(
      this._competitionRepository,
      serviceLogger,
    );
    const sortinoRatioService = new SortinoRatioService(
      this._competitionRepository,
      serviceLogger,
    );
    const riskMetricsService = new RiskMetricsService(
      calmarRatioService,
      sortinoRatioService,
      this._perpsRepository,
      this._competitionRepository,
      db,
      serviceLogger,
    );
    // Initialize PerpsDataProcessor before CompetitionManager (as it's a dependency)
    this._perpsDataProcessor = new PerpsDataProcessor(
      riskMetricsService,
      this._agentRepository,
      this._competitionRepository,
      this._perpsRepository,
      serviceLogger,
    );

    // Initialize LeaderboardService with required dependencies
    this._leaderboardService = new LeaderboardService(
      leaderboardRepository,
      this._arenaRepository,
      serviceLogger,
    );

    // Initialize ArenaService and PartnerService
    this._arenaService = new ArenaService(
      this._arenaRepository,
      this._competitionRepository,
      serviceLogger,
    );
    this._partnerService = new PartnerService(
      this._partnerRepository,
      serviceLogger,
    );

    // Initialize BoostAwardService first (needed by BoostService)
    this._boostAwardService = new BoostAwardService(
      db,
      this._competitionRepository,
      this._boostRepository,
      this._stakesRepository,
      this._userService,
      config,
    );

    // Initialize BoostService with its dependencies
    // TODO: Consider the best practice for services depending on repositories and/or other services.
    this._boostService = new BoostService(
      this._boostRepository,
      this._competitionRepository,
      this._userRepository,
      this._boostAwardService,
      db,
      config,
      serviceLogger,
    );

    // Initialize RewardsService with its dependencies
    this._rewardsService = new RewardsService(
      this._rewardsRepository,
      this._competitionRepository,
      this._boostRepository,
      this._agentRepository,
      this._rewardsAllocator,
      db,
      serviceLogger,
    );

    this._competitionService = new CompetitionService(
      this._balanceService,
      this._tradeSimulatorService,
      this._portfolioSnapshotterService,
      this._agentService,
      this._agentRankService,
      this._tradingConstraintsService,
      this._competitionRewardService,
      this._rewardsService,
      this._perpsDataProcessor,
      this._agentRepository,
      agentScoreRepository,
      this._arenaRepository,
      this._sportsService,
      this._perpsRepository,
      this._competitionRepository,
      this._paperTradingConfigRepository,
      this._paperTradingInitialBalancesRepository,
      this._stakesRepository,
      this._userRepository,
      db,
      config,
      serviceLogger,
    );

    // Initialize simulated trade execution service with its dependencies
    this._simulatedTradeExecutionService = new SimulatedTradeExecutionService(
      this._competitionService,
      this._tradeSimulatorService,
      this._balanceService,
      this._priceTrackerService,
      tradeRepository,
      this._tradingConstraintsService,
      dexScreenerProvider,
      this._paperTradingConfigRepository,
      config,
      serviceLogger,
    );

    this._convictionClaimsRepository = new ConvictionClaimsRepository(
      db,
      createLogger("ConvictionClaimsRepository"),
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

  get simulatedTradeExecutionService(): SimulatedTradeExecutionService {
    return this._simulatedTradeExecutionService;
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

  get eventIndexingService(): IndexingService {
    if (!this._eventIndexingService) {
      this._eventIndexingService = IndexingService.createEventsIndexingService(
        indexingLogger,
        this.eventProcessor,
        config.stakingIndex.getConfig(),
      );
    }
    return this._eventIndexingService;
  }

  get transactionIndexingService(): IndexingService | undefined {
    if (!this._transactionIndexingService) {
      this._transactionIndexingService =
        IndexingService.createTransactionsIndexingService(
          indexingLogger,
          this.transactionProcessor,
          config.stakingIndex.getConfig(),
        );
    }
    return this._transactionIndexingService;
  }

  get convictionClaimsRepository(): ConvictionClaimsRepository {
    return this._convictionClaimsRepository;
  }

  get transactionProcessor(): TransactionProcessor {
    if (!this._transactionProcessor) {
      this._transactionProcessor = new TransactionProcessor(
        this._convictionClaimsRepository,
        indexingLogger,
      );
    }
    return this._transactionProcessor;
  }

  get competitionRepository(): CompetitionRepository {
    return this._competitionRepository;
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

  get privyClient(): PrivyClient {
    return this._privyClient;
  }

  get eventProcessor(): EventProcessor {
    if (!this._eventProcessor) {
      this._eventProcessor = new EventProcessor(
        db,
        this._rewardsRepository,
        this._eventsRepository,
        this._stakesRepository,
        this._boostAwardService,
        this._competitionService,
        indexingLogger,
      );
    }
    return this._eventProcessor;
  }

  get rewardsService(): RewardsService {
    return this._rewardsService;
  }

  get eventsRepository(): EventsRepository {
    return this._eventsRepository;
  }

  get agentRepository(): AgentRepository {
    return this._agentRepository;
  }

  get perpsRepository(): PerpsRepository {
    return this._perpsRepository;
  }

  get arenaRepository(): ArenaRepository {
    return this._arenaRepository;
  }

  get partnerRepository(): PartnerRepository {
    return this._partnerRepository;
  }

  get arenaService(): ArenaService {
    return this._arenaService;
  }

  get partnerService(): PartnerService {
    return this._partnerService;
  }

  get sportsService(): SportsService {
    return this._sportsService;
  }

  get sportsIngesterService(): SportsIngesterService {
    return this._sportsIngesterService;
  }

  get paperTradingConfigRepository(): PaperTradingConfigRepository {
    return this._paperTradingConfigRepository;
  }

  get paperTradingInitialBalancesRepository(): PaperTradingInitialBalancesRepository {
    return this._paperTradingInitialBalancesRepository;
  }

  private getRewardsAllocator(): RewardsAllocator {
    if (config.server.nodeEnv === "test") {
      return new NoopRewardsAllocator();
    }

    if (config.rewards.eoaEnabled) {
      if (
        !config.rewards.eoaPrivateKey ||
        !config.rewards.contractAddress ||
        !config.rewards.rpcProvider
      ) {
        configLogger.warn("Rewards EOA config is not set");
        return new NoopRewardsAllocator();
      }

      return new ExternallyOwnedAccountAllocator(
        config.rewards.eoaPrivateKey as Hex,
        config.rewards.rpcProvider,
        config.rewards.contractAddress as Hex,
        config.rewards.tokenContractAddress as Hex,
        config.rewards.network as Network,
      );
    }

    if (config.rewards.safeProposerEnabled) {
      if (
        !config.rewards.safeAddress ||
        !config.rewards.safeProposerPrivateKey ||
        !config.rewards.safeApiKey ||
        !config.rewards.contractAddress ||
        !config.rewards.rpcProvider
      ) {
        configLogger.warn("Rewards safe proposer config is not set");
        return new NoopRewardsAllocator();
      }

      return new SafeTransactionProposer({
        safeAddress: config.rewards.safeAddress as Hex,
        proposerPrivateKey: config.rewards.safeProposerPrivateKey as Hex,
        apiKey: config.rewards.safeApiKey,
        contractAddress: config.rewards.contractAddress as Hex,
        rpcUrl: config.rewards.rpcProvider,
        network: config.rewards.network as Network,
        tokenAddress: config.rewards.tokenContractAddress as Hex,
      });
    }

    return new NoopRewardsAllocator();
  }
}

export {
  AdminService,
  AgentService,
  AgentRankService,
  BalanceService,
  CompetitionService,
  CompetitionRewardService,
  EmailService,
  LeaderboardService,
  PerpsDataProcessor,
  PortfolioSnapshotterService,
  PriceTrackerService,
  ServiceRegistry,
  SportsService,
  SimulatedTradeExecutionService,
  TradeSimulatorService,
  TradingConstraintsService,
  UserService,
};

export default ServiceRegistry;
