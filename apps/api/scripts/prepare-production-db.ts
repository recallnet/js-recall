import { prepareProductionDatabase } from "@/scripts/baseline.js";

/**
 * Production Database Preparation Script
 *
 * This script is designed to prepare a production database by:
 * 1. Applying the baseline SQL file (legacy data/schema)
 * 2. Running all Drizzle migrations
 *
 * Usage:
 * - For new production deployments: pnpm db:prepare-production
 * - This script assumes a fresh database and will apply the baseline
 */

async function main() {
  try {
    console.log("🏭 Starting production database preparation...");

    // Apply the baseline SQL and run migrations
    await prepareProductionDatabase();

    console.log("✅ Production database preparation completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Production database preparation failed:", error);
    process.exit(1);
  }
}

// Execute if this script is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as prepareProductionDatabase };
