/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Drizzle Query Interceptor Base Class
 * @description Shared base class for intercepting Drizzle database queries
 * Provides common proxy wrapping logic used by both Sentry and Performance Profiler
 */

/**
 * Query metadata passed to interceptors
 */
export interface QueryMetadata {
  operation: string;
  tableName?: string;
}

/**
 * Abstract base class for intercepting and monitoring Drizzle database queries
 * Provides shared proxy logic for wrapping query builders and extracting metadata
 */
export abstract class DrizzleQueryInterceptor {
  /**
   * Wrap a Drizzle database instance with monitoring
   */
  public wrapDatabase<T extends object>(db: T): T {
    return new Proxy(db, {
      get: (target, prop, receiver) => {
        const original = Reflect.get(target, prop, receiver);

        // Handle direct db.execute() for raw SQL execution
        if (prop === "execute" && typeof original === "function") {
          return (...args: unknown[]) => {
            const metadata: QueryMetadata = {
              operation: "execute",
            };
            // Wrap and immediately return the execution result
            return this.handleExecution(
              original.bind(target),
              metadata,
            )(...args);
          };
        }

        // Check if this is a query builder method (select, insert, update, delete, with)
        if (typeof original === "function" && typeof prop === "string") {
          const queryBuilderMethods = [
            "select",
            "insert",
            "update",
            "delete",
            "with",
          ];

          if (queryBuilderMethods.includes(prop)) {
            return (...args: unknown[]) => {
              // For query builders, call the original to obtain the builder instance
              const queryBuilder = original.apply(target, args);

              // Extract table name for insert/update/delete operations
              let tableName: string | undefined;
              if (args.length > 0 && prop !== "select") {
                const table = args[0] as any;
                tableName = this.extractTableName(table);
              }

              // Wrap the query builder to intercept execution
              if (queryBuilder && typeof queryBuilder === "object") {
                return this.wrapQueryBuilder(queryBuilder, prop, tableName);
              }

              return queryBuilder;
            };
          }
        }

        return original;
      },
    }) as T;
  }

  /**
   * Wrap a query builder object to intercept method calls
   */
  protected wrapQueryBuilder<T extends Record<string, unknown>>(
    queryBuilder: T,
    operation: string,
    tableName?: string,
  ): T {
    return new Proxy(queryBuilder, {
      get: (target, prop, receiver) => {
        if (typeof prop !== "string") {
          return Reflect.get(target, prop, receiver);
        }

        const value = Reflect.get(target, prop, receiver);

        // Extract table name from 'from' method calls
        if (prop === "from" && typeof value === "function") {
          return (...args: unknown[]) => {
            const result = value.apply(target, args);
            if (args[0]) {
              const table = args[0] as any;
              const extractedTableName =
                this.extractTableName(table) || tableName;
              return this.wrapQueryBuilder(
                result,
                operation,
                extractedTableName,
              );
            }
            return this.wrapQueryBuilder(result, operation, tableName);
          };
        }

        // Check if this is the final execution method
        if (this.isExecutionMethod(prop, target)) {
          const boundMethod =
            typeof value === "function" ? value.bind(target) : value;
          return this.handleExecution(
            boundMethod as (...args: unknown[]) => unknown,
            {
              operation,
              tableName,
            },
          );
        }

        // For intermediate chainable methods, wrap the result recursively
        if (typeof value === "function" && this.isChainableMethod(prop)) {
          return (...args: unknown[]) => {
            const result = value.apply(target, args);
            // Continue wrapping if it returns another query builder
            if (
              result &&
              typeof result === "object" &&
              !Array.isArray(result) &&
              !Buffer.isBuffer(result)
            ) {
              return this.wrapQueryBuilder(result, operation, tableName);
            }
            return result;
          };
        }

        return value;
      },
    });
  }

  /**
   * Extract table name from a Drizzle table object
   */
  protected extractTableName(table: unknown): string | undefined {
    if (!table || typeof table !== "object") return undefined;
    const tableObj = table as any;
    // Try multiple ways to extract the table name
    return (
      tableObj[Symbol.for("drizzle:Name")] ||
      tableObj.name ||
      tableObj.config?.table?.name ||
      tableObj.table?.name
    );
  }

  /**
   * Check if a method is a query execution method
   */
  protected isExecutionMethod(methodName: string, target: unknown): boolean {
    // Check for 'then' which indicates a thenable/promise
    if (methodName === "then" && typeof (target as any).then === "function") {
      return true;
    }
    return ["execute", "then", "catch", "finally"].includes(methodName);
  }

  /**
   * Check if a method is chainable (returns another query builder)
   */
  protected isChainableMethod(methodName: string): boolean {
    return [
      "from",
      "where",
      "orderBy",
      "limit",
      "offset",
      "groupBy",
      "having",
      "leftJoin",
      "rightJoin",
      "innerJoin",
      "fullJoin",
      "join",
      "set",
      "values",
      "onConflictDoUpdate",
      "onConflictDoNothing",
      "onDuplicateKeyUpdate",
      "returning",
      "as",
    ].includes(methodName);
  }

  /**
   * Handle the actual query execution
   * Must be implemented by subclasses to add their specific monitoring logic
   */
  protected abstract handleExecution(
    originalMethod: (...args: unknown[]) => unknown,
    metadata: QueryMetadata,
  ): (...args: unknown[]) => unknown;
}
