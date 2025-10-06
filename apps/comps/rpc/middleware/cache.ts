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
  revalidateSecs?: number;
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
        ...path,
        JSON.stringify(serialized),
        ...(options?.key || []),
      ];

      const cachedHandler = unstable_cache(
        async () => {
          context.logger.debug(
            { cacheKey },
            "Cache middleware miss, invoking next()",
          );
          return await next();
        },
        cacheKey,
        {
          revalidate: options?.revalidateSecs,
          tags: options?.tags,
        },
      );

      context.logger.debug(
        { cacheKey },
        "Cache middleware checking cache for key",
      );
      return await cachedHandler();
    });
}
