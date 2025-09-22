import { os } from "@orpc/server";
import { eq } from "drizzle-orm";
import { IronSession } from "iron-session";

import schema from "@recallnet/db/schema";

import { Database, SessionData } from "@/rpc/types";

export const userMiddleware = os
  .$context<{
    ironSession: IronSession<SessionData>;
    db: Database;
  }>()
  .middleware(async ({ context, next }) => {
    const userId = context.ironSession.userId;
    if (!userId) {
      return await next({
        context: {
          user: undefined,
        },
      });
    }

    const user = await context.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    return await next({
      context: {
        user,
      },
    });
  });
