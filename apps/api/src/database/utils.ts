import { db, dbRead } from "@/database/db.js";

/**
 * Database Utilities
 *
 * This file provides utilities and guidance for using the primary database
 * connection vs the read replica connection.
 */

/**
 * Primary database connection - use for all write operations and read operations
 * that require the most up-to-date data (e.g., immediately after a write).
 *
 * Use cases:
 * - INSERT, UPDATE, DELETE operations
 * - SELECT queries that need guaranteed consistency
 * - Transactions that mix reads and writes
 * - Read-after-write scenarios where consistency is critical
 */
export const dbWrite = db;

/**
 * Read replica database connection - use for read-only operations that can
 * tolerate slight replication lag (typically milliseconds to seconds).
 *
 * Use cases:
 * - Dashboard queries and analytics
 * - Leaderboard displays
 * - Search functionality
 * - Reporting and data exports
 * - Public API endpoints that serve cached-like data
 * - Background jobs that process historical data
 *
 * Benefits:
 * - Reduces load on primary database
 * - Improves overall system performance
 * - Better resource utilization
 */
export const dbReadReplica = dbRead;

/**
 * Helper function to determine if a query should use read replica
 *
 * @param queryType - The type of database operation
 * @param requiresConsistency - Whether the query requires immediate consistency
 * @returns The appropriate database connection to use
 */
export function getDbConnection(
  queryType: "read" | "write",
  requiresConsistency: boolean = false,
) {
  if (queryType === "write") {
    return dbWrite;
  }

  if (requiresConsistency) {
    return dbWrite;
  }

  return dbReadReplica;
}

/**
 * Type definitions for database operations
 */
export type DbOperation = {
  type: "read" | "write";
  requiresConsistency?: boolean;
  description?: string;
};

/**
 * Common database operation patterns with recommended connection usage
 */
export const DB_OPERATIONS = {
  // Write operations - always use primary
  CREATE_AGENT: { type: "write" as const, description: "Creating new agent" },
  UPDATE_AGENT: { type: "write" as const, description: "Updating agent data" },
  DELETE_AGENT: { type: "write" as const, description: "Deleting agent" },
  PLACE_TRADE: { type: "write" as const, description: "Placing new trade" },

  // Read operations that require consistency - use primary
  GET_AGENT_AFTER_CREATE: {
    type: "read" as const,
    requiresConsistency: true,
    description: "Reading agent data immediately after creation",
  },
  GET_BALANCE_FOR_TRADE: {
    type: "read" as const,
    requiresConsistency: true,
    description: "Reading balance before placing trade",
  },

  // Read operations that can use replica
  GET_LEADERBOARD: {
    type: "read" as const,
    requiresConsistency: false,
    description: "Fetching leaderboard data",
  },
  SEARCH_AGENTS: {
    type: "read" as const,
    requiresConsistency: false,
    description: "Searching agents",
  },
  GET_HISTORICAL_DATA: {
    type: "read" as const,
    requiresConsistency: false,
    description: "Fetching historical data",
  },
  GET_PUBLIC_STATS: {
    type: "read" as const,
    requiresConsistency: false,
    description: "Fetching public statistics",
  },
} as const;

/**
 * Example usage patterns:
 *
 * // For write operations:
 * const result = await dbWrite.insert(agents).values(data).returning();
 *
 * // For read operations that can use replica:
 * const leaderboard = await dbReadReplica.select().from(competitionsLeaderboard);
 *
 * // For read operations that need consistency:
 * const agent = await dbWrite.select().from(agents).where(eq(agents.id, agentId));
 *
 * // Using the helper function:
 * const connection = getDbConnection("read", false);
 * const results = await connection.select().from(agents);
 */
