import { drizzle } from "drizzle-orm/node-postgres";
import path from "path";
import { Pool } from "pg";

import schema from "@recallnet/db/schema";
import {
  closeDb as closeDbUtil,
  dropAll as dropAllUtil,
  migrateDb as migrateDbUtil,
  resetDb as resetDbUtil,
} from "@recallnet/db/utils";

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
  return resetDbUtil(db);
}

export async function dropAll() {
  return dropAllUtil(db);
}

export async function migrateDb() {
  // Find the drizzle migrations folder - it's in apps/api/drizzle
  const workspaceRoot = process.cwd().includes("/apps/")
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
  const migrationsFolder = path.resolve(workspaceRoot, "apps/api/drizzle");

  console.log(
    `Looking for migrations in: ${migrationsFolder} (workspace root: ${workspaceRoot})`,
  );

  return migrateDbUtil(db, pool, migrationsFolder);
}

export async function closeDb(): Promise<void> {
  return closeDbUtil(pool);
}
