import {
  type StandardRPCJsonSerialized,
  StandardRPCJsonSerializer,
} from "@orpc/client/standard";
import { MiddlewareResult, os } from "@orpc/server";
import { unstable_cache } from "next/cache";
import type { Logger } from "pino";

/**
 * Creates a caching middleware for ORPC procedures using Next.js cache.
 * Accepts all input via middleware context.
 *
 * @param context - Middleware context
 * @param context.logger - Logger instance
 * @param context.key - Additional cache key components
 * @param context.revalidateSecs - Cache revalidation period in seconds
 * @param context.tags - Cache tags for selective invalidation
 * @returns Middleware that caches procedure results
 */
export const cacheMiddleware = os
  .$context<{
    logger: Logger;
    key: string[] | undefined;
    revalidateSecs: number | undefined;
    tags: string[] | undefined;
  }>()
  .middleware(async ({ context, next, path }, input) => {
    // Serialize input and context values for consistent cache key generation
    const serializer = new StandardRPCJsonSerializer();
    const [serialized] = serializer.serialize({ input });

    // Build cache key from procedure path, serialized input, and optional key components
    const cacheKey = [
      ...path,
      JSON.stringify(serialized),
      ...(context.key || []),
    ];

    // Generate cache tags from input if getTags function is provided
    const tags = context.tags;

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
        revalidate: context.revalidateSecs,
        tags,
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
    const result = serializer.deserialize(json, meta, maps, (index: number) => {
      const blob = blobs[index];
      if (!blob) {
        throw new Error(`Missing blob at index ${index}`);
      }
      return blob;
    });
    return result as MiddlewareResult<Record<never, never>, unknown>;
  });
