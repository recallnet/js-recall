import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { reset } from "drizzle-seed";

import schema from "../schema/index.js";

/**
 * Reset database by clearing all data and reseeding
 *
 * @param db - Database instance to reset
 * @param logger - Optional logger for info/warn messages
 */
export async function resetDb(
  db: NodePgDatabase<typeof schema>,
  logger?: {
    info?: (message: string) => void;
    warn?: (message: string) => void;
    error?: (message: string, error?: unknown) => void;
  },
): Promise<void> {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      if (retryCount > 0) {
        const delay = Math.pow(2, retryCount) * 100;
        const message = `Retrying database reset (attempt ${retryCount + 1}/${maxRetries}) after ${delay}ms delay...`;
        if (logger?.info) {
          logger.info(message);
        } else {
          console.log(message);
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      await reset(db, schema);
      return;
    } catch (error: unknown) {
      retryCount++;

      const errorMessage = error instanceof Error ? error.message : "";
      const errorCode =
        error && typeof error === "object" && "code" in error ? error.code : "";
      const isDeadlock =
        errorMessage.includes("deadlock") ||
        errorCode === "40P01" ||
        errorCode === "40001";

      if (isDeadlock && retryCount < maxRetries) {
        const message = `Database deadlock detected on attempt ${retryCount}/${maxRetries}, retrying...`;
        if (logger?.warn) {
          logger.warn(message);
        } else {
          console.warn(message);
        }
        continue;
      }

      const errorMsg = `Database reset failed after ${retryCount} attempts:`;
      if (logger?.error) {
        logger.error(errorMsg, error);
      } else {
        console.error(errorMsg, error);
      }
      throw error;
    }
  }
}
