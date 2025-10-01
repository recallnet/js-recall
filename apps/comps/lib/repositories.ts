import { AgentRepository } from "@recallnet/db/repositories/agent";
import { BoostRepository } from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { CompetitionRewardsRepository } from "@recallnet/db/repositories/competition-rewards";
import { UserRepository } from "@recallnet/db/repositories/user";
import { VoteRepository } from "@recallnet/db/repositories/vote";

import { db } from "./db";
import { createLogger } from "./logger";

export const competitionRewardsRepository = new CompetitionRewardsRepository(
  db,
  createLogger("CompetitionRewardsRepository"),
);
export const agentRepository = new AgentRepository(
  db,
  createLogger("AgentRepository"),
  competitionRewardsRepository,
);
export const boostRepository = new BoostRepository(db);
export const competitionRepository = new CompetitionRepository(
  db,
  db,
  createLogger("CompetitionRepository"),
);
export const userRepository = new UserRepository(
  db,
  createLogger("UserRepository"),
);
export const voteRepository = new VoteRepository(
  db,
  createLogger("VoteRepository"),
);
