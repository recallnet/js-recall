import { CompetitionRepository } from "@recallnet/db/repositories/competition";

import { db, dbRead } from "@/database/db.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

const repository = new CompetitionRepository(db, dbRead, repositoryLogger);

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

/**
 * All repository functions wrapped with timing and metrics
 * These are the functions that should be imported by services
 */

export const findAll = createTimedRepositoryFunction(
  repository.findAll.bind(repository),
  "CompetitionRepository",
  "findAll",
);

export const findById = createTimedRepositoryFunction(
  repository.findById.bind(repository),
  "CompetitionRepository",
  "findById",
);

export const create = createTimedRepositoryFunction(
  repository.create.bind(repository),
  "CompetitionRepository",
  "create",
);

export const update = createTimedRepositoryFunction(
  repository.update.bind(repository),
  "CompetitionRepository",
  "update",
);

export const updateOne = createTimedRepositoryFunction(
  repository.updateOne.bind(repository),
  "CompetitionRepository",
  "updateOne",
);

export const markCompetitionAsEnding = createTimedRepositoryFunction(
  repository.markCompetitionAsEnding.bind(repository),
  "CompetitionRepository",
  "markCompetitionAsEnding",
);

export const markCompetitionAsEnded = createTimedRepositoryFunction(
  repository.markCompetitionAsEnded.bind(repository),
  "CompetitionRepository",
  "markCompetitionAsEnded",
);

export const addAgentToCompetition = createTimedRepositoryFunction(
  repository.addAgentToCompetition.bind(repository),
  "CompetitionRepository",
  "addAgentToCompetition",
);

export const removeAgentFromCompetition = createTimedRepositoryFunction(
  repository.removeAgentFromCompetition.bind(repository),
  "CompetitionRepository",
  "removeAgentFromCompetition",
);

export const addAgents = createTimedRepositoryFunction(
  repository.addAgents.bind(repository),
  "CompetitionRepository",
  "addAgents",
);

export const getAgents = createTimedRepositoryFunction(
  repository.getAgents.bind(repository),
  "CompetitionRepository",
  "getAgents",
);

export const getCompetitionAgents = createTimedRepositoryFunction(
  repository.getCompetitionAgents.bind(repository),
  "CompetitionRepository",
  "getCompetitionAgents",
);

export const isAgentActiveInCompetition = createTimedRepositoryFunction(
  repository.isAgentActiveInCompetition.bind(repository),
  "CompetitionRepository",
  "isAgentActiveInCompetition",
);

export const getAgentCompetitionStatus = createTimedRepositoryFunction(
  repository.getAgentCompetitionStatus.bind(repository),
  "CompetitionRepository",
  "getAgentCompetitionStatus",
);

export const getAgentCompetitionRecord = createTimedRepositoryFunction(
  repository.getAgentCompetitionRecord.bind(repository),
  "CompetitionRepository",
  "getAgentCompetitionRecord",
);

export const updateAgentCompetitionStatus = createTimedRepositoryFunction(
  repository.updateAgentCompetitionStatus.bind(repository),
  "CompetitionRepository",
  "updateAgentCompetitionStatus",
);

export const markAgentAsWithdrawn = createTimedRepositoryFunction(
  repository.markAgentAsWithdrawn.bind(repository),
  "CompetitionRepository",
  "markAgentAsWithdrawn",
);

export const findActive = createTimedRepositoryFunction(
  repository.findActive.bind(repository),
  "CompetitionRepository",
  "findActive",
);

export const findVotingOpen = createTimedRepositoryFunction(
  repository.findVotingOpen.bind(repository),
  "CompetitionRepository",
  "findVotingOpen",
);

export const createPortfolioSnapshot = createTimedRepositoryFunction(
  repository.createPortfolioSnapshot.bind(repository),
  "CompetitionRepository",
  "createPortfolioSnapshot",
);

export const batchCreatePortfolioSnapshots = createTimedRepositoryFunction(
  repository.batchCreatePortfolioSnapshots.bind(repository),
  "CompetitionRepository",
  "batchCreatePortfolioSnapshots",
);

export const getLatestPortfolioSnapshots = createTimedRepositoryFunction(
  repository.getLatestPortfolioSnapshots.bind(repository),
  "CompetitionRepository",
  "getLatestPortfolioSnapshots",
);

export const getBulkLatestPortfolioSnapshots = createTimedRepositoryFunction(
  repository.getBulkLatestPortfolioSnapshots.bind(repository),
  "CompetitionRepository",
  "getBulkLatestPortfolioSnapshots",
);

export const getAgentPortfolioSnapshots = createTimedRepositoryFunction(
  repository.getAgentPortfolioSnapshots.bind(repository),
  "CompetitionRepository",
  "getAgentPortfolioSnapshots",
);

export const getFirstAndLastSnapshots = createTimedRepositoryFunction(
  repository.getFirstAndLastSnapshots.bind(repository),
  "CompetitionRepository",
  "getFirstAndLastSnapshots",
);

export const calculateMaxDrawdownSQL = createTimedRepositoryFunction(
  repository.calculateMaxDrawdownSQL.bind(repository),
  "CompetitionRepository",
  "calculateMaxDrawdownSQL",
);

export const getBoundedSnapshots = createTimedRepositoryFunction(
  repository.getBoundedSnapshots.bind(repository),
  "CompetitionRepository",
  "getBoundedSnapshots",
);

export const getBulkBoundedSnapshots = createTimedRepositoryFunction(
  repository.getBulkBoundedSnapshots.bind(repository),
  "CompetitionRepository",
  "getBulkBoundedSnapshots",
);

export const getAgentRankingsInCompetitions = createTimedRepositoryFunction(
  repository.getAgentRankingsInCompetitions.bind(repository),
  "CompetitionRepository",
  "getAgentRankingsInCompetitions",
);

export const getAllPortfolioSnapshots = createTimedRepositoryFunction(
  repository.getAllPortfolioSnapshots.bind(repository),
  "CompetitionRepository",
  "getAllPortfolioSnapshots",
);

export const count = createTimedRepositoryFunction(
  repository.count.bind(repository),
  "CompetitionRepository",
  "count",
);

export const countAgentCompetitions = createTimedRepositoryFunction(
  repository.countAgentCompetitions.bind(repository),
  "CompetitionRepository",
  "countAgentCompetitions",
);

export const findByStatus = createTimedRepositoryFunction(
  repository.findByStatus.bind(repository),
  "CompetitionRepository",
  "findByStatus",
);

export const findBestPlacementForAgent = createTimedRepositoryFunction(
  repository.findBestPlacementForAgent.bind(repository),
  "CompetitionRepository",
  "findBestPlacementForAgent",
);

export const batchInsertLeaderboard = createTimedRepositoryFunction(
  repository.batchInsertLeaderboard.bind(repository),
  "CompetitionRepository",
  "batchInsertLeaderboard",
);

export const findLeaderboardByCompetition = createTimedRepositoryFunction(
  repository.findLeaderboardByCompetition.bind(repository),
  "CompetitionRepository",
  "findLeaderboardByCompetition",
);

export const findLeaderboardByTradingComp = createTimedRepositoryFunction(
  repository.findLeaderboardByTradingComp.bind(repository),
  "CompetitionRepository",
  "findLeaderboardByTradingComp",
);

export const getAllCompetitionsLeaderboard = createTimedRepositoryFunction(
  repository.getAllCompetitionsLeaderboard.bind(repository),
  "CompetitionRepository",
  "getAllCompetitionsLeaderboard",
);

export const getAllCompetitionAgents = createTimedRepositoryFunction(
  repository.getAllCompetitionAgents.bind(repository),
  "CompetitionRepository",
  "getAllCompetitionAgents",
);

export const getBulkAgentCompetitionRankings = createTimedRepositoryFunction(
  repository.getBulkAgentCompetitionRankings.bind(repository),
  "CompetitionRepository",
  "getBulkAgentCompetitionRankings",
);

export const getBulkAgentCompetitionRecords = createTimedRepositoryFunction(
  repository.getBulkAgentCompetitionRecords.bind(repository),
  "CompetitionRepository",
  "getBulkAgentCompetitionRecords",
);

export const findCompetitionsNeedingEnding = createTimedRepositoryFunction(
  repository.findCompetitionsNeedingEnding.bind(repository),
  "CompetitionRepository",
  "findCompetitionsNeedingEnding",
);

export const getAgentPortfolioTimeline = createTimedRepositoryFunction(
  repository.getAgentPortfolioTimeline.bind(repository),
  "CompetitionRepository",
  "getAgentPortfolioTimeline",
);

export const get24hSnapshots = createTimedRepositoryFunction(
  repository.get24hSnapshots.bind(repository),
  "CompetitionRepository",
  "get24hSnapshots",
);

export const getEnrichedCompetitions = createTimedRepositoryFunction(
  repository.getEnrichedCompetitions.bind(repository),
  "CompetitionRepository",
  "getEnrichedCompetitions",
);

export const getBatchVoteCounts = createTimedRepositoryFunction(
  repository.getBatchVoteCounts.bind(repository),
  "CompetitionRepository",
  "getBatchVoteCounts",
);
