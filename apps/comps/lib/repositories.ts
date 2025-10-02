import { AgentRepository } from "@recallnet/db/repositories/agent";
import { AgentNonceRepository } from "@recallnet/db/repositories/agent-nonce";
import { AgentScoreRepository } from "@recallnet/db/repositories/agent-score";
import { BalanceRepository } from "@recallnet/db/repositories/balance";
import { BoostRepository } from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { CompetitionRewardsRepository } from "@recallnet/db/repositories/competition-rewards";
import { LeaderboardRepository } from "@recallnet/db/repositories/leaderboard";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import { TradeRepository } from "@recallnet/db/repositories/trade";
import { TradingConstraintsRepository } from "@recallnet/db/repositories/trading-constraints";
import { UserRepository } from "@recallnet/db/repositories/user";
import { VoteRepository } from "@recallnet/db/repositories/vote";

import { db } from "./db";
import { createLogger } from "./logger";

export const competitionRewardsRepository = new CompetitionRewardsRepository(
  db,
  createLogger("CompetitionRewardsRepository"),
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
  {},
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
export const voteRepository = new VoteRepository(
  db,
  createLogger("VoteRepository"),
);
