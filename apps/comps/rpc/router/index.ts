import type { InferRouterOutputs } from "@orpc/server";

import { router as agent } from "./agent";
import { router as arena } from "./arena";
import { router as boost } from "./boost";
import { router as competitions } from "./competitions";
import { router as leaderboard } from "./leaderboard";
import { router as rewards } from "./rewards";
import { router as user } from "./user";

export const router = {
  agent,
  arena,
  boost,
  competitions,
  leaderboard,
  user,
  rewards,
} as const;

export type RouterOutputs = InferRouterOutputs<typeof router>;
