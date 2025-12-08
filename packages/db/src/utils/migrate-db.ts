import { sql } from "drizzle-orm";
import { NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import schema from "../schema/index.js";

/**
 * Run database migrations with distributed lock coordination
 *
 * @param db - Database instance
 * @param pool - PostgreSQL connection pool
 * @param migrationsFolder - Path to migrations folder
 * @param logger - Optional logger for info/error messages
 */
export async function migrateDb(
  db: NodePgDatabase<typeof schema>,
  pool: Pool,
  migrationsFolder: string,
  logger?: {
    info?: (message: string | object) => void;
    error?: (message: string, error?: unknown) => void;
  },
): Promise<void> {
  const MIGRATION_LOCK_ID = 77;
  const MAX_WAIT_TIME = "5min";

  try {
    await db.execute(sql.raw(`SET lock_timeout = '${MAX_WAIT_TIME}'`));

    const message = "Acquiring migration lock...";
    if (logger?.info) {
      logger.info(message);
    } else {
      console.log(message);
    }
    await db.execute(sql.raw(`SELECT pg_advisory_lock(${MIGRATION_LOCK_ID})`));

    try {
      const acquiredMessage = "Acquired migration lock, running migrations...";
      if (logger?.info) {
        logger.info(acquiredMessage);
      } else {
        console.log(acquiredMessage);
      }

      // Create a database instance with optional logging for migrations
      const migrationDb = drizzle({
        client: pool,
        schema,
        ...(logger?.info && {
          logger: {
            logQuery: (query: string) => {
              logger.info?.({
                type: "migration",
                query: query.substring(0, 200),
                ...(query.length > 200 ? { queryTruncated: true } : {}),
              });
            },
          },
        }),
      });

      await migrate(migrationDb, {
        migrationsFolder,
      });

      const successMessage = "Migrations completed successfully";
      if (logger?.info) {
        logger.info(successMessage);
      } else {
        console.log(successMessage);
      }
    } finally {
      await db.execute(
        sql.raw(`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID})`),
      );
      const releasedMessage = "Released migration lock";
      if (logger?.info) {
        logger.info(releasedMessage);
      } else {
        console.log(releasedMessage);
      }
    }
  } catch (error) {
    const errorMsg = "Error during migration lock process:";
    if (logger?.error) {
      logger.error(errorMsg, error);
    } else {
      console.error(errorMsg, error);
    }
    throw error;
  }
}
