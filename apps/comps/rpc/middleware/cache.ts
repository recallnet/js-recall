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
import type { Logger } from "pino";

export function cacheMiddleware<
  TInContext extends Context & { logger: Logger },
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
  return os
    .$context<{ logger: Logger }>()
    .middleware(async ({ context, next, path }, input) => {
      const contextValues = options?.includeContext?.(context as TInContext);

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

      context.logger.debug(
        { cacheKey },
        "Cache middleware: cache key generated",
      );

      const cachedHandler = unstable_cache(async () => await next(), cacheKey, {
        revalidate: options?.revalidate,
        tags: options?.tags,
      });

      return await cachedHandler();
    });
}

const authMiddleware = os
  .$context<{ something?: string }>() // <-- define dependent-context
  .middleware(async ({ context, next }) => {
    // Execute logic before the handler

    const result = await next();

    // Execute logic after the handler

    return result;
  });
