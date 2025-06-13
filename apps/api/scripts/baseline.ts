import { spawn } from "child_process";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

import { config } from "../src/config/index.js";
import { db, migrateDb } from "../src/database/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Baseline Database Setup
 *
 * This module handles the application of a baseline SQL file that represents
 * the legacy state of the database before incremental migrations are applied.
 *
 * The baseline is applied only if:
 * 1. The database is empty (no Drizzle migration history)
 * 2. The baseline hasn't been applied yet (tracked via a custom marker)
 */

/**
 * Path to the baseline SQL file
 * Place your legacy SQL file here
 */
const rootDir = path.resolve(__dirname, "..");
const BASELINE_SQL_PATH = path.join(rootDir, "baseline", "baseline.sql");

/**
 * Table name used to track baseline application
 * This prevents re-applying the baseline multiple times
 */
const BASELINE_MARKER_TABLE = "__baseline_applied__";

/**
 * Check if the baseline has already been applied
 */
export async function isBaselineApplied(): Promise<boolean> {
  try {
    const result = await db.execute(
      sql.raw(`SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '${BASELINE_MARKER_TABLE}'
      )`),
    );

    const exists = result.rows[0]?.exists as boolean;
    return exists;
  } catch (error) {
    console.error("[Baseline] Error checking baseline status:", error);
    return false;
  }
}

/**
 * Check if this is a fresh database (no migrations applied)
 */
export async function isFreshDatabase(): Promise<boolean> {
  try {
    // Check if Drizzle migrations table exists
    const result = await db.execute(
      sql.raw(`SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'drizzle' 
        AND table_name = '__drizzle_migrations'
      )`),
    );

    const drizzleTableExists = result.rows[0]?.exists as boolean;

    if (!drizzleTableExists) {
      return true;
    }

    // Check if any migrations have been applied
    const migrationCount = await db.execute(
      sql.raw(`SELECT COUNT(*) as count FROM drizzle.__drizzle_migrations`),
    );

    const count = migrationCount.rows[0]?.count as string;
    return parseInt(count) === 0;
  } catch (error) {
    // If we can't check, assume it's fresh (safer for first-time setups)
    console.warn(
      "[Baseline] Could not determine database state, assuming fresh:",
      error,
    );
    return true;
  }
}

/**
 * Execute SQL file using psql command
 * This handles COPY commands and other PostgreSQL-specific features properly
 */
async function executeSQLFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Extract connection details from config
    const connectionUrl = config.database.url;

    const psqlProcess = spawn(
      "psql",
      [connectionUrl, "-f", filePath, "-v", "ON_ERROR_STOP=1"],
      {
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    let elapsed = 0;
    const interval = 5000; // 5 seconds
    const progressTimer = setInterval(() => {
      elapsed += interval / 1000;
      process.stdout.write(
        `[Baseline] ... still processing baseline SQL (${elapsed}s elapsed)\r`,
      );
    }, interval);

    psqlProcess.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    psqlProcess.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    psqlProcess.on("close", (code) => {
      clearInterval(progressTimer);
      process.stdout.write("\n"); // Clean up the progress line
      if (code === 0) {
        console.log("[Baseline] psql output:", stdout);
        resolve();
      } else {
        console.error("[Baseline] psql stderr:", stderr);
        reject(new Error(`psql exited with code ${code}: ${stderr}`));
      }
    });

    psqlProcess.on("error", (error) => {
      clearInterval(progressTimer);
      reject(new Error(`Failed to start psql: ${error.message}`));
    });
  });
}

/**
 * Apply the baseline SQL file
 */
export async function applyBaseline(): Promise<void> {
  if (!fs.existsSync(BASELINE_SQL_PATH)) {
    throw new Error(`Baseline SQL file not found at: ${BASELINE_SQL_PATH}`);
  }

  // Get file size for logging
  const stats = fs.statSync(BASELINE_SQL_PATH);
  const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(
    `[Baseline] Executing baseline SQL file (${fileSizeMB}MB) via psql...`,
  );

  try {
    // Execute the SQL file using psql (handles COPY commands properly)
    await executeSQLFile(BASELINE_SQL_PATH);

    // Create marker table to track that baseline has been applied
    await db.execute(
      sql.raw(`CREATE TABLE ${BASELINE_MARKER_TABLE} (
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        version VARCHAR(50) DEFAULT 'baseline-v1' NOT NULL
      )`),
    );

    // Insert a record to mark baseline as applied
    await db.execute(
      sql.raw(
        `INSERT INTO ${BASELINE_MARKER_TABLE} (applied_at, version) VALUES (NOW(), 'baseline-v1')`,
      ),
    );

    console.log("[Baseline] ✅ Baseline SQL applied successfully");
  } catch (error) {
    console.error("[Baseline] ❌ Error applying baseline SQL:", error);
    throw error;
  }
}

/**
 * Apply baseline if needed
 *
 * This function checks if the baseline should be applied and applies it if necessary.
 * It's safe to call multiple times - it won't re-apply the baseline.
 *
 * @param force - Force application even if baseline appears to be already applied
 */
export async function applyBaselineIfNeeded(
  force: boolean = false,
): Promise<void> {
  try {
    // Check if baseline file exists first - gracefully skip if missing
    if (!fs.existsSync(BASELINE_SQL_PATH)) {
      console.log("[Baseline] No baseline.sql found, skipping baseline step.");
      return;
    }

    if (!force && (await isBaselineApplied())) {
      console.log("[Baseline] ✅ Baseline already applied, skipping");
      return;
    }

    const isFresh = await isFreshDatabase();

    if (!isFresh && !force) {
      console.log(
        "[Baseline] ⚠️  Database has existing migrations, skipping baseline application",
      );
      console.log(
        "[Baseline] Use force=true if you want to apply baseline anyway",
      );
      return;
    }

    console.log("[Baseline] 🚀 Applying baseline to database...");
    await applyBaseline();
  } catch (error) {
    console.error("[Baseline] ❌ Failed to apply baseline:", error);
    throw error;
  }
}

/**
 * Prepare production database
 *
 * This function is designed for production database setup.
 * It applies the baseline and ensures the database is ready for the application.
 */
export async function prepareProductionDatabase(): Promise<void> {
  console.log("[Baseline] 🏭 Preparing production database...");

  try {
    // Use the same logic as development - apply baseline if needed
    await applyBaselineIfNeeded();

    // Always run migrations after baseline
    await migrateDb();
    console.log("[Baseline] ✅ Production database prepared successfully");
  } catch (error) {
    console.error(
      "[Baseline] ❌ Failed to prepare production database:",
      error,
    );
    throw error;
  }
}
