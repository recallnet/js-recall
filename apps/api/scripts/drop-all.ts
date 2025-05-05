import { sql } from "drizzle-orm";
import { isPgSchema } from "drizzle-orm/pg-core";
import { pathToFileURL } from "url";

import * as schema from "@recallnet/comps-db/schema";

import { config } from "@/config/index.js";
import { DatabaseConnection } from "@/database/connection.js";

/**
 * Script to drop everything in the public schema, drizzle schema, and any other schemas defined in the Drizzle schema object
 * This should be used with caution, as it will permanently delete all data
 *
 * @param confirmationRequired If true, will prompt for confirmation. If false, executes without prompt (for testing).
 * @returns Promise that resolves when all tables are dropped
 */
export async function dropAllTables(
  confirmationRequired: boolean = true,
): Promise<void> {
  try {
    if (confirmationRequired) {
      console.log(
        "\x1b[31m%s\x1b[0m",
        "⚠️  WARNING: This will DELETE everything in the public schema, drizzle schema, and any other schemas defined in the Drizzle schema object!",
      );
      console.log("\x1b[31m%s\x1b[0m", `Database: ${config.database.url}`);
      console.log("\x1b[31m%s\x1b[0m", "ALL DATA WILL BE PERMANENTLY LOST!");

      // Wait for confirmation
      await new Promise<void>((resolve) => {
        console.log("Type 'DROP ALL' to confirm:");
        process.stdin.once("data", (data) => {
          const input = data.toString().trim();
          if (input === "DROP ALL") {
            resolve();
          } else {
            console.log("Operation cancelled.");
            process.exit(0);
          }
        });
      });
    }

    console.log("Connecting to database...");
    const conn = DatabaseConnection.getInstance();

    const schemas = Object.values(schema)
      .filter(isPgSchema)
      .map((s) => {
        return isPgSchema(s) ? s.schemaName : "";
      });
    await conn.db.transaction(async (tx) => {
      if (schemas.length > 0) {
        await tx.execute(
          sql.raw(`drop schema if exists ${schemas.join(", ")} cascade`),
        );
      }
      await tx.execute(sql.raw(`drop schema if exists public cascade`));
      await tx.execute(sql.raw(`drop schema if exists drizzle cascade`));
      await tx.execute(sql.raw(`create schema public`));
    });

    console.log(
      "\x1b[32m%s\x1b[0m",
      "✅ Everything in the public schema, drizzle schema, and any other schemas defined in the Drizzle schema object have been successfully dropped!",
    );
    console.log(
      "You can now run 'npm run db:init' to re-initialize the database schema.",
    );

    if (confirmationRequired) {
      process.exit(0);
    }
  } catch (error) {
    console.error("Error dropping tables:", error);
    if (confirmationRequired) {
      process.exit(1);
    }
    throw error;
  }
}

// Run if called directly
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  dropAllTables().catch(console.error);
}
