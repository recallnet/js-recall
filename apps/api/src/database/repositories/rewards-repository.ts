import { RewardsRepository } from "@recallnet/db-schema/repositories/rewards";

import { db } from "@/database/db.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

const repository = new RewardsRepository(db, repositoryLogger);

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

export const getRewardsByCompetition = createTimedRepositoryFunction(
  repository.getRewardsByCompetition.bind(repository),
  "RewardsRepository",
  "getRewardsByCompetition",
);

export const insertRewards = createTimedRepositoryFunction(
  repository.insertRewards.bind(repository),
  "RewardsRepository",
  "insertRewards",
);

export const insertRewardsTree = createTimedRepositoryFunction(
  repository.insertRewardsTree.bind(repository),
  "RewardsRepository",
  "insertRewardsTree",
);

export const insertRewardsRoot = createTimedRepositoryFunction(
  repository.insertRewardsRoot.bind(repository),
  "RewardsRepository",
  "insertRewardsRoot",
);

export const getRewardsTreeByCompetition = createTimedRepositoryFunction(
  repository.getRewardsTreeByCompetition.bind(repository),
  "RewardsRepository",
  "getRewardsTreeByCompetition",
);

export const findCompetitionByRootHash = createTimedRepositoryFunction(
  repository.findCompetitionByRootHash.bind(repository),
  "RewardsRepository",
  "findCompetitionByRootHash",
);

export const markRewardAsClaimed = createTimedRepositoryFunction(
  repository.markRewardAsClaimed.bind(repository),
  "RewardsRepository",
  "markRewardAsClaimed",
);
