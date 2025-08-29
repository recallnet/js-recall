/**
 * @file Sentry Database Wrapper
 * @description Extends DrizzleQueryInterceptor to add Sentry APM monitoring
 *
 * Uses the shared DrizzleQueryInterceptor base class for consistent proxy wrapping
 * logic across both Sentry monitoring and performance profiling.
 */
import * as Sentry from "@sentry/node";

import { config } from "@/config/index.js";
import {
  DrizzleQueryInterceptor,
  type QueryMetadata,
} from "@/lib/performance/drizzle-query-interceptor.js";

/**
 * Sentry wrapper for Drizzle database operations
 * Adds performance monitoring spans for database queries
 */
class SentryDatabaseWrapper extends DrizzleQueryInterceptor {
  /**
   * Handle query execution by wrapping it in a Sentry span
   */
  protected handleExecution(
    originalMethod: (...args: unknown[]) => unknown,
    metadata: QueryMetadata,
  ): (...args: unknown[]) => unknown {
    // For execute method, wrap the function call directly
    if (metadata.operation === "execute") {
      return (...args: unknown[]) => {
        return Sentry.startSpan(
          {
            name: "db.execute",
            op: "db.query",
            attributes: {
              "db.system": "postgresql",
              "db.operation": "EXECUTE",
            },
          },
          () => originalMethod(...args),
        );
      };
    }

    // For query builders, wrap the 'then' method
    /* eslint-disable @typescript-eslint/no-explicit-any */
    return function (this: any, onFulfilled?: any, onRejected?: any) {
      const spanName = metadata.tableName
        ? `db.${metadata.operation}.${metadata.tableName}`
        : `db.${metadata.operation}`;

      return Sentry.startSpan(
        {
          name: spanName,
          op: "db.query",
          attributes: {
            "db.system": "postgresql",
            "db.operation": metadata.operation.toUpperCase(),
            ...(metadata.tableName && { "db.table": metadata.tableName }),
          },
        },
        async () => {
          return originalMethod.call(this, onFulfilled, onRejected);
        },
      );
    };
  }
}

/**
 * Wraps a Drizzle database instance with Sentry performance monitoring
 *
 * This wrapper intercepts database queries and creates Sentry spans
 * to track query performance in production.
 */
export function wrapDatabaseWithSentry<T extends object>(db: T): T {
  // Only wrap if Sentry DB monitoring is enabled in config
  if (!config.sentry?.dbMonitoringEnabled) {
    return db;
  }

  const wrapper = new SentryDatabaseWrapper();
  return wrapper.wrapDatabase(db);
}
