import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { isPgSchema } from "drizzle-orm/pg-core";
import { reset } from "drizzle-seed";
import path from "path";
import { Pool } from "pg";
import { fileURLToPath } from "url";

import schema from "@recallnet/db/schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get database URL from environment
const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.VITE_DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/trading_simulator_test";

// Create database pool
const pool = new Pool({
  connectionString: databaseUrl,
  max: 10,
});

// Create database instance
export const db = drizzle({
  client: pool,
  schema,
});

export async function resetDb() {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      if (retryCount > 0) {
        const delay = Math.pow(2, retryCount) * 100;
        console.log(
          `Retrying database reset (attempt ${retryCount + 1}/${maxRetries}) after ${delay}ms delay...`,
        );
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
        console.warn(
          `Database deadlock detected on attempt ${retryCount}/${maxRetries}, retrying...`,
        );
        continue;
      }

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
  const MIGRATION_LOCK_ID = 77;
  const MAX_WAIT_TIME = "5min";

  try {
    await db.execute(sql.raw(`SET lock_timeout = '${MAX_WAIT_TIME}'`));

    console.log("Acquiring migration lock...");
    await db.execute(sql.raw(`SELECT pg_advisory_lock(${MIGRATION_LOCK_ID})`));

    try {
      console.log("Acquired migration lock, running migrations...");

      // Find the drizzle migrations folder - it's in apps/api/drizzle
      const migrationsFolder = path.resolve(process.cwd(), "apps/api/drizzle");

      await migrate(db, {
        migrationsFolder,
      });
      console.log("Migrations completed successfully");
    } finally {
      await db.execute(
        sql.raw(`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID})`),
      );
      console.log("Released migration lock");
    }
  } catch (error) {
    console.error("Error during migration lock process:", error);
    throw error;
  }
}

export async function closeDb(): Promise<void> {
  try {
    console.log("Closing database connections...");

    if (pool) {
      await pool.end();
      console.log("Database connection pool closed");
    }

    console.log("All database connections closed successfully");
  } catch (error) {
    console.error("Error closing database connections:", error);
    throw error;
  }
}
