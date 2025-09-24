import { BoostService } from "@recallnet/services/boost";

import {
  boostRepository,
  competitionRepository,
  userRepository,
} from "@/lib/repositories";

export const boostService = new BoostService(
  boostRepository,
  competitionRepository,
  userRepository,
);
