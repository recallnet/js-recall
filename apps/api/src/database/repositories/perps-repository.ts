import { PerpsRepository } from "@recallnet/db/repositories/perps";
import { InsertPerpetualPosition } from "@recallnet/db/schema/trading/types";

import { db, dbRead } from "@/database/db.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

const repository = new PerpsRepository(db, dbRead, repositoryLogger);

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

/**
 * All repository functions wrapped with timing and metrics
 * These are the functions that should be imported by services
 */

export const createPerpsCompetitionConfig = createTimedRepositoryFunction(
  repository.createPerpsCompetitionConfig.bind(repository),
  "PerpsRepository",
  "createPerpsCompetitionConfig",
);

export const getPerpsCompetitionConfig = createTimedRepositoryFunction(
  repository.getPerpsCompetitionConfig.bind(repository),
  "PerpsRepository",
  "getPerpsCompetitionConfig",
);

export const upsertPerpsPosition = createTimedRepositoryFunction(
  repository.upsertPerpsPosition.bind(repository),
  "PerpsRepository",
  "upsertPerpsPosition",
);

export const batchUpsertPerpsPositions = createTimedRepositoryFunction(
  (positions: InsertPerpetualPosition[]) =>
    repository.batchUpsertPerpsPositions(positions),
  "PerpsRepository",
  "batchUpsertPerpsPositions",
);

export const getPerpsPositions = createTimedRepositoryFunction(
  repository.getPerpsPositions.bind(repository),
  "PerpsRepository",
  "getPerpsPositions",
);

export const createPerpsAccountSummary = createTimedRepositoryFunction(
  repository.createPerpsAccountSummary.bind(repository),
  "PerpsRepository",
  "createPerpsAccountSummary",
);

export const batchCreatePerpsAccountSummaries = createTimedRepositoryFunction(
  repository.batchCreatePerpsAccountSummaries.bind(repository),
  "PerpsRepository",
  "batchCreatePerpsAccountSummaries",
);

export const getLatestPerpsAccountSummary = createTimedRepositoryFunction(
  repository.getLatestPerpsAccountSummary.bind(repository),
  "PerpsRepository",
  "getLatestPerpsAccountSummary",
);

export const createPerpsSelfFundingAlert = createTimedRepositoryFunction(
  repository.createPerpsSelfFundingAlert.bind(repository),
  "PerpsRepository",
  "createPerpsSelfFundingAlert",
);

export const batchCreatePerpsSelfFundingAlerts = createTimedRepositoryFunction(
  repository.batchCreatePerpsSelfFundingAlerts.bind(repository),
  "PerpsRepository",
  "batchCreatePerpsSelfFundingAlerts",
);

export const getUnreviewedPerpsAlerts = createTimedRepositoryFunction(
  repository.getUnreviewedPerpsAlerts.bind(repository),
  "PerpsRepository",
  "getUnreviewedPerpsAlerts",
);

export const reviewPerpsSelfFundingAlert = createTimedRepositoryFunction(
  repository.reviewPerpsSelfFundingAlert.bind(repository),
  "PerpsRepository",
  "reviewPerpsSelfFundingAlert",
);

export const getAgentSelfFundingAlerts = createTimedRepositoryFunction(
  repository.getAgentSelfFundingAlerts.bind(repository),
  "PerpsRepository",
  "getAgentSelfFundingAlerts",
);

export const batchGetAgentsSelfFundingAlerts = createTimedRepositoryFunction(
  repository.batchGetAgentsSelfFundingAlerts.bind(repository),
  "PerpsRepository",
  "batchGetAgentsSelfFundingAlerts",
);

export const getPerpsCompetitionStats = createTimedRepositoryFunction(
  repository.getPerpsCompetitionStats.bind(repository),
  "PerpsRepository",
  "getPerpsCompetitionStats",
);

export const getCompetitionLeaderboardSummaries = createTimedRepositoryFunction(
  repository.getCompetitionLeaderboardSummaries.bind(repository),
  "PerpsRepository",
  "getCompetitionLeaderboardSummaries",
);

export const syncAgentPerpsData = createTimedRepositoryFunction(
  repository.syncAgentPerpsData.bind(repository),
  "PerpsRepository",
  "syncAgentPerpsData",
);

export const batchSyncAgentsPerpsData = createTimedRepositoryFunction(
  repository.batchSyncAgentsPerpsData.bind(repository),
  "PerpsRepository",
  "batchSyncAgentsPerpsData",
);

export const countBulkAgentPositionsInCompetitions =
  createTimedRepositoryFunction(
    repository.countBulkAgentPositionsInCompetitions.bind(repository),
    "PerpsRepository",
    "countBulkAgentPositionsInCompetitions",
  );

export const getCompetitionPerpsPositions = createTimedRepositoryFunction(
  repository.getCompetitionPerpsPositions.bind(repository),
  "PerpsRepository",
  "getCompetitionPerpsPositions",
);

export const saveTransferHistory = createTimedRepositoryFunction(
  repository.saveTransferHistory.bind(repository),
  "PerpsRepository",
  "saveTransferHistory",
);

export const batchSaveTransferHistory = createTimedRepositoryFunction(
  repository.batchSaveTransferHistory.bind(repository),
  "PerpsRepository",
  "batchSaveTransferHistory",
);

export const getAgentTransferHistory = createTimedRepositoryFunction(
  repository.getAgentTransferHistory.bind(repository),
  "PerpsRepository",
  "getAgentTransferHistory",
);

export const upsertRiskMetrics = createTimedRepositoryFunction(
  repository.upsertRiskMetrics.bind(repository),
  "PerpsRepository",
  "upsertRiskMetrics",
);

export const saveRiskMetrics = createTimedRepositoryFunction(
  repository.saveRiskMetrics.bind(repository),
  "PerpsRepository",
  "saveRiskMetrics",
);

export const getCompetitionRiskMetricsLeaderboard =
  createTimedRepositoryFunction(
    repository.getCompetitionRiskMetricsLeaderboard.bind(repository),
    "PerpsRepository",
    "getCompetitionRiskMetricsLeaderboard",
  );

export const getRiskAdjustedLeaderboard = createTimedRepositoryFunction(
  repository.getRiskAdjustedLeaderboard.bind(repository),
  "PerpsRepository",
  "getRiskAdjustedLeaderboard",
);

export const getBulkAgentRiskMetrics = createTimedRepositoryFunction(
  repository.getBulkAgentRiskMetrics.bind(repository),
  "PerpsRepository",
  "getBulkAgentRiskMetrics",
);
