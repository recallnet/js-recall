import { BoostRepository } from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { StakesRepository } from "@recallnet/db/repositories/stakes";
import { UserRepository } from "@recallnet/db/repositories/user";
import { BoostService } from "@recallnet/services/boost";

import config from "@/config/index.js";
import { db, dbRead } from "@/database/db.js";
import { EventProcessor } from "@/indexing/event-processor.js";
import { EventsRepository } from "@/indexing/events.repository.js";
import { IndexingService } from "@/indexing/indexing.service.js";
import {
  indexingLogger,
  repositoryLogger,
  serviceLogger,
} from "@/lib/logger.js";
import { AdminService } from "@/services/admin.service.js";
import { AgentService } from "@/services/agent.service.js";
import { AgentRankService } from "@/services/agentrank.service.js";
import { BalanceService } from "@/services/balance.service.js";
import { BoostAwardService } from "@/services/boost-award.service.js";
import { CompetitionRewardService } from "@/services/competition-reward.service.js";
import { CompetitionService } from "@/services/competition.service.js";
import { ConfigurationService } from "@/services/configuration.service.js";
import { EmailService } from "@/services/email.service.js";
import { LeaderboardService } from "@/services/leaderboard.service.js";
import { PerpsDataProcessor } from "@/services/perps-data-processor.service.js";
import { PortfolioSnapshotterService } from "@/services/portfolio-snapshotter.service.js";
import { PriceTrackerService } from "@/services/price-tracker.service.js";
import { TradeSimulatorService } from "@/services/trade-simulator.service.js";
import { TradingConstraintsService } from "@/services/trading-constraints.service.js";
import { UserService } from "@/services/user.service.js";
import { VoteService } from "@/services/vote.service.js";

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
    // Initialize services in dependency order
    this._balanceService = new BalanceService();
    this._priceTrackerService = new PriceTrackerService();
    this._portfolioSnapshotterService = new PortfolioSnapshotterService(
      this._balanceService,
      this._priceTrackerService,
    );
    this._tradeSimulatorService = new TradeSimulatorService(
      this._balanceService,
      this._priceTrackerService,
      this._portfolioSnapshotterService,
    );

    // Configuration service for dynamic settings
    this._configurationService = new ConfigurationService();

    // Initialize agent rank service (no dependencies)
    this._agentRankService = new AgentRankService();

    // Initialize vote service (no dependencies)
    this._voteService = new VoteService();

    // Initialize email service (no dependencies)
    this._emailService = new EmailService();

    // Initialize user, agent, and admin services
    this._userService = new UserService(this._emailService);
    this._agentService = new AgentService(
      this._emailService,
      this._balanceService,
      this._priceTrackerService,
      this._userService,
    );
    this._adminService = new AdminService(
      this._userService,
      this._agentService,
    );

    // Initialize trading constraints service (no dependencies)
    this._tradingConstraintsService = new TradingConstraintsService();
    // Initialize core reward service (no dependencies)
    this._competitionRewardService = new CompetitionRewardService();
    // Initialize PerpsDataProcessor before CompetitionManager (as it's a dependency)
    this._perpsDataProcessor = new PerpsDataProcessor();

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
    );

    // Initialize LeaderboardService with required dependencies
    this._leaderboardService = new LeaderboardService(this._agentService);

    this._stakesRepository = new StakesRepository(db);
    this._eventsRepository = new EventsRepository(db);
    this._boostRepository = new BoostRepository(db);
    this._competitionRepository = new CompetitionRepository(
      db,
      dbRead,
      repositoryLogger,
    );
    this._userRepository = new UserRepository(db, repositoryLogger);

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
