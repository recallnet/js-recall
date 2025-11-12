import { AgentRepository } from "@recallnet/db/repositories/agent";
import { AgentNonceRepository } from "@recallnet/db/repositories/agent-nonce";
import { AgentScoreRepository } from "@recallnet/db/repositories/agent-score";
import { AirdropRepository } from "@recallnet/db/repositories/airdrop";
import { BalanceRepository } from "@recallnet/db/repositories/balance";
import { BoostRepository } from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { CompetitionRewardsRepository } from "@recallnet/db/repositories/competition-rewards";
import { LeaderboardRepository } from "@recallnet/db/repositories/leaderboard";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import { RewardsRepository } from "@recallnet/db/repositories/rewards";
import { StakesRepository } from "@recallnet/db/repositories/stakes";
import { TradeRepository } from "@recallnet/db/repositories/trade";
import { TradingConstraintsRepository } from "@recallnet/db/repositories/trading-constraints";
import { UserRepository } from "@recallnet/db/repositories/user";

import { config } from "@/config/private";

import { db } from "./db";
import { createLogger } from "./logger";

export const competitionRewardsRepository = new CompetitionRewardsRepository(
  db,
  createLogger("CompetitionRewardsRepository"),
);

export const airdropRepository = new AirdropRepository(
  db,
  createLogger("AirdropRepository"),
);

export const agentRepository = new AgentRepository(
  db,
  createLogger("AgentRepository"),
  competitionRewardsRepository,
);

export const agentNonceRepository = new AgentNonceRepository(db);

export const agentScoreRepository = new AgentScoreRepository(
  db,
  createLogger("AgentScoreRepository"),
);

export const balanceRepository = new BalanceRepository(
  db,
  createLogger("BalanceRepository"),
  config.specificChainTokens,
);

export const boostRepository = new BoostRepository(db);

export const competitionRepository = new CompetitionRepository(
  db,
  db,
  createLogger("CompetitionRepository"),
);

export const leaderboardRepository = new LeaderboardRepository(
  db,
  createLogger("LeaderboardRepository"),
);

export const perpsRepository = new PerpsRepository(
  db,
  db,
  createLogger("PerpsRepository"),
);

export const stakesRepository = new StakesRepository(db);

export const tradingConstraintsRepository = new TradingConstraintsRepository(
  db,
);

export const tradeRepository = new TradeRepository(
  db,
  createLogger("TradeRepository"),
  balanceRepository,
);

export const userRepository = new UserRepository(
  db,
  createLogger("UserRepository"),
);

export const rewardsRepository = new RewardsRepository(
  db,
  createLogger("RewardsRepository"),
);
