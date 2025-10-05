import { StandardRPCJsonSerializer } from "@orpc/client/standard";
import {
  Context,
  ErrorMap,
  Meta,
  Middleware,
  ORPCErrorConstructorMap,
  os,
} from "@orpc/server";
import { unstable_cache } from "next/cache";

import { base } from "@/rpc/context/base";

const xcacheMiddleware = (options: {
  key: string[];
  revalidate?: number;
  tags?: string[];
  includeContext?: (context: unknown) => Record<string, any>;
}) =>
  base.middleware(async ({ context, next }, input) => {
    const contextValues = options.includeContext?.(context) || {};
    const cacheKey = [
      ...options.key,
      JSON.stringify(input),
      JSON.stringify(contextValues),
    ];

    const cachedHandler = unstable_cache(
      async () => await next({ context }),
      cacheKey,
      {
        revalidate: options.revalidate,
        tags: options.tags,
      },
    );

    return await cachedHandler();
  });

export function cacheMiddleware<
  TInContext extends Context,
  TInput,
  TOutput,
  TErrorMap extends ErrorMap,
  TMeta extends Meta,
>(options?: {
  key?: string[];
  revalidate?: number;
  tags?: string[];
  includeContext?: (context: TInContext) => Record<string, any>;
}): Middleware<
  TInContext,
  Record<never, never>,
  TInput,
  TOutput,
  ORPCErrorConstructorMap<TErrorMap>,
  TMeta
> {
  return async ({ context, next, path }, input) => {
    const contextValues = options?.includeContext?.(context);

    const serializer = new StandardRPCJsonSerializer();
    const [serialized] = serializer.serialize({
      input,
      contextValues,
    });

    const cacheKey = [
      ...(options?.key || []),
      ...path,
      JSON.stringify(serialized),
    ];

    console.log("CACHE KEY:", cacheKey);

    const cachedHandler = unstable_cache(async () => await next(), cacheKey, {
      revalidate: options?.revalidate,
      tags: options?.tags,
    });

    return await cachedHandler();
  };
}

const authMiddleware = os
  .$context<{ something?: string }>() // <-- define dependent-context
  .middleware(async ({ context, next }) => {
    // Execute logic before the handler

    const result = await next();

    // Execute logic after the handler

    return result;
  });
