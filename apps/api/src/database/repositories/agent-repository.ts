import { AgentRepository } from "@recallnet/db/repositories/agent";

import { db } from "@/database/db.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

import { repository as competitionRewardsRepository } from "./competition-rewards-repository.js";

const repository = new AgentRepository(
  db,
  repositoryLogger,
  competitionRewardsRepository,
);

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

/**
 * All repository functions wrapped with timing and metrics
 * These are the functions that should be imported by services
 */

export const create = createTimedRepositoryFunction(
  repository.create.bind(repository),
  "AgentRepository",
  "create",
);

export const findAll = createTimedRepositoryFunction(
  repository.findAll.bind(repository),
  "AgentRepository",
  "findAll",
);

export const findAgentCompetitions = createTimedRepositoryFunction(
  repository.findAgentCompetitions.bind(repository),
  "AgentRepository",
  "findAgentCompetitions",
);

export const findByCompetition = createTimedRepositoryFunction(
  repository.findByCompetition.bind(repository),
  "AgentRepository",
  "findByCompetition",
);

export const findById = createTimedRepositoryFunction(
  repository.findById.bind(repository),
  "AgentRepository",
  "findById",
);

export const findByIds = createTimedRepositoryFunction(
  repository.findByIds.bind(repository),
  "AgentRepository",
  "findByIds",
);

export const findByOwnerId = createTimedRepositoryFunction(
  repository.findByOwnerId.bind(repository),
  "AgentRepository",
  "findByOwnerId",
);

export const findByApiKeyHash = createTimedRepositoryFunction(
  repository.findByApiKeyHash.bind(repository),
  "AgentRepository",
  "findByApiKeyHash",
);

export const findByWallet = createTimedRepositoryFunction(
  repository.findByWallet.bind(repository),
  "AgentRepository",
  "findByWallet",
);

export const findByName = createTimedRepositoryFunction(
  repository.findByName.bind(repository),
  "AgentRepository",
  "findByName",
);

export const update = createTimedRepositoryFunction(
  repository.update.bind(repository),
  "AgentRepository",
  "update",
);

export const deleteAgent = createTimedRepositoryFunction(
  repository.deleteAgent.bind(repository),
  "AgentRepository",
  "deleteAgent",
);

export const isAgentInCompetition = createTimedRepositoryFunction(
  repository.isAgentInCompetition.bind(repository),
  "AgentRepository",
  "isAgentInCompetition",
);

export const deactivateAgent = createTimedRepositoryFunction(
  repository.deactivateAgent.bind(repository),
  "AgentRepository",
  "deactivateAgent",
);

export const reactivateAgent = createTimedRepositoryFunction(
  repository.reactivateAgent.bind(repository),
  "AgentRepository",
  "reactivateAgent",
);

export const searchAgents = createTimedRepositoryFunction(
  repository.searchAgents.bind(repository),
  "AgentRepository",
  "searchAgents",
);

export const count = createTimedRepositoryFunction(
  repository.count.bind(repository),
  "AgentRepository",
  "count",
);

export const countByWallet = createTimedRepositoryFunction(
  repository.countByWallet.bind(repository),
  "AgentRepository",
  "countByWallet",
);

export const countByName = createTimedRepositoryFunction(
  repository.countByName.bind(repository),
  "AgentRepository",
  "countByName",
);

export const findUserAgentCompetitions = createTimedRepositoryFunction(
  repository.findUserAgentCompetitions.bind(repository),
  "AgentRepository",
  "findUserAgentCompetitions",
);

export const getBulkAgentTrophies = createTimedRepositoryFunction(
  repository.getBulkAgentTrophies.bind(repository),
  "AgentRepository",
  "getBulkAgentTrophies",
);

export const updateAgentsOwner = createTimedRepositoryFunction(
  repository.updateAgentsOwner.bind(repository),
  "AgentRepository",
  "updateAgentsOwner",
);
