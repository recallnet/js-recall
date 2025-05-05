import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";

import { DatabaseConnection } from "@/database/connection.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Migratethe database
 * Runs the Drizzle migrations to get the database up to date
 */
export async function migrateDb(): Promise<void> {
  // Get the database connection
  const conn = DatabaseConnection.getInstance();

  try {
    console.log("[Database] Checking database connection and schema...");

    await migrate(conn.db, {
      migrationsFolder: path.join(__dirname, "../drizzle"),
    });
  } catch (error) {
    // If there's a database connection error, we should log but not fail server startup
    console.error(
      "[Database] Error during database schema check/initialization:",
      error,
    );
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[Database] Continuing server startup despite database error in production mode",
      );
    } else {
      throw error; // In development, we want to fail fast
    }
  }
}

// Run if called directly
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  migrateDb()
    .then(() => {
      console.log("Database migration completed");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Database migration failed:", err);
      process.exit(1);
    });
}
