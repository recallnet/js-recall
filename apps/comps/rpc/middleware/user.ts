import { eq } from "drizzle-orm";

import schema from "@recallnet/db/schema";

import { base } from "@/rpc/context/base";
import { Database } from "@/rpc/types";

import { privyUserMiddleware } from "./privy-user";

export const userMiddleware = base
  .middleware(privyUserMiddleware)
  .concat(async ({ context, next }) => {
    const userId = context.privyUser?.id;
    if (!userId) {
      return await next({
        context: {
          user: undefined,
        },
      });
    }

    // TODO: Update our context to contain the user service so we don't
    // have to access the db directly in our handlers.
    const user = await context.db.query.users.findFirst({
      where: eq(schema.users.privyId, userId),
    });

    return await next({
      context: {
        user,
      },
    });
  });
