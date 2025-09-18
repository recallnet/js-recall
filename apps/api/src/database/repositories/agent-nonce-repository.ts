import { AgentNonceRepository } from "@recallnet/db-schema/repositories/agent-nonce";

import { db } from "@/database/db.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

const repository = new AgentNonceRepository(db);

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

export const create = createTimedRepositoryFunction(
  repository.create.bind(repository),
  "AgentNonceRepository",
  "create",
);

export const findByNonce = createTimedRepositoryFunction(
  repository.findByNonce.bind(repository),
  "AgentNonceRepository",
  "findByNonce",
);

export const markAsUsed = createTimedRepositoryFunction(
  repository.markAsUsed.bind(repository),
  "AgentNonceRepository",
  "markAsUsed",
);

export const deleteExpired = createTimedRepositoryFunction(
  repository.deleteExpired.bind(repository),
  "AgentNonceRepository",
  "deleteExpired",
);

export const deleteByAgentId = createTimedRepositoryFunction(
  repository.deleteByAgentId.bind(repository),
  "AgentNonceRepository",
  "deleteByAgentId",
);
