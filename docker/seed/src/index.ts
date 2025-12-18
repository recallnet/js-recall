/**
 * Main database seeding orchestrator for local development.
 *
 * This script seeds the database with:
 * - Users (mapped to Anvil wallets)
 * - Agents (owned by users)
 * - Arenas (competition categories)
 * - Competitions (with various statuses)
 * - Agent enrollments (some enrolled, some left for manual testing)
 *
 * Environment Variables:
 * - DATABASE_URL: PostgreSQL connection string
 * - AUTH_MODE: "mock" or "privy" (default: "mock")
 * - SKIP_WAIT: Skip waiting for database (default: false)
 */

import { createDbPool, createDb, waitFor, log } from "./utils.js";
import { seedUsers, getSeededUserIds } from "./users.js";
import { seedAgents } from "./agents.js";
import { seedArenas, seedCompetitions, enrollAgentsInCompetitions } from "./competitions.js";

/**
 * Check if database is ready
 */
async function checkDatabaseReady(connectionString: string): Promise<boolean> {
  const pool = createDbPool(connectionString);
  try {
    await pool.query("SELECT 1");
    await pool.end();
    return true;
  } catch {
    return false;
  }
}

/**
 * Main seeding function
 */
async function main() {
  const startTime = Date.now();

  log("=".repeat(60));
  log("Database Seeding Service");
  log("=".repeat(60));

  // Get configuration
  const DATABASE_URL = process.env.DATABASE_URL;
  const AUTH_MODE = (process.env.AUTH_MODE || "mock") as "mock" | "privy";
  const SKIP_WAIT = process.env.SKIP_WAIT === "true";

  if (!DATABASE_URL) {
    log("ERROR: DATABASE_URL environment variable is required", "error");
    process.exit(1);
  }

  log(`Configuration:`);
  log(`  DATABASE_URL: ${DATABASE_URL.replace(/:[^:@]+@/, ":***@")}`);
  log(`  AUTH_MODE: ${AUTH_MODE}`);
  log(`  SKIP_WAIT: ${SKIP_WAIT}`);
  log("");

  // Wait for database to be ready
  if (!SKIP_WAIT) {
    log("Waiting for database to be ready...");
    try {
      await waitFor(() => checkDatabaseReady(DATABASE_URL), {
        timeout: 120000,
        interval: 2000,
        description: "database connection",
      });
      log("Database is ready", "success");
    } catch (error) {
      log(`Database connection timeout: ${error}`, "error");
      process.exit(1);
    }
  }

  // Create database connection
  const pool = createDbPool(DATABASE_URL);
  const db = createDb(pool);

  try {
    log("");
    log("=".repeat(60));
    log("Starting database seeding...");
    log("=".repeat(60));
    log("");

    // Step 1: Seed arenas
    const arenaIdMap = await seedArenas(db);
    log("");

    // Step 2: Seed users (from Anvil wallets)
    await seedUsers(db, AUTH_MODE);
    const userIds = await getSeededUserIds(db);
    log("");

    // Step 3: Seed agents (owned by users)
    const agentIds = await seedAgents(db, userIds);
    log("");

    // Step 4: Seed competitions (references arenas)
    const competitionIds = await seedCompetitions(db, arenaIdMap);
    log("");

    // Step 5: Enroll some agents in competitions
    await enrollAgentsInCompetitions(db, agentIds, competitionIds);
    log("");

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log("=".repeat(60));
    log("Seeding complete!", "success");
    log("=".repeat(60));
    log(`Summary:`);
    log(`  Arenas: ${arenaIdMap.size}`);
    log(`  Users: ${userIds.length}`);
    log(`  Agents: ${agentIds.length}`);
    log(`  Competitions: ${competitionIds.length}`);
    log(`  Duration: ${duration}s`);
    log("");
    log("Next steps:");
    log("  1. API should be accessible at http://localhost:3000");
    log("  2. Frontend should be accessible at http://localhost:3001");
    log("  3. Check logs for agent API keys");
    if (AUTH_MODE === "mock") {
      log("  4. Use mock auth mode - any Anvil wallet address will work");
    } else {
      log("  4. Configure Privy with the seeded user wallet addresses");
    }
    log("");
  } catch (error) {
    log(`Seeding failed: ${error}`, "error");
    if (error instanceof Error) {
      log(error.stack || "", "error");
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
