import { TradeRepository } from "@recallnet/db-schema/repositories/trade";

import { db } from "@/database/db.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

import { repository as balanceRepository } from "./balance-repository.js";

const repository = new TradeRepository(db, repositoryLogger, balanceRepository);

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

export const createTradeWithBalances = createTimedRepositoryFunction(
  repository.createTradeWithBalances.bind(repository),
  "TradeRepository",
  "createTradeWithBalances",
);

export const getAgentTrades = createTimedRepositoryFunction(
  repository.getAgentTrades.bind(repository),
  "TradeRepository",
  "getAgentTrades",
);

export const getAgentTradesInCompetition = createTimedRepositoryFunction(
  repository.getAgentTradesInCompetition.bind(repository),
  "TradeRepository",
  "getAgentTradesInCompetition",
);

export const getCompetitionTrades = createTimedRepositoryFunction(
  repository.getCompetitionTrades.bind(repository),
  "TradeRepository",
  "getCompetitionTrades",
);

export const countBulkAgentTradesInCompetitions = createTimedRepositoryFunction(
  repository.countBulkAgentTradesInCompetitions.bind(repository),
  "TradeRepository",
  "countBulkAgentTradesInCompetitions",
);

export const count = createTimedRepositoryFunction(
  repository.count.bind(repository),
  "TradeRepository",
  "count",
);

export const getCompetitionTradeMetrics = createTimedRepositoryFunction(
  repository.getCompetitionTradeMetrics.bind(repository),
  "TradeRepository",
  "getCompetitionTradeMetrics",
);
