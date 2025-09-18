import { LeaderboardRepository } from "@recallnet/db-schema/repositories/leaderboard";

import { dbRead } from "@/database/db.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

/**
 * Leaderboard Repository
 * Handles database operations for leaderboards
 */
const repository = new LeaderboardRepository(dbRead, repositoryLogger);

// ----------------------------------------------------------------------------
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// ----------------------------------------------------------------------------

/**
 * All repository functions wrapped with timing and metrics
 * These are the functions that should be imported by services
 */

export const getGlobalStats = createTimedRepositoryFunction(
  repository.getGlobalStats.bind(repository),
  "LeaderboardRepository",
  "getGlobalStats",
);

export const getBulkAgentMetrics = createTimedRepositoryFunction(
  repository.getBulkAgentMetrics.bind(repository),
  "LeaderboardRepository",
  "getBulkAgentMetrics",
);

export const getOptimizedGlobalAgentMetrics = createTimedRepositoryFunction(
  repository.getOptimizedGlobalAgentMetrics.bind(repository),
  "LeaderboardRepository",
  "getOptimizedGlobalAgentMetrics",
);
