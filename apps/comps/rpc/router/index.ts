import type { InferRouterOutputs } from "@orpc/server";

import { router as agent } from "./agent";
import { router as boost } from "./boost";
import { router as competitions } from "./competitions";
import { router as leaderboard } from "./leaderboard";
import { router as user } from "./user";

export const router = {
  agent,
  boost,
  competitions,
  leaderboard,
  user,
} as const;

export type RouterOutputs = InferRouterOutputs<typeof router>;
