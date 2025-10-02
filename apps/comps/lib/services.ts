import {
  AgentRankService,
  AgentService,
  BalanceService,
  BoostService,
  CalmarRatioService,
  CompetitionRewardService,
  CompetitionService,
  EmailService,
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
  tradeRepository,
  tradingConstraintsRepository,
  userRepository,
  voteRepository,
} from "@/lib/repositories";

import { db } from "./db";
import { createLogger } from "./logger";

const noStakeBoostAmount = process.env.NEXT_PUBLIC_NON_STAKE_BOOST_AMOUNT
  ? BigInt(process.env.NEXT_PUBLIC_NON_STAKE_BOOST_AMOUNT)
  : undefined;

const multichainProvider = new MultiChainProvider(
  { evmChains: [], specificChainTokens: {} },
  createLogger("MultiChainProvider"),
);

export const walletWatchList = new WalletWatchlist(
  {
    watchlist: { chainalysisApiKey: "" },
  },
  createLogger("WalletWatchlist"),
);

export const boostService = new BoostService(
  boostRepository,
  competitionRepository,
  userRepository,
  { boost: { noStakeBoostAmount } },
  createLogger("BoostService"),
);

export const balanceService = new BalanceService(
  balanceRepository,
  { specificChainBalances: {}, specificChainTokens: {} },
  createLogger("BalanceService"),
);

export const priceTrackerService = new PriceTrackerService(
  multichainProvider,
  { priceTracker: { maxCacheSize: 1000, priceTTLMs: 1000 } },
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
  { email: { apiKey: "", baseUrl: "", mailingListId: "" } },
  createLogger("EmailService"),
);

export const userService = new UserService(
  emailService,
  agentRepository,
  userRepository,
  voteRepository,
  walletWatchList,
  db,
  createLogger("UserService"),
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
  { api: { domain: "" }, security: { rootEncryptionKey: "" } },
  createLogger("AgentService"),
);

export const agentRankService = new AgentRankService(
  agentScoreRepository,
  competitionRepository,
  createLogger("AgentRankService"),
);

export const voteService = new VoteService(
  agentRepository,
  competitionRepository,
  voteRepository,
  createLogger("VoteService"),
);

export const tradingConstraintsService = new TradingConstraintsService(
  tradingConstraintsRepository,
  {
    tradingConstraints: {
      defaultMinimum24hVolumeUsd: 1000,
      defaultMinimumFdvUsd: 1000000,
      defaultMinimumLiquidityUsd: 1000,
      defaultMinimumPairAgeHours: 1,
    },
  },
);

export const competitionRewardsService = new CompetitionRewardService(
  competitionRewardsRepository,
);

export const calmarRatioService = new CalmarRatioService(
  competitionRepository,
  perpsRepository,
  createLogger("CalmarRatioService"),
);

const perpsDataProcessor = new PerpsDataProcessor(
  calmarRatioService,
  agentRepository,
  competitionRepository,
  perpsRepository,
  createLogger("PerpsDataProcessor"),
);

export const competitionService = new CompetitionService(
  balanceService,
  tradeSimulatorService,
  portfolioSnapshotterService,
  agentService,
  agentRankService,
  voteService,
  tradingConstraintsService,
  competitionRewardsService,
  perpsDataProcessor,
  agentRepository,
  agentScoreRepository,
  perpsRepository,
  competitionRepository,
  db,
  {
    evmChains: [],
    maxTradePercentage: 20,
    rateLimiting: { maxRequests: 100, windowMs: 60_000 },
    specificChainBalances: {},
  },
  createLogger("CompetitionService"),
);
