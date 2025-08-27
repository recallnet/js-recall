/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Sentry from "@sentry/node";

import { config } from "@/config/index.js";

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

  // Create a proxy that intercepts all property access
  return new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      // Special handling for core database methods
      if (
        prop === "select" ||
        prop === "insert" ||
        prop === "update" ||
        prop === "delete"
      ) {
        return wrapQueryBuilder(value, prop as string);
      }

      // Special handling for the execute method
      if (prop === "execute") {
        return wrapExecute(value);
      }

      // Return the original value for everything else
      return value;
    },
  }) as T;
}

/**
 * Wraps query builder methods (select, insert, update, delete)
 */
function wrapQueryBuilder(originalMethod: any, operation: string) {
  return new Proxy(originalMethod, {
    apply(target, thisArg, args) {
      const result = Reflect.apply(target, thisArg, args);

      // The result is typically a query builder, wrap its execution
      return wrapQueryExecution(result, operation);
    },
  });
}

/**
 * Wraps the execute method for raw SQL queries
 */
function wrapExecute(originalMethod: any) {
  return new Proxy(originalMethod, {
    apply(target, thisArg, args) {
      return Sentry.startSpan(
        {
          name: "db.execute",
          op: "db.query",
          attributes: {
            "db.system": "postgresql",
            "db.operation": "EXECUTE",
          },
        },
        () => Reflect.apply(target, thisArg, args),
      );
    },
  });
}

/**
 * Wraps query execution to create Sentry spans
 */
function wrapQueryExecution(queryBuilder: any, operation: string): any {
  // Extract table name if available
  const tableName =
    queryBuilder?.config?.table?.name || queryBuilder?.table?.name || "unknown";

  return new Proxy(queryBuilder, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      // Intercept the then method (which triggers execution)
      if (prop === "then") {
        return function (onFulfilled?: any, onRejected?: any) {
          const spanName =
            tableName !== "unknown"
              ? `db.${operation}.${tableName}`
              : `db.${operation}`;

          return Sentry.startSpan(
            {
              name: spanName,
              op: "db.query",
              attributes: {
                "db.system": "postgresql",
                "db.operation": operation.toUpperCase(),
                "db.table": tableName,
              },
            },
            async () => {
              return value.call(target, onFulfilled, onRejected);
            },
          );
        };
      }

      // For chained methods, continue wrapping
      if (typeof value === "function") {
        return new Proxy(value, {
          apply(fn, thisArg, args) {
            const result = Reflect.apply(fn, thisArg, args);
            // Continue wrapping if the result is still a query builder
            if (result && typeof result === "object" && "then" in result) {
              return wrapQueryExecution(result, operation);
            }
            return result;
          },
        });
      }

      return value;
    },
  });
}
