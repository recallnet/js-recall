import {
  AgentService,
  BalanceService,
  BoostAwardService,
  BoostService,
  EmailService,
  PriceTrackerService,
  UserService,
} from "@recallnet/services";
import { WalletWatchlist } from "@recallnet/services/lib";
import { MultiChainProvider } from "@recallnet/services/providers";

import {
  agentNonceRepository,
  agentRepository,
  balanceRepository,
  boostRepository,
  competitionRepository,
  leaderboardRepository,
  perpsRepository,
  stakesRepository,
  tradeRepository,
  userRepository,
  voteRepository,
} from "@/lib/repositories";

import { config } from "./config";
import { db } from "./db";
import { createLogger } from "./logger";

const noStakeBoostAmount = process.env.NEXT_PUBLIC_NON_STAKE_BOOST_AMOUNT
  ? BigInt(process.env.NEXT_PUBLIC_NON_STAKE_BOOST_AMOUNT)
  : undefined;

// Email service configuration
const emailConfig = {
  email: {
    apiKey: process.env.LOOPS_API_KEY || "",
    mailingListId: process.env.LOOPS_MAILING_LIST_ID || "",
    baseUrl: process.env.LOOPS_BASE_URL || "https://app.loops.so/api/v1",
  },
};

// Wallet watchlist configuration
const walletWatchlistConfig = {
  watchlist: {
    chainalysisApiKey: process.env.CHAINALYSIS_API_KEY || "",
  },
};

export const emailService = new EmailService(
  emailConfig,
  createLogger("EmailService"),
);
export const walletWatchlist = new WalletWatchlist(
  walletWatchlistConfig,
  createLogger("WalletWatchlist"),
);
export const userService = new UserService(
  emailService,
  agentRepository,
  userRepository,
  voteRepository,
  walletWatchlist,
  db,
  createLogger("UserService"),
);
export const boostService = new BoostService(
  boostRepository,
  competitionRepository,
  userRepository,
  { boost: { noStakeBoostAmount } },
  createLogger("BoostService"),
);
export const boostAwardService = new BoostAwardService(
  db,
  competitionRepository,
  boostRepository,
  stakesRepository,
  userService,
  { boost: { noStakeBoostAmount } },
);

const multiChainProvider = new MultiChainProvider(
  {
    evmChains: config.evmChains,
    specificChainTokens: config.specificChainTokens,
  },
  createLogger("MultiChainProvider"),
);

export const priceTrackerService = new PriceTrackerService(
  multiChainProvider,
  config,
  createLogger("PriceTrackerService"),
);

export const balanceService = new BalanceService(
  balanceRepository,
  {
    specificChainBalances: config.specificChainBalances,
    specificChainTokens: config.specificChainTokens,
  },
  createLogger("BalanceService"),
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
