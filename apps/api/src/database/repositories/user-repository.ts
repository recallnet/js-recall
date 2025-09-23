import { UserRepository } from "@recallnet/db/repositories/user";

import { db } from "@/database/db.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

const repository = new UserRepository(db, repositoryLogger);

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

/**
 * All repository functions wrapped with timing and metrics
 * These are the functions that should be imported by services
 */

export const create = createTimedRepositoryFunction(
  repository.create.bind(repository),
  "UserRepository",
  "create",
);

export const findAll = createTimedRepositoryFunction(
  repository.findAll.bind(repository),
  "UserRepository",
  "findAll",
);

export const findById = createTimedRepositoryFunction(
  repository.findById.bind(repository),
  "UserRepository",
  "findById",
);

export const findByWalletAddress = createTimedRepositoryFunction(
  repository.findByWalletAddress.bind(repository),
  "UserRepository",
  "findByWalletAddress",
);

export const findDuplicateByWalletAddress = createTimedRepositoryFunction(
  repository.findDuplicateByWalletAddress.bind(repository),
  "UserRepository",
  "findDuplicateByWalletAddress",
);

export const findByEmail = createTimedRepositoryFunction(
  repository.findByEmail.bind(repository),
  "UserRepository",
  "findByEmail",
);

export const findByPrivyId = createTimedRepositoryFunction(
  repository.findByPrivyId.bind(repository),
  "UserRepository",
  "findByPrivyId",
);

export const update = createTimedRepositoryFunction(
  repository.update.bind(repository),
  "UserRepository",
  "update",
);

export const deleteUser = createTimedRepositoryFunction(
  repository.deleteUser.bind(repository),
  "UserRepository",
  "deleteUser",
);

export const searchUsers = createTimedRepositoryFunction(
  repository.searchUsers.bind(repository),
  "UserRepository",
  "searchUsers",
);

export const count = createTimedRepositoryFunction(
  repository.count.bind(repository),
  "UserRepository",
  "count",
);
