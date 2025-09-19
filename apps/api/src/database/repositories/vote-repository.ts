import { VoteRepository } from "@recallnet/db/repositories/vote";

import { db } from "@/database/db.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

const repository = new VoteRepository(db, repositoryLogger);

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

/**
 * All repository functions wrapped with timing and metrics
 * These are the functions that should be imported by services
 */

export const createVote = createTimedRepositoryFunction(
  repository.createVote.bind(repository),
  "VoteRepository",
  "createVote",
);

export const findVoteByUserAgentCompetition = createTimedRepositoryFunction(
  repository.findVoteByUserAgentCompetition.bind(repository),
  "VoteRepository",
  "findVoteByUserAgentCompetition",
);

export const findVotesByUser = createTimedRepositoryFunction(
  repository.findVotesByUser.bind(repository),
  "VoteRepository",
  "findVotesByUser",
);

export const findVotesByCompetition = createTimedRepositoryFunction(
  repository.findVotesByCompetition.bind(repository),
  "VoteRepository",
  "findVotesByCompetition",
);

export const countVotesByAgent = createTimedRepositoryFunction(
  repository.countVotesByAgent.bind(repository),
  "VoteRepository",
  "countVotesByAgent",
);

export const getVoteCountsByCompetition = createTimedRepositoryFunction(
  repository.getVoteCountsByCompetition.bind(repository),
  "VoteRepository",
  "getVoteCountsByCompetition",
);

export const getUserVotesForCompetition = createTimedRepositoryFunction(
  repository.getUserVotesForCompetition.bind(repository),
  "VoteRepository",
  "getUserVotesForCompetition",
);

export const hasUserVotedInCompetition = createTimedRepositoryFunction(
  repository.hasUserVotedInCompetition.bind(repository),
  "VoteRepository",
  "hasUserVotedInCompetition",
);

export const getUserVoteForCompetition = createTimedRepositoryFunction(
  repository.getUserVoteForCompetition.bind(repository),
  "VoteRepository",
  "getUserVoteForCompetition",
);

export const count = createTimedRepositoryFunction(
  repository.count.bind(repository),
  "VoteRepository",
  "count",
);

export const updateVotesOwner = createTimedRepositoryFunction(
  repository.updateVotesOwner.bind(repository),
  "VoteRepository",
  "updateVotesOwner",
);
