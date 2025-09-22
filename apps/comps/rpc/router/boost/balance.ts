import { call, os } from "@orpc/server";

import { SelectUser } from "@recallnet/db/schema/core/types";

import { Database } from "@/rpc/types";

export const balance = os
  .$context<{ user: SelectUser; db: Database }>()
  .handler(async ({ context }) => {
    // TODO: Impplement real balance fetching logic.
    return { balance: BigInt(1000) };
  });
