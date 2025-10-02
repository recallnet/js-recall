import { AgentRepository } from "@recallnet/db/repositories/agent";
import { AgentNonceRepository } from "@recallnet/db/repositories/agent-nonce";
import { BalanceRepository } from "@recallnet/db/repositories/balance";
import { BoostRepository } from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { CompetitionRewardsRepository } from "@recallnet/db/repositories/competition-rewards";
import { LeaderboardRepository } from "@recallnet/db/repositories/leaderboard";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import { StakesRepository } from "@recallnet/db/repositories/stakes";
import { TradeRepository } from "@recallnet/db/repositories/trade";
import { UserRepository } from "@recallnet/db/repositories/user";
import { VoteRepository } from "@recallnet/db/repositories/vote";

import { config } from "./config";
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
  db, // read replica (use same db for now)
  createLogger("PerpsRepository"),
);
export const userRepository = new UserRepository(
  db,
  createLogger("UserRepository"),
);
export const voteRepository = new VoteRepository(
  db,
  createLogger("VoteRepository"),
);
export const stakesRepository = new StakesRepository(db);
export const tradeRepository = new TradeRepository(
  db,
  createLogger("TradeRepository"),
  balanceRepository,
);
