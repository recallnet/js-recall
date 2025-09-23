import { AgentScoreRepository } from "@recallnet/db/repositories/agent-score";

import { db } from "@/database/db.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

const repository = new AgentScoreRepository(db, repositoryLogger);

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

/**
 * All repository functions wrapped with timing and metrics
 * These are the functions that should be imported by services
 */

export const getAllAgentRanks = createTimedRepositoryFunction(
  repository.getAllAgentRanks.bind(repository),
  "AgentScoreRepository",
  "getAllAgentRanks",
);

export const batchUpdateAgentRanks = createTimedRepositoryFunction(
  repository.batchUpdateAgentRanks.bind(repository),
  "AgentScoreRepository",
  "batchUpdateAgentRanks",
);

export const getAllAgentRankHistory = createTimedRepositoryFunction(
  repository.getAllAgentRankHistory.bind(repository),
  "AgentScoreRepository",
  "getAllAgentRankHistory",
);
