import { CompetitionRewardsRepository } from "@recallnet/db/repositories/competition-rewards";

import { db } from "@/database/db.js";
import { competitionRewardsLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

export const repository = new CompetitionRewardsRepository(
  db,
  competitionRewardsLogger,
);

// ----------------------------------------------------------------------------
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// ----------------------------------------------------------------------------

/**
 * All repository functions wrapped with timing and metrics
 * These are the functions that should be imported by services
 */

export const createRewards = createTimedRepositoryFunction(
  repository.createRewards.bind(repository),
  "CompetitionRewardsRepository",
  "createRewards",
);

export const findRewardByCompetitionAndRank = createTimedRepositoryFunction(
  repository.findRewardByCompetitionAndRank.bind(repository),
  "CompetitionRewardsRepository",
  "findRewardByCompetitionAndRank",
);

export const findRewardsByCompetition = createTimedRepositoryFunction(
  repository.findRewardsByCompetition.bind(repository),
  "CompetitionRewardsRepository",
  "findRewardsByCompetition",
);

export const findRewardsByCompetitions = createTimedRepositoryFunction(
  repository.findRewardsByCompetitions.bind(repository),
  "CompetitionRewardsRepository",
  "findRewardsByCompetitions",
);

export const findRewardsByAgent = createTimedRepositoryFunction(
  repository.findRewardsByAgent.bind(repository),
  "CompetitionRewardsRepository",
  "findRewardsByAgent",
);

export const updateReward = createTimedRepositoryFunction(
  repository.updateReward.bind(repository),
  "CompetitionRewardsRepository",
  "updateReward",
);

export const deleteReward = createTimedRepositoryFunction(
  repository.deleteReward.bind(repository),
  "CompetitionRewardsRepository",
  "deleteReward",
);

export const deleteRewardsByCompetition = createTimedRepositoryFunction(
  repository.deleteRewardsByCompetition.bind(repository),
  "CompetitionRewardsRepository",
  "deleteRewardsByCompetition",
);

export const assignWinnersToRewards = createTimedRepositoryFunction(
  repository.assignWinnersToRewards.bind(repository),
  "CompetitionRewardsRepository",
  "assignWinnersToRewards",
);
