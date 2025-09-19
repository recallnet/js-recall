import { AdminRepository } from "@recallnet/db/repositories/admin";

import { db } from "@/database/db.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

const repository = new AdminRepository(db, repositoryLogger);

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

/**
 * All repository functions wrapped with timing and metrics
 * These are the functions that should be imported by services
 */

export const create = createTimedRepositoryFunction(
  repository.create.bind(repository),
  "AdminRepository",
  "create",
);

export const findAll = createTimedRepositoryFunction(
  repository.findAll.bind(repository),
  "AdminRepository",
  "findAll",
);

export const findById = createTimedRepositoryFunction(
  repository.findById.bind(repository),
  "AdminRepository",
  "findById",
);

export const findByUsername = createTimedRepositoryFunction(
  repository.findByUsername.bind(repository),
  "AdminRepository",
  "findByUsername",
);

export const findByEmail = createTimedRepositoryFunction(
  repository.findByEmail.bind(repository),
  "AdminRepository",
  "findByEmail",
);

export const update = createTimedRepositoryFunction(
  repository.update.bind(repository),
  "AdminRepository",
  "update",
);

export const deleteAdmin = createTimedRepositoryFunction(
  repository.deleteAdmin.bind(repository),
  "AdminRepository",
  "deleteAdmin",
);

export const setApiKey = createTimedRepositoryFunction(
  repository.setApiKey.bind(repository),
  "AdminRepository",
  "setApiKey",
);

export const updateLastLogin = createTimedRepositoryFunction(
  repository.updateLastLogin.bind(repository),
  "AdminRepository",
  "updateLastLogin",
);

export const updatePassword = createTimedRepositoryFunction(
  repository.updatePassword.bind(repository),
  "AdminRepository",
  "updatePassword",
);

export const searchAdmins = createTimedRepositoryFunction(
  repository.searchAdmins.bind(repository),
  "AdminRepository",
  "searchAdmins",
);

export const count = createTimedRepositoryFunction(
  repository.count.bind(repository),
  "AdminRepository",
  "count",
);
