import { BoostRepository } from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { UserRepository } from "@recallnet/db/repositories/user";

import { db } from "./db";

export const boostRepository = new BoostRepository(db);
export const competitionRepository = new CompetitionRepository(db, db);
export const userRepository = new UserRepository(db);
