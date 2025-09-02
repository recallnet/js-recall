import { os } from "@orpc/server";
import * as z from "zod";

import { SelectUser } from "@recallnet/db-schema/core/types";

import { Database } from "@/rpc/types";

export const boostAgent = os
  .$context<{ user: SelectUser; db: Database }>()
  .input(z.object({ agentId: z.string().uuid(), amount: z.bigint() }))
  .handler(async ({ input, context }) => {
    // TODO: Impplement real boosting logic.
    return true;
  });
