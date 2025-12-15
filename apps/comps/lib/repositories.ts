import { AdminRepository } from "@recallnet/db/repositories/admin";
import { AgentRepository } from "@recallnet/db/repositories/agent";
import { AgentNonceRepository } from "@recallnet/db/repositories/agent-nonce";
import { AgentScoreRepository } from "@recallnet/db/repositories/agent-score";
import { AirdropRepository } from "@recallnet/db/repositories/airdrop";
import { ArenaRepository } from "@recallnet/db/repositories/arena";
import { BalanceRepository } from "@recallnet/db/repositories/balance";
import { BoostRepository } from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { CompetitionGamesRepository } from "@recallnet/db/repositories/competition-games";
import { CompetitionRewardsRepository } from "@recallnet/db/repositories/competition-rewards";
import { ConvictionClaimsRepository } from "@recallnet/db/repositories/conviction-claims";
import { EigenaiRepository } from "@recallnet/db/repositories/eigenai";
import { GamesRepository } from "@recallnet/db/repositories/games";
import { LeaderboardRepository } from "@recallnet/db/repositories/leaderboard";
import { PaperTradingConfigRepository } from "@recallnet/db/repositories/paper-trading-config";
import { PaperTradingInitialBalancesRepository } from "@recallnet/db/repositories/paper-trading-initial-balances";
import { PartnerRepository } from "@recallnet/db/repositories/partner";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import { RewardsRepository } from "@recallnet/db/repositories/rewards";
import { SpotLiveRepository } from "@recallnet/db/repositories/spot-live";
import { StakesRepository } from "@recallnet/db/repositories/stakes";
import { TradeRepository } from "@recallnet/db/repositories/trade";
import { TradingConstraintsRepository } from "@recallnet/db/repositories/trading-constraints";
import { UserRepository } from "@recallnet/db/repositories/user";

import { config } from "@/config/private";

import { db, dbReadReplica } from "./db";
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

export const arenaRepository = new ArenaRepository(
  db,
  db,
  createLogger("ArenaRepository"),
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

export const convictionClaimsRepository = new ConvictionClaimsRepository(
  db,
  createLogger("ConvictionClaimsRepository"),
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

export const spotLiveRepository = new SpotLiveRepository(
  db,
  db,
  createLogger("SpotLiveRepository"),
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

export const adminRepository = new AdminRepository(
  db,
  createLogger("AdminRepository"),
);

export const partnerRepository = new PartnerRepository(
  db,
  dbReadReplica,
  createLogger("PartnerRepository"),
);

export const gamesRepository = new GamesRepository(
  db,
  createLogger("GamesRepository"),
);

export const competitionGamesRepository = new CompetitionGamesRepository(
  db,
  createLogger("CompetitionGamesRepository"),
);

export const paperTradingConfigRepository = new PaperTradingConfigRepository(
  db,
);

export const paperTradingInitialBalancesRepository =
  new PaperTradingInitialBalancesRepository(db);

export const eigenaiRepository = new EigenaiRepository(
  db,
  db,
  createLogger("EigenaiRepository"),
);
