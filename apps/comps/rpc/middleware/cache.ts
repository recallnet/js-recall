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

/**
 * Creates a caching middleware for ORPC procedures using Next.js cache
 *
 * @param options - Cache configuration options
 * @param options.key - Additional cache key components
 * @param options.revalidateSecs - Cache revalidation period in seconds
 * @param options.tags - Cache tags for selective invalidation
 * @param options.includeContext - Function to extract context values for cache key
 * @returns Middleware that caches procedure results
 */
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
      // Extract additional context values for cache key if specified
      const contextValues = options?.includeContext?.(context as TInContext);

      // Serialize input and context values for consistent cache key generation
      const serializer = new StandardRPCJsonSerializer();
      const [serialized] = serializer.serialize({
        input,
        contextValues,
      });

      // Build cache key from procedure path, serialized input, and optional key components
      const cacheKey = [
        ...path,
        JSON.stringify(serialized),
        ...(options?.key || []),
      ];

      // Create cached version of the next handler
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
