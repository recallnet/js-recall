import { drizzle } from "drizzle-orm/node-postgres";
import { seed } from "drizzle-seed";
import fs from "fs";
import path from "path";
import { Pool } from "pg";
import client from "prom-client";
import { fileURLToPath } from "url";

import schema from "@recallnet/db/schema";
import {
  closeDb as closeDbUtil,
  dropAll as dropAllUtil,
  migrateDb as migrateDbUtil,
  resetDb as resetDbUtil,
} from "@recallnet/db/utils";

import { config } from "@/config/index.js";
import { wrapDatabaseWithSentry } from "@/database/sentry-wrapper.js";
import { dbLogger as pinoDbLogger } from "@/lib/logger.js";
import { getTraceId } from "@/lib/trace-context.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Drizzle `db` or transaction type.
 */
export type DbTransaction = typeof db.transaction extends (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- this is fine, we don't care about that type
  callback: (tx: infer T) => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- this is fine, we don't care about that type
) => any
  ? T
  : never;

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
  max: config.database.maxConnections,
});

// Read replica connection pool
const readReplicaPool = new Pool({
  connectionString: config.database.readReplicaUrl || config.database.url,
  ...sslConfig,
  max: config.database.maxConnections,
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
        "SET", // for lock_timeout
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
        "SAVEPOINT", // Nested transaction savepoint
        "RELEASE", // Release savepoint
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

    pinoDbLogger.debug({
      traceId,
      type: "db",
      operation,
      status: "success",
      queryPreview: query.substring(0, 100),
      ...(query.length > 100 ? { queryTruncated: true } : {}),
    });
  },
};

// Create database instances with transparent logging
const baseDb = drizzle({
  client: pool,
  schema,
  logger: dbLogger,
});

const baseDbRead = drizzle({
  client: readReplicaPool,
  schema,
  logger: dbLogger,
});

// Wrap with Sentry monitoring if enabled
export const db = wrapDatabaseWithSentry(baseDb);
export const dbRead = wrapDatabaseWithSentry(baseDbRead);

// NOTE: logDbOperation export removed - all queries now automatically logged

pinoDbLogger.info("Connected to PostgreSQL using connection URL");

pinoDbLogger.info(
  `Read replica connection configured: ${
    config.database.readReplicaUrl !== config.database.url
      ? "separate replica"
      : "same as primary"
  }`,
);

// Access the underlying client through the base instance
baseDb.$client.on("error", (err: Error) => {
  pinoDbLogger.error({ error: err }, "Unexpected error on idle client");
  process.exit(-1);
});

baseDbRead.$client.on("error", (err: Error) => {
  console.error("Unexpected error on read replica client", err);
  process.exit(-1);
});

export async function resetDb() {
  return resetDbUtil(db, pinoDbLogger);
}

export async function dropAll() {
  return dropAllUtil(db);
}

/**
 * Run database migrations with distributed lock coordination
 * Uses PostgreSQL advisory locks to ensure only one instance runs migrations
 */
export async function migrateDb() {
  return migrateDbUtil(
    db,
    pool,
    path.join(__dirname, "../../drizzle"),
    pinoDbLogger,
  );
}

export async function seedDb() {
  await seed(db, schema);
}

/**
 * Close all database connections
 * This should be called during application shutdown to prevent connection leaks
 */
export async function closeDb(): Promise<void> {
  return closeDbUtil(pool, readReplicaPool, pinoDbLogger);
}
