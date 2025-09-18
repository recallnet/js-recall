import { BalanceRepository } from "@recallnet/db-schema/repositories/balance";

import { config } from "@/config/index.js";
import { db } from "@/database/db.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

export const repository = new BalanceRepository(
  db,
  repositoryLogger,
  config.specificChainTokens,
);

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

/**
 * All repository functions wrapped with timing and metrics
 * These are the functions that should be imported by services
 */

export const count = createTimedRepositoryFunction(
  repository.count.bind(repository),
  "BalanceRepository",
  "count",
);

export const getBalance = createTimedRepositoryFunction(
  repository.getBalance.bind(repository),
  "BalanceRepository",
  "getBalance",
);

export const getAgentBalances = createTimedRepositoryFunction(
  repository.getAgentBalances.bind(repository),
  "BalanceRepository",
  "getAgentBalances",
);

export const getAgentsBulkBalances = createTimedRepositoryFunction(
  repository.getAgentsBulkBalances.bind(repository),
  "BalanceRepository",
  "getAgentsBulkBalances",
);

export const resetAgentBalances = createTimedRepositoryFunction(
  repository.resetAgentBalances.bind(repository),
  "BalanceRepository",
  "resetAgentBalances",
);

// Export atomic balance functions
export const incrementBalanceInTransaction = createTimedRepositoryFunction(
  repository.incrementBalanceInTransaction.bind(repository),
  "BalanceRepository",
  "incrementBalanceInTransaction",
);

export const decrementBalanceInTransaction = createTimedRepositoryFunction(
  repository.decrementBalanceInTransaction.bind(repository),
  "BalanceRepository",
  "decrementBalanceInTransaction",
);
