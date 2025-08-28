import { ORPCError, os } from "@orpc/server";
import { IronSession, getIronSession } from "iron-session";
import { cookies, headers } from "next/headers";
import * as z from "zod";

const PlanetSchema = z.object({
  id: z.number().int().min(1),
  name: z.string(),
  description: z.string().optional(),
});

const base = os.$context<{
  headers: Awaited<ReturnType<typeof headers>>;
  cookies: Awaited<ReturnType<typeof cookies>>;
  cookieName: string;
  cookiePassword: string;
}>();

const ironSessionMiddleware = os
  .$context<{
    cookies: Awaited<ReturnType<typeof cookies>>;
    cookieName: string;
    cookiePassword: string;
  }>()
  .middleware(async ({ context, next }) => {
    // Execute logic before the handler
    const ironSession = await getIronSession<{ userId?: string }>(
      context.cookies,
      {
        password: context.cookiePassword,
        cookieName: context.cookieName,
      },
    );

    const result = await next({
      context: {
        ironSession,
      },
    });

    // Execute logic after the handler

    return result;
  });

const userMiddleware = os
  .$context<{ ironSession: IronSession<{ userId?: string }> }>()
  .middleware(async ({ context, next }) => {
    // Execute logic before the handler
    const userId = context.ironSession.userId;
    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const result = await next({
      context: {
        userId,
      },
    });

    // Execute logic after the handler

    return result;
  });

const authMiddleware = ironSessionMiddleware.concat(userMiddleware);

export const listPlanet = base
  .use(authMiddleware)
  .input(
    z.object({
      limit: z.number().int().min(1).max(100).optional(),
      cursor: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ input, context }) => {
    // your list code here
    return [{ id: 1, name: "name" }];
  });

export const router = {
  list: listPlanet,
};
