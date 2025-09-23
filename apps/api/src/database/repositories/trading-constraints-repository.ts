import { TradingConstraintsRepository } from "@recallnet/db/repositories/trading-constraints";

import { db } from "@/database/db.js";

const repository = new TradingConstraintsRepository(db);

// Export the repository functions
export const create = repository.create.bind(repository);
export const findByCompetitionId =
  repository.findByCompetitionId.bind(repository);
export const update = repository.update.bind(repository);
export const deleteConstraints = repository.delete.bind(repository);
export const upsert = repository.upsert.bind(repository);
