import client from "prom-client";

import { config } from "@/config/index.js";
import { repositoryLogger } from "@/lib/logger.js";
import { getTraceId } from "@/lib/trace-context.js";

// Global metrics cache to prevent multiple registrations
let metricsCache: {
  dbQueryDuration: client.Histogram<string>;
  dbQueryTotal: client.Counter<string>;
} | null = null;

/**
 * Simple sampling function for logging
 * @param sampleRate - Number between 0.0 and 1.0 (0.01 = 1%, 1.0 = 100%)
 * @returns true if this operation should be logged
 */
function shouldSample(sampleRate: number): boolean {
  return Math.random() < sampleRate;
}

// Get or create database timing metrics (reuse existing metrics from db.ts)
const getDbMetrics = () => {
  // Return cached metrics if they exist
  if (metricsCache) {
    return metricsCache;
  }

  // Try to get existing repository metrics first
  const existingDuration = client.register.getSingleMetric(
    "repository_query_duration_ms",
  ) as client.Histogram<string>;
  const existingTotal = client.register.getSingleMetric(
    "repository_queries_total",
  ) as client.Counter<string>;

  if (existingDuration && existingTotal) {
    metricsCache = {
      dbQueryDuration: existingDuration,
      dbQueryTotal: existingTotal,
    };
    return metricsCache;
  }

  // Create repository-specific metrics (separate from db.ts metrics)
  try {
    const dbQueryDuration = new client.Histogram({
      name: "repository_query_duration_ms",
      help: "Duration of repository database queries in ms",
      labelNames: ["operation", "repository", "method"],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
    });

    const dbQueryTotal = new client.Counter({
      name: "repository_queries_total",
      help: "Total number of repository database queries",
      labelNames: ["operation", "repository", "method", "status"],
    });

    metricsCache = { dbQueryDuration, dbQueryTotal };
    return metricsCache;
  } catch (error) {
    // If creation fails (metrics already exist), try to get them again
    const fallbackDuration = client.register.getSingleMetric(
      "repository_query_duration_ms",
    ) as client.Histogram<string>;
    const fallbackTotal = client.register.getSingleMetric(
      "repository_queries_total",
    ) as client.Counter<string>;

    if (fallbackDuration && fallbackTotal) {
      metricsCache = {
        dbQueryDuration: fallbackDuration,
        dbQueryTotal: fallbackTotal,
      };
      return metricsCache;
    }

    throw new Error(
      `Failed to create or retrieve repository database metrics: ${error}`,
    );
  }
};

/**
 * Determines the likely SQL operation type based on function name
 */
function getOperationFromMethod(methodName: string): string {
  const name = methodName.toLowerCase();

  // Special case: balance operations should be treated as UPDATE (upsert operations)
  if (name.includes("save") && name.includes("balance")) {
    return "UPDATE";
  }

  // INSERT operations (create, insert, add, batch create)
  if (
    name.includes("create") ||
    name.includes("insert") ||
    name.includes("add") ||
    name.includes("register") ||
    name.includes("store") ||
    name.includes("save") ||
    name.includes("build") ||
    name.includes("generate") ||
    name.includes("populate") ||
    name.includes("sync") ||
    (name.includes("batch") &&
      (name.includes("create") || name.includes("insert"))) // batchInsertLeaderboard
  ) {
    return "INSERT";
  }

  // UPDATE operations (update, set, mark, reset, batch update)
  if (
    name.includes("update") ||
    name.includes("set") ||
    name.includes("save") ||
    name.includes("modify") ||
    name.includes("change") ||
    name.includes("edit") ||
    name.includes("patch") ||
    name.includes("mark") || // markAsUsed, markTokenAsUsed, markAgentAsWithdrawn
    name.includes("reset") || // resetAgentBalances
    name.includes("activate") || // activateAgent, deactivateAgent
    name.includes("deactivate") ||
    name.includes("reactivate") ||
    name.includes("toggle") ||
    name.includes("increment") ||
    name.includes("decrement") ||
    (name.includes("batch") && name.includes("update")) // batchUpdateAgentRanks
  ) {
    return "UPDATE";
  }

  // DELETE operations (delete, remove, clear, purge)
  if (
    name.includes("delete") ||
    name.includes("remove") ||
    name.includes("clear") ||
    name.includes("purge") ||
    name.includes("destroy") ||
    name.includes("clean") ||
    name.includes("expire") ||
    name.startsWith("deleteexpired") || // deleteExpired
    name.startsWith("deletebyagent") // deleteByAgentId
  ) {
    return "DELETE";
  }

  // SELECT operations (find, get, search, query, count, check, validate, etc.)
  if (
    name.includes("find") ||
    name.includes("get") ||
    name.includes("search") ||
    name.includes("query") ||
    name.includes("fetch") ||
    name.includes("retrieve") ||
    name.includes("read") ||
    name.includes("load") ||
    name.includes("list") ||
    name.includes("show") ||
    name.includes("view") ||
    name.includes("display") ||
    name.includes("select") ||
    name.includes("filter") ||
    name.includes("sort") ||
    name.includes("paginate") ||
    name.includes("aggregate") ||
    name.includes("calculate") ||
    name.includes("compute") ||
    name.includes("analyze") ||
    name.includes("is") || // isAgentActiveInCompetition
    name.includes("has") ||
    name.includes("check") ||
    name.includes("exists") ||
    name.includes("validate") ||
    name.includes("verify") ||
    name.includes("confirm") ||
    name.includes("ensure") ||
    name.includes("test") ||
    name.includes("count") ||
    name.includes("sum") ||
    name.includes("avg") ||
    name.includes("average") ||
    name.includes("min") ||
    name.includes("max") ||
    name.includes("total") ||
    name.includes("bulk") || // getBulkAgentMetrics
    (name.includes("batch") &&
      !name.includes("create") &&
      !name.includes("insert") &&
      !name.includes("update")) // batch read operations
  ) {
    return "SELECT";
  }

  // Fallback to QUERY for any unrecognized patterns
  return "QUERY";
}

/**
 * Wraps a repository function with timing, preserving exact function signature
 */
function wrapRepositoryFunction<
  TFunc extends (...args: readonly unknown[]) => Promise<unknown>,
>(fn: TFunc, repositoryName: string, methodName: string): TFunc {
  return (async (
    ...args: Parameters<TFunc>
  ): Promise<Awaited<ReturnType<TFunc>>> => {
    const startTime = performance.now();
    const rawTraceId = getTraceId();

    // Handle trace ID fallbacks more gracefully
    const traceId = (() => {
      if (rawTraceId === "unknown") {
        return "background-task"; // Repository operations outside HTTP context
      }
      if (rawTraceId === "init") {
        return "app-init"; // Repository operations during app initialization
      }
      return rawTraceId || "no-trace"; // Should not happen but just in case
    })();

    const operation = getOperationFromMethod(methodName);

    try {
      const result = await fn(...args);

      const endTime = performance.now();
      const durationMs = endTime - startTime;

      // Get metrics (lazy loading)
      const { dbQueryDuration, dbQueryTotal } = getDbMetrics();

      // Update Prometheus metrics
      dbQueryDuration.observe(
        { operation, repository: repositoryName, method: methodName },
        durationMs,
      );
      dbQueryTotal.inc({
        operation,
        repository: repositoryName,
        method: methodName,
        status: "success",
      });

      // Environment-aware logging with sampling
      if (shouldSample(config.logging.repositorySampleRate)) {
        // Structured logs
        repositoryLogger.debug({
          traceId,
          repository: repositoryName,
          method: methodName,
          operation,
          duration: durationMs,
          status: "success",
        });
      }

      return result as Awaited<ReturnType<TFunc>>;
    } catch (error) {
      const endTime = performance.now();
      const durationMs = endTime - startTime;

      // Get metrics (lazy loading)
      const { dbQueryTotal } = getDbMetrics();

      // Update metrics for failed queries
      dbQueryTotal.inc({
        operation,
        repository: repositoryName,
        method: methodName,
        status: "error",
      });

      // Environment-aware error logging with timing and sampling
      if (shouldSample(config.logging.repositorySampleRate)) {
        // Production: Structured error logs
        repositoryLogger.error({
          traceId,
          repository: repositoryName,
          method: methodName,
          operation,
          duration: durationMs,
          status: "error",
        });
      }

      throw error;
    }
  }) as TFunc;
}

/**
 * Creates a timing wrapper for a specific repository function
 * @param fn The repository function to wrap
 * @param repositoryName The name of the repository
 * @param methodName The name of the method
 * @returns The wrapped function with timing
 */
export function createTimedRepositoryFunction<TFunc>(
  fn: TFunc,
  repositoryName: string,
  methodName: string,
): TFunc {
  return wrapRepositoryFunction(
    fn as unknown as (...args: readonly unknown[]) => Promise<unknown>,
    repositoryName,
    methodName,
  ) as unknown as TFunc;
}

/**
 * Manually wrap repository functions with timing
 * This approach gives you full type safety by explicitly wrapping each function
 *
 * Example usage:
 * ```typescript
 * // In your repository file
 * import { createTimedRepositoryFunction } from '@/lib/repository-timing';
 *
 * async function getUserById(id: string): Promise<User | null> {
 *   // your implementation
 * }
 *
 * async function createUser(userData: CreateUserData): Promise<User> {
 *   // your implementation
 * }
 *
 * // Export wrapped functions
 * export const timedGetUserById = createTimedRepositoryFunction(
 *   getUserById,
 *   'UserRepository',
 *   'getUserById'
 * );
 *
 * export const timedCreateUser = createTimedRepositoryFunction(
 *   createUser,
 *   'UserRepository',
 *   'createUser'
 * );
 * ```
 */
export { createTimedRepositoryFunction as wrapRepositoryFunction };

/**
 * Legacy: Simple object wrapper (less type-safe but convenient)
 * Only use this if you need to wrap many functions at once and are okay with less type safety
 */
export function wrapRepositoryObject(
  repositoryModule: Record<string, unknown>,
  repositoryName: string,
): Record<string, unknown> {
  const wrapped: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(repositoryModule)) {
    if (typeof value === "function") {
      // Wrap functions with timing
      wrapped[key] = wrapRepositoryFunction(
        value as (...args: readonly unknown[]) => Promise<unknown>,
        repositoryName,
        key,
      );
    } else {
      // Pass through non-functions (constants, etc.)
      wrapped[key] = value;
    }
  }

  return wrapped;
}
