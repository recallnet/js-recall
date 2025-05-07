import dotenv from "dotenv";
import path from "path";
import * as readline from "readline/promises";
import { pathToFileURL } from "url";

import { config } from "@/config/index.js";
import { resetDb } from "@/database/db.js";

// Ensure environment is loaded
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

/**
 * Database Cleanup Script for Development
 * WARNING: This script will delete all data in your tables. Use only in development.
 */

const createInterface = () => {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
};

// Colors for console output
const colors = {
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  reset: "\x1b[0m",
};

const cleanDatabase = async (confirmationRequired: boolean = true) => {
  // Check if we're in development mode
  const nodeEnv = process.env.NODE_ENV || "development";
  if (nodeEnv !== "development" && nodeEnv !== "test") {
    console.error(
      `${colors.red}ERROR: This script can only be run in development or test mode.${colors.reset}`,
    );
    console.error(`Current NODE_ENV: ${nodeEnv}`);
    console.error(`Set NODE_ENV=development to run this script.`);
    process.exit(1);
  }

  console.log(
    `${colors.yellow}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
  );
  console.log(
    `${colors.yellow}║                   DATABASE CLEANUP SCRIPT                      ║${colors.reset}`,
  );
  console.log(
    `${colors.yellow}╠════════════════════════════════════════════════════════════════╣${colors.reset}`,
  );
  console.log(
    `${colors.yellow}║ WARNING: This will DELETE ALL DATA from your database tables:  ║${colors.reset}`,
  );
  console.log(
    `${colors.yellow}║ - URL: ${config.database.url}                               ${colors.reset}`,
  );
  console.log(
    `${colors.yellow}║                                                                ║${colors.reset}`,
  );
  console.log(
    `${colors.yellow}║ ALL TABLE DATA WILL BE PERMANENTLY LOST!                       ║${colors.reset}`,
  );
  console.log(
    `${colors.yellow}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
  );

  if (confirmationRequired) {
    const rl = createInterface();

    const answer = await rl.question(
      `${colors.red}Type "DELETE" to confirm: ${colors.reset}`,
    );

    rl.close();

    if (answer.trim() !== "DELETE") {
      console.log("Operation cancelled.");
      return;
    }
  }

  console.log(`\nResetting all tables: ${config.database.url}...`);

  await resetDb();

  console.log(
    `\n${colors.green}✓ All table data has been successfully deleted${colors.reset}`,
  );

  console.log(
    `\n${colors.green}✓ Database cleanup completed successfully!${colors.reset}`,
  );
  console.log(
    `\nYou can now run 'pnpm db:migrate' to re-initialize the schema and seed data.`,
  );
};

// Run the script if called directly
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  cleanDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("Database cleanup failed:", err);
      process.exit(1);
    });
}

export { cleanDatabase };
