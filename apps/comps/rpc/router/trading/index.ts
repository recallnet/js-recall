import type { InferRouterOutputs } from "@orpc/server";

import { router as admin } from "./admin";

export const router = {
  admin,
} as const;

export type RouterOutputs = InferRouterOutputs<typeof router>;
