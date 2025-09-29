import { BoostService } from "@recallnet/services";

import {
  boostRepository,
  competitionRepository,
  userRepository,
} from "@/lib/repositories";

import { createLogger } from "./logger";

const noStakeBoostAmount = process.env.NEXT_PUBLIC_NON_STAKE_BOOST_AMOUNT
  ? BigInt(process.env.NEXT_PUBLIC_NON_STAKE_BOOST_AMOUNT)
  : undefined;

export const boostService = new BoostService(
  boostRepository,
  competitionRepository,
  userRepository,
  { boost: { noStakeBoostAmount } },
  createLogger("BoostService"),
);
