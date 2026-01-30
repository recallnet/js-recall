import { Hex } from "viem";

import { ConvictionClaimsRepository } from "@recallnet/db/repositories/conviction-claims";
import { EventsRepository } from "@recallnet/db/repositories/indexing-events";
import {
  AdminService,
  AgentRankService,
  AgentService,
  AirdropService,
  ArenaService,
  BalanceService,
  BoostAwardService,
  BoostBonusService,
  BoostService,
  CalmarRatioService,
  CompetitionRewardService,
  CompetitionService,
  EigenaiService,
  EmailService,
  LeaderboardService,
  PartnerService,
  PerpsDataProcessor,
  PortfolioSnapshotterService,
  PriceTrackerService,
  RewardsService,
  RiskMetricsService,
  SortinoRatioService,
  SportsIngesterService,
  SportsService,
  SpotDataProcessor,
  TradeSimulatorService,
  TradingConstraintsService,
  UserService,
} from "@recallnet/services";
import {
  EventProcessor,
  IndexingService,
  TransactionProcessor,
} from "@recallnet/services/indexing";
import { WalletWatchlist } from "@recallnet/services/lib";
import { MultiChainProvider } from "@recallnet/services/providers";
import {
  ExternallyOwnedAccountAllocator,
  Network,
  NoopRewardsAllocator,
  RewardsAllocator,
  SafeTransactionProposer,
} from "@recallnet/staking-contracts";

import { config } from "@/config/private";
import {
  adminRepository,
  agentNonceRepository,
  agentRepository,
  agentScoreRepository,
  airdropRepository,
  arenaRepository,
  balanceRepository,
  boostRepository,
  competitionRepository,
  competitionRewardsRepository,
  convictionClaimsRepository,
  eigenaiRepository,
  leaderboardRepository,
  paperTradingConfigRepository,
  paperTradingInitialBalancesRepository,
  partnerRepository,
  perpsRepository,
  rewardsRepository,
  spotLiveRepository,
  stakesRepository,
  tradeRepository,
  tradingConstraintsRepository,
  userRepository,
} from "@/lib/repositories";

import { db } from "./db";
import { createLogger } from "./logger";

const multichainProvider = new MultiChainProvider(
  config,
  createLogger("MultiChainProvider"),
);

export const walletWatchList = new WalletWatchlist(
  config,
  createLogger("WalletWatchlist"),
);

export const airdropService = new AirdropService(
  airdropRepository,
  createLogger("AirdropService"),
  convictionClaimsRepository,
  boostRepository,
  competitionRepository,
  config.airdrop.minCompetitionsForEligibility,
);

export const balanceService = new BalanceService(
  balanceRepository,
  paperTradingInitialBalancesRepository,
  createLogger("BalanceService"),
);

export const priceTrackerService = new PriceTrackerService(
  multichainProvider,
  config,
  createLogger("PriceTrackerService"),
);

export const tradeSimulatorService = new TradeSimulatorService(
  balanceService,
  priceTrackerService,
  tradeRepository,
  createLogger("TradeSimulatorService"),
);

export const portfolioSnapshotterService = new PortfolioSnapshotterService(
  balanceService,
  priceTrackerService,
  competitionRepository,
  createLogger("PortfolioSnapshotterService"),
);

export const emailService = new EmailService(
  config,
  createLogger("EmailService"),
);

export const userService = new UserService(
  emailService,
  agentRepository,
  userRepository,
  boostRepository,
  walletWatchList,
  db,
  createLogger("UserService"),
);

export const boostAwardService = new BoostAwardService(
  db,
  competitionRepository,
  boostRepository,
  stakesRepository,
  userService,
);

export const boostService = new BoostService(
  boostRepository,
  competitionRepository,
  userRepository,
  boostAwardService,
  db,
  createLogger("BoostService"),
);

export const agentService = new AgentService(
  emailService,
  balanceService,
  priceTrackerService,
  userService,
  agentRepository,
  agentNonceRepository,
  competitionRepository,
  leaderboardRepository,
  perpsRepository,
  tradeRepository,
  userRepository,
  config,
  createLogger("AgentService"),
);

export const agentRankService = new AgentRankService(
  agentScoreRepository,
  competitionRepository,
  createLogger("AgentRankService"),
);

export const tradingConstraintsService = new TradingConstraintsService(
  tradingConstraintsRepository,
  config,
);

export const competitionRewardsService = new CompetitionRewardService(
  competitionRewardsRepository,
);

export const calmarRatioService = new CalmarRatioService(
  competitionRepository,
  createLogger("CalmarRatioService"),
);

export const sortinoRatioService = new SortinoRatioService(
  competitionRepository,
  createLogger("SortinoRatioService"),
);

const riskMetricsService = new RiskMetricsService(
  calmarRatioService,
  sortinoRatioService,
  perpsRepository,
  competitionRepository,
  db,
  createLogger("RiskMetricsService"),
);

export const perpsDataProcessor = new PerpsDataProcessor(
  riskMetricsService,
  agentRepository,
  competitionRepository,
  perpsRepository,
  createLogger("PerpsDataProcessor"),
);

export const spotDataProcessor = new SpotDataProcessor(
  agentRepository,
  competitionRepository,
  spotLiveRepository,
  tradeRepository,
  balanceRepository,
  portfolioSnapshotterService,
  priceTrackerService,
  createLogger("SpotDataProcessor"),
);

export const arenaService = new ArenaService(
  arenaRepository,
  competitionRepository,
  createLogger("ArenaService"),
);

export const partnerService = new PartnerService(
  partnerRepository,
  createLogger("PartnerService"),
);

export const adminService = new AdminService(
  adminRepository,
  userService,
  agentService,
  config,
  createLogger("AdminService"),
);

export const leaderboardService = new LeaderboardService(
  leaderboardRepository,
  arenaRepository,
  createLogger("LeaderboardService"),
);

export const rewardsService = new RewardsService(
  rewardsRepository,
  competitionRepository,
  boostRepository,
  agentRepository,
  getRewardsAllocator(),
  db,
  createLogger("RewardsService"),
);

export const sportsService = new SportsService(
  db,
  competitionRepository,
  createLogger("SportsService"),
);

export const sportsIngesterService = new SportsIngesterService(
  sportsService,
  createLogger("SportsIngesterService"),
  { sportsDataApi: config.sportsDataApi },
);

export const boostBonusService = new BoostBonusService(
  db,
  boostRepository,
  competitionRepository,
  userRepository,
  createLogger("BoostBonusService"),
);

export const eigenaiService = new EigenaiService(
  eigenaiRepository,
  { eigenai: {} },
  createLogger("EigenaiService"),
);

export const competitionService = new CompetitionService(
  balanceService,
  tradeSimulatorService,
  portfolioSnapshotterService,
  priceTrackerService,
  agentService,
  agentRankService,
  tradingConstraintsService,
  competitionRewardsService,
  rewardsService,
  perpsDataProcessor,
  spotDataProcessor,
  boostBonusService,
  eigenaiService,
  agentRepository,
  agentScoreRepository,
  arenaRepository,
  sportsService,
  perpsRepository,
  spotLiveRepository,
  competitionRepository,
  paperTradingConfigRepository,
  paperTradingInitialBalancesRepository,
  stakesRepository,
  tradeRepository,
  userRepository,
  db,
  config,
  createLogger("CompetitionService"),
);

function getRewardsAllocator(): RewardsAllocator {
  if (config.server.nodeEnv === "test") {
    return new NoopRewardsAllocator();
  }

  const logger = createLogger("RewardAllocatorProvider");

  if (config.rewards.eoaEnabled) {
    if (
      !config.rewards.eoaPrivateKey ||
      !config.rewards.contractAddress ||
      !config.rewards.rpcProvider
    ) {
      logger.warn("Rewards EOA config is not set");
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
      logger.warn("Rewards safe proposer config is not set");
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

let eventsIndexingService: IndexingService | null = null;
let transactionsIndexingService: IndexingService | null = null;

export function getEventsIndexingService(): IndexingService {
  if (!eventsIndexingService) {
    const stakingConfig = config.getStakingIndexConfig();
    const logger = createLogger("EventsIndexingService");
    const eventProcessor = new EventProcessor(
      db,
      rewardsRepository,
      new EventsRepository(db),
      stakesRepository,
      boostAwardService,
      competitionService,
      logger,
    );
    eventsIndexingService = IndexingService.createEventsIndexingService(
      logger,
      eventProcessor,
      stakingConfig,
    );
  }
  return eventsIndexingService;
}

export function getTransactionsIndexingService(): IndexingService {
  if (!transactionsIndexingService) {
    const stakingConfig = config.getStakingIndexConfig();
    const logger = createLogger("TransactionsIndexingService");
    const transactionProcessor = new TransactionProcessor(
      new ConvictionClaimsRepository(db, logger),
      logger,
    );
    transactionsIndexingService =
      IndexingService.createTransactionsIndexingService(
        logger,
        transactionProcessor,
        stakingConfig,
      );
  }
  return transactionsIndexingService;
}
