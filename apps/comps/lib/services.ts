import { BoostService } from "@recallnet/services/boost";

import {
  boostRepository,
  competitionRepository,
  userRepository,
} from "@/lib/repositories";

const nonStakeBoostAmount = process.env.NEXT_PUBLIC_NON_STAKE_BOOST_AMOUNT
  ? Number(process.env.NEXT_PUBLIC_NON_STAKE_BOOST_AMOUNT)
  : undefined;

export const boostService = new BoostService(
  boostRepository,
  competitionRepository,
  userRepository,
  nonStakeBoostAmount,
);
