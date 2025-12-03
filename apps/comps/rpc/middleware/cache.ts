import {
  type StandardRPCJsonSerialized,
  StandardRPCJsonSerializer,
} from "@orpc/client/standard";
import {
  Context,
  ErrorMap,
  Meta,
  Middleware,
  MiddlewareResult,
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
 * @param options.getTags - Function to generate cache tags from input for selective invalidation
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
  getTags?: (input: TInput) => string[];
  includeContext?: (context: TInContext) => Record<string, unknown>;
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
      // In test environments (Vitest), Next.js cache is not available
      // Check if we're in a test environment by looking for Vitest globals
      const isTestEnvironment =
        typeof process !== "undefined" &&
        (process.env.VITEST === "true" || process.env.NODE_ENV === "test");

      if (isTestEnvironment) {
        context.logger.debug(
          { path },
          "Test environment detected, skipping cache middleware",
        );
        return next();
      }

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

      // Generate cache tags from input if getTags function is provided
      const tags = options?.getTags?.(input) || [];

      // Create cached version of the next handler
      const cachedHandler = unstable_cache(
        async (): Promise<StandardRPCJsonSerialized> => {
          context.logger.debug(
            { cacheKey },
            "Cache middleware miss, invoking next()",
          );
          const result = await next();

          // Serialize result to convert BigInt and other non-JSON types to safe formats
          // Returns [json, meta, maps, blobs] tuple where json is JSON-safe
          return serializer.serialize(result);
        },
        cacheKey,
        {
          revalidate: options?.revalidateSecs,
          tags: tags.length > 0 ? tags : undefined,
        },
      );

      context.logger.debug(
        { cacheKey, tags },
        "Cache middleware checking cache for key",
      );

      // Get cached result (which is the serialized tuple)
      const cachedResult = await cachedHandler();

      // Deserialize to restore original types (BigInt, Date, etc.)
      const [json, meta, maps, blobs] = cachedResult;
      const result = serializer.deserialize(
        json,
        meta,
        maps,
        (index: number) => {
          const blob = blobs[index];
          if (!blob) {
            throw new Error(`Missing blob at index ${index}`);
          }
          return blob;
        },
      );
      return result as MiddlewareResult<Record<never, never>, TOutput>;
    });
}
