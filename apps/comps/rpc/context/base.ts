import { os } from "@orpc/server";
import { PrivyClient } from "@privy-io/node";
import { cookies } from "next/headers";

import { Database } from "@recallnet/db/types";
import { BoostService } from "@recallnet/services/boost";

export const base = os
  .$context<{
    cookies: Awaited<ReturnType<typeof cookies>>;
    privyClient: PrivyClient;
    boostService: BoostService;
    db: Database;
  }>()
  .errors({
    NOT_FOUND: {
      message: "The resource was not found",
    },
    INTERNAL: {
      message: "An internal server error occurred",
    },
    UNAUTHORIZED: {},
  });
