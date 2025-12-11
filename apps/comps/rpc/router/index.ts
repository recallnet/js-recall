import type { InferRouterOutputs } from "@orpc/server";

import { router as agent } from "./agent";
import { router as airdrop } from "./airdrop";
import { router as arena } from "./arena";
import { router as boost } from "./boost";
import { router as competitions } from "./competitions";
import { router as eigenai } from "./eigenai";
import { router as leaderboard } from "./leaderboard";
import { router as nfl } from "./nfl";
import { router as rewards } from "./rewards";
import { router as user } from "./user";

export const router = {
  agent,
  arena,
  airdrop,
  boost,
  competitions,
  eigenai,
  leaderboard,
  nfl,
  user,
  rewards,
} as const;

export type RouterOutputs = InferRouterOutputs<typeof router>;
