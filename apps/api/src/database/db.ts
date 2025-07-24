import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { isPgSchema } from "drizzle-orm/pg-core";
import { reset, seed } from "drizzle-seed";
import fs from "fs";
import path from "path";
import { Pool } from "pg";
import client from "prom-client";
import { fileURLToPath } from "url";

import { config } from "@/config/index.js";
import schema from "@/database/schema/index.js";
import { getTraceId } from "@/lib/trace-context.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prometheus metrics for database operations - check if already registered
const getOrCreateDbMetrics = () => {
  // Try to get existing metric first
  const existingTotal = client.register.getSingleMetric(
    "db_queries_total",
  ) as client.Counter<string>;

  if (existingTotal) {
    return { dbQueryTotal: existingTotal };
  }

  // If metric doesn't exist, create it
  const dbQueryTotal = new client.Counter({
    name: "db_queries_total",
    help: "Total number of database queries",
    labelNames: ["operation", "status"],
  });

  return { dbQueryTotal };
};

const { dbQueryTotal } = getOrCreateDbMetrics();

/**
 * DEPRECATED: logDbOperation is no longer needed since we have transparent logging
 * All database queries are now automatically logged via the drizzle logger
 */

const sslConfig = (() => {
  // If SSL is disabled in config, don't use SSL
  if (!config.database.ssl) {
    return { ssl: undefined };
  }

  // If a certificate is provided as an environment variable, use it
  const certBase64 = process.env.DB_CA_CERT_BASE64; // Suitable for Vercel deployments
  if (certBase64) {
    return {
      ssl: {
        ca: Buffer.from(certBase64, "base64").toString(),
        rejectUnauthorized: true,
      },
    };
  }

  // If a custom CA certificate path is provided, use it
  // This allows using self-signed certs while maintaining validation
  const caPath = process.env.DB_CA_CERT_PATH;
  if (caPath && fs.existsSync(caPath)) {
    return {
      ssl: {
        ca: fs.readFileSync(caPath).toString(),
        rejectUnauthorized: true,
      },
    };
  }

  // Default secure SSL configuration (for all environments)
  return { ssl: true };
})();

// Check if a connection URL is provided
// Use connection URL which includes all connection parameters
const pool = new Pool({
  connectionString: config.database.url,
  ...sslConfig,
});

// Read replica connection pool
const readReplicaPool = new Pool({
  connectionString: config.database.readReplicaUrl || config.database.url,
  ...sslConfig,
});

/*
 * DATABASE QUERY TIMING ALTERNATIVES:
 *
 * Pool.query() has 7 complex overloads making wrapping difficult.
 * For database query timing, consider these approaches:
 *
 * 1. SERVICE-LAYER TIMING (Recommended):
 *    - Wrap database calls in manager services with performance.now()
 *    - Example: const start = performance.now(); const result = await db.select();
 *    - Gives end-to-end timing including Drizzle overhead
 *
 * 2. POSTGRESQL CONFIGURATION:
 *    - Enable: log_statement = 'all' and log_duration = on
 *    - Add: log_min_duration_statement = 100 (log queries > 100ms)
 *    - Location: postgresql.conf or via ALTER SYSTEM
 *
 * 3. PG_STAT_STATEMENTS EXTENSION:
 *    - CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
 *    - Query pg_stat_statements view for aggregated timing data
 *
 * 4. APM/MONITORING TOOLS:
 *    - DataDog, New Relic, Grafana, or Sentry Performance
 *    - Database connection monitoring and query analysis
 */

// Create custom logger to transparently intercept ALL database queries
const dbLogger = {
  logQuery: (query: string, params: unknown[]) => {
    void params; // Acknowledge parameter exists but we don't use it
    const rawTraceId = getTraceId();

    // Handle trace ID fallbacks more gracefully
    const traceId = (() => {
      if (rawTraceId === "unknown") {
        return "background-task"; // Database operations outside HTTP context
      }
      if (rawTraceId === "init") {
        return "app-init"; // Database operations during app initialization
      }
      return rawTraceId || "no-trace"; // Should not happen but just in case
    })();

    // Extract operation type from SQL query with improved parsing
    const operation = (() => {
      if (!query || typeof query !== "string") {
        return "EMPTY_QUERY";
      }

      const trimmed = query.trim();
      if (!trimmed) {
        return "EMPTY_QUERY";
      }

      // Extract first word and normalize
      const firstWord = trimmed.split(/\s+/)[0]?.toUpperCase();

      if (!firstWord) {
        return "MALFORMED_QUERY";
      }

      // Handle common SQL operations
      const knownOperations = [
        "SELECT",
        "INSERT",
        "UPDATE",
        "DELETE",
        "CREATE",
        "DROP",
        "ALTER",
        "TRUNCATE",
        "REPLACE",
        "MERGE",
        "WITH",
        "SHOW",
        "EXPLAIN",
        "BEGIN",
        "COMMIT",
        "ROLLBACK",
        "START", // Transaction commands
      ];

      if (knownOperations.includes(firstWord)) {
        return firstWord;
      }

      // Handle compound statements that might start with parentheses or WITH
      if (trimmed.startsWith("(")) {
        // Look for the actual SQL operation inside parentheses
        const innerMatch = trimmed.match(
          /^\(\s*(SELECT|INSERT|UPDATE|DELETE|WITH)/i,
        );
        if (innerMatch && innerMatch[1]) {
          return innerMatch[1].toUpperCase();
        }
        return "SELECT"; // Default for parentheses-wrapped queries
      }

      if (trimmed.startsWith("WITH") || trimmed.includes("WITH RECURSIVE")) {
        return "WITH"; // CTE
      }

      // If it's not a recognized operation, return the first word for debugging
      return `UNRECOGNIZED_${firstWord}`;
    })();

    // Note: Drizzle's logger interface is called AFTER query execution,
    // so we cannot accurately measure query timing here. The timing would
    // be near-zero since no actual database operation happens in this function.
    // For accurate query timing, consider using database-level monitoring
    // or application-level timing at the service layer.

    // Update Prometheus metrics (count only, no timing)
    dbQueryTotal.inc({ operation, status: "success" });

    // Environment-aware logging (without timing)
    const isDev = config.server.nodeEnv === "development";
    if (isDev) {
      // In development, show a more detailed console log
      console.log(
        `[${traceId}] [DB] ${operation} - ${query.substring(0, 100)}${query.length > 100 ? "..." : ""}`,
      );
    } else {
      // In production, always include query preview for debugging classification issues
      console.log(
        JSON.stringify({
          traceId,
          type: "db",
          operation,
          status: "success",
          timestamp: new Date().toISOString(),
          queryPreview: query.substring(0, 100),
          ...(query.length > 100 ? { queryTruncated: true } : {}),
        }),
      );
    }
  },
};

// Create and export the database instance with transparent logging
export const db = drizzle({
  client: pool,
  schema,
  logger: dbLogger,
});

// Create and export the read replica database instance
export const dbRead = drizzle({
  client: readReplicaPool,
  schema,
  logger: dbLogger,
});

// NOTE: logDbOperation export removed - all queries now automatically logged

console.log(
  "[DatabaseConnection] Connected to PostgreSQL using connection URL",
);

console.log(
  "[DatabaseConnection] Read replica connection configured:",
  config.database.readReplicaUrl !== config.database.url
    ? "separate replica"
    : "same as primary",
);

db.$client.on("error", (err: Error) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

dbRead.$client.on("error", (err: Error) => {
  console.error("Unexpected error on read replica client", err);
  process.exit(-1);
});

export async function resetDb() {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      // Wait a bit before each attempt to let any pending transactions complete
      if (retryCount > 0) {
        const delay = Math.pow(2, retryCount) * 100; // Exponential backoff: 200ms, 400ms, 800ms
        console.log(
          `Retrying database reset (attempt ${retryCount + 1}/${maxRetries}) after ${delay}ms delay...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      await reset(db, schema);
      return; // Success, exit the retry loop
    } catch (error: unknown) {
      retryCount++;

      // Check if it's a deadlock error
      const errorMessage = error instanceof Error ? error.message : "";
      const errorCode =
        error && typeof error === "object" && "code" in error ? error.code : "";
      const isDeadlock =
        errorMessage.includes("deadlock") ||
        errorCode === "40P01" ||
        errorCode === "40001";

      if (isDeadlock && retryCount < maxRetries) {
        console.warn(
          `Database deadlock detected on attempt ${retryCount}/${maxRetries}, retrying...`,
        );
        continue;
      }

      // If it's not a deadlock or we've exhausted retries, throw the error
      console.error(
        `Database reset failed after ${retryCount} attempts:`,
        error,
      );
      throw error;
    }
  }
}

export async function dropAll() {
  const schemas = Object.values(schema)
    .filter(isPgSchema)
    .map((s) => {
      return isPgSchema(s) ? s.schemaName : "";
    });
  await db.transaction(async (tx) => {
    if (schemas.length > 0) {
      await tx.execute(
        sql.raw(`drop schema if exists ${schemas.join(", ")} cascade`),
      );
    }
    await tx.execute(sql.raw(`drop schema if exists public cascade`));
    await tx.execute(sql.raw(`drop schema if exists drizzle cascade`));
    await tx.execute(sql.raw(`create schema public`));
  });
}

export async function migrateDb() {
  // Run normal Drizzle migrations
  await migrate(db, {
    migrationsFolder: path.join(__dirname, "../../drizzle"),
  });
}

export async function seedDb() {
  await seed(db, schema);
}
