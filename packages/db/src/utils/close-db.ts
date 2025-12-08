import { Pool } from "pg";

/**
 * Close database connection pools
 *
 * @param pool - Primary database connection pool
 * @param readReplicaPool - Optional read replica pool
 * @param logger - Optional logger for info/error messages
 */
export async function closeDb(
  pool: Pool,
  readReplicaPool?: Pool,
  logger?: {
    info?: (message: string) => void;
    error?: (message: string, error?: unknown) => void;
  },
): Promise<void> {
  try {
    const message = "Closing database connections...";
    if (logger?.info) {
      logger.info(message);
    } else {
      console.log(message);
    }

    if (pool) {
      await pool.end();
      const poolMessage = readReplicaPool
        ? "Main database connection pool closed"
        : "Database connection pool closed";
      if (logger?.info) {
        logger.info(poolMessage);
      } else {
        console.log(poolMessage);
      }
    }

    if (readReplicaPool && readReplicaPool !== pool) {
      await readReplicaPool.end();
      const replicaMessage = "Read replica connection pool closed";
      if (logger?.info) {
        logger.info(replicaMessage);
      } else {
        console.log(replicaMessage);
      }
    }

    const successMessage = "All database connections closed successfully";
    if (logger?.info) {
      logger.info(successMessage);
    } else {
      console.log(successMessage);
    }
  } catch (error) {
    const errorMsg = "Error closing database connections:";
    if (logger?.error) {
      logger.error(errorMsg, error);
    } else {
      console.error(errorMsg, error);
    }
    throw error;
  }
}
