import {
  AgentRankService,
  AgentService,
  BalanceService,
  BoostAwardService,
  BoostService,
  CalmarRatioService,
  CompetitionRewardService,
  CompetitionService,
  EmailService,
  LeaderboardService,
  PerpsDataProcessor,
  PortfolioSnapshotterService,
  PriceTrackerService,
  RewardsService,
  RiskMetricsService,
  SortinoRatioService,
  TradeSimulatorService,
  TradingConstraintsService,
  UserService,
} from "@recallnet/services";
import { WalletWatchlist } from "@recallnet/services/lib";
import { MultiChainProvider } from "@recallnet/services/providers";

import { config } from "@/config/private";
import {
  agentNonceRepository,
  agentRepository,
  agentScoreRepository,
  balanceRepository,
  boostRepository,
  competitionRepository,
  competitionRewardsRepository,
  leaderboardRepository,
  perpsRepository,
  rewardsRepository,
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

export const balanceService = new BalanceService(
  balanceRepository,
  config,
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
  config,
);

export const boostService = new BoostService(
  boostRepository,
  competitionRepository,
  userRepository,
  boostAwardService,
  db,
  config,
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

const perpsDataProcessor = new PerpsDataProcessor(
  riskMetricsService,
  agentRepository,
  competitionRepository,
  perpsRepository,
  createLogger("PerpsDataProcessor"),
);

export const leaderboardService = new LeaderboardService(
  leaderboardRepository,
  createLogger("LeaderboardService"),
);

export const competitionService = new CompetitionService(
  balanceService,
  tradeSimulatorService,
  portfolioSnapshotterService,
  agentService,
  agentRankService,
  tradingConstraintsService,
  competitionRewardsService,
  perpsDataProcessor,
  agentRepository,
  agentScoreRepository,
  perpsRepository,
  competitionRepository,
  stakesRepository,
  userRepository,
  db,
  config,
  createLogger("CompetitionService"),
);

export const rewardsService = new RewardsService(
  rewardsRepository,
  competitionRepository,
  boostRepository,
  null,
  db,
  createLogger("RewardsService"),
);
