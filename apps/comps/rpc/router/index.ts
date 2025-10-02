import type { InferRouterOutputs } from "@orpc/server";

import { router as boost } from "./boost";
import { router as competitions } from "./competitions";
import { router as user } from "./user";

export const router = {
  boost,
  competitions,
  user,
} as const;
