#!/usr/bin/env node
/**
 * Script to populate API key hashes for existing agents
 *
 * This script is part of the REC-552 performance optimization to fix
 * the N+1 query pattern in API key validation.
 *
 * Migration process:
 * 1. Run database migration to add api_key_hash column
 * 2. Run this script to populate hash values for existing agents
 * 3. Deploy code that uses hash-based lookups
 */
import chalk from "chalk";
// Import required functions from drizzle-orm
import { eq, isNull, sql } from "drizzle-orm";
import * as readline from "readline";
import { parse } from "ts-command-line-args";

import { agents } from "@recallnet/db/schema/core/defs";
import { decryptApiKey, hashApiKey } from "@recallnet/services/lib";

import { config } from "@/config/index.js";
import { db } from "@/database/db.js";

interface Args {
  execute?: boolean;
  batchSize?: number;
}

const DEFAULT_BATCH_SIZE = 100;

/**
 * Prompt user for confirmation
 */
async function promptConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes" || answer.toLowerCase() === "y");
    });
  });
}

/**
 * Check current state of API key hashes
 */
async function checkHashState() {
  // NOTE: These queries are not in a transaction, so if new agents register
  // between the different queries, the counts (existingHashes + missingHashes)
  // might be greater than totalAgents. This is acceptable since the counts
  // are only used for diagnostic logging purposes.
  const totalAgentsResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(agents);
  const totalAgents = totalAgentsResult[0]?.count || 0;

  const missingHashesResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(agents)
    .where(isNull(agents.apiKeyHash));
  const missingHashes = missingHashesResult[0]?.count || 0;

  const existingHashesResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(agents)
    .where(sql`${agents.apiKeyHash} IS NOT NULL`);
  const existingHashes = existingHashesResult[0]?.count || 0;

  return {
    totalAgents,
    missingHashes,
    existingHashes,
  };
}

/**
 * Migrate API key hashes for existing agents
 */
async function migrateApiKeyHashes(batchSize: number, isDryRun: boolean) {
  try {
    // Get all agents without hashes
    const agentsToMigrate = await db
      .select()
      .from(agents)
      .where(isNull(agents.apiKeyHash));

    console.log(
      chalk.gray(`Found ${agentsToMigrate.length} agents without hashes`),
    );

    if (agentsToMigrate.length === 0) {
      console.log(chalk.green("✓ No agents need hash migration"));
      return { updated: 0, skipped: 0, failed: 0 };
    }

    if (isDryRun) {
      console.log(chalk.yellow("\n⚠️  DRY RUN - No changes will be made"));
      return { updated: agentsToMigrate.length, skipped: 0, failed: 0 };
    }

    // Process in batches
    console.log(
      chalk.blue(`\nUpdating database in batches of ${batchSize}...`),
    );

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < agentsToMigrate.length; i += batchSize) {
      const batch = agentsToMigrate.slice(i, i + batchSize);

      for (const agent of batch) {
        try {
          // Skip if agent already has a hash (shouldn't happen based on query)
          if (agent.apiKeyHash) {
            skipped++;
            continue;
          }

          // Decrypt the API key
          const decryptedKey = decryptApiKey(
            agent.apiKey,
            config.security.rootEncryptionKey,
          );

          // Generate hash
          const apiKeyHash = hashApiKey(decryptedKey);

          // Update the agent with the hash
          await db
            .update(agents)
            .set({ apiKeyHash })
            .where(eq(agents.id, agent.id));

          updated++;
        } catch (error) {
          console.error(
            chalk.red(`  ✗ Failed to update agent ${agent.id}`),
            error instanceof Error ? error.message : error,
          );
          failed++;
        }
      }

      const progress = Math.round(
        ((updated + failed + skipped) / agentsToMigrate.length) * 100,
      );
      console.log(
        chalk.gray(
          `  Progress: ${updated + failed + skipped}/${agentsToMigrate.length} agents (${progress}%)`,
        ),
      );
    }

    console.log(chalk.green(`\n✓ Successfully updated ${updated} agents`));
    if (failed > 0) {
      console.log(chalk.red(`  ✗ Failed to update ${failed} agents`));
    }
    if (skipped > 0) {
      console.log(chalk.yellow(`  ⊙ Skipped ${skipped} agents`));
    }

    return { updated, skipped, failed };
  } catch (error) {
    console.error("Error migrating API key hashes:", error);
    throw error;
  }
}

/**
 * Main script execution
 */
async function main() {
  const args = parse<Args>({
    execute: {
      type: Boolean,
      optional: true,
      description: "Execute the migration (default is dry-run)",
    },
    batchSize: {
      type: Number,
      optional: true,
      defaultValue: DEFAULT_BATCH_SIZE,
      description: "Number of agents to update per batch",
    },
  });

  const isDryRun = !args.execute;
  const batchSize = args.batchSize || DEFAULT_BATCH_SIZE;

  console.log(chalk.bold("\n🔧  API Key Hash Migration Script"));
  console.log(chalk.gray("====================================\n"));

  if (isDryRun) {
    console.log(
      chalk.yellow("⚠️  Running in DRY RUN mode - no changes will be made"),
    );
    console.log(
      chalk.yellow("   Add --execute flag to perform actual migration\n"),
    );
  } else {
    console.log(
      chalk.red("⚠️  Running in EXECUTE mode - hashes WILL be generated!\n"),
    );
  }

  // Check current state
  console.log(chalk.blue("Checking current hash state..."));
  const state = await checkHashState();

  console.log(chalk.gray(`\nCurrent state:`));
  console.log(
    chalk.gray(`  Total agents: ${state.totalAgents.toLocaleString()}`),
  );
  console.log(
    chalk.gray(`  With hashes: ${state.existingHashes.toLocaleString()}`),
  );
  console.log(
    chalk.yellow(`  Missing hashes: ${state.missingHashes.toLocaleString()}`),
  );

  if (state.missingHashes === 0) {
    console.log(chalk.green("\n✅ All agents already have API key hashes!"));
    process.exit(0);
  }

  // Show migration context
  console.log(chalk.blue("\n📋 Migration Context:"));
  console.log(
    chalk.gray(
      "This migration fixes the N+1 query pattern in API key validation",
    ),
  );
  console.log(
    chalk.gray("by adding searchable hashes for O(1) lookup performance."),
  );

  // Confirmation
  if (!isDryRun) {
    console.log(
      chalk.yellow(
        `\n⚠️  Will generate hashes for ${state.missingHashes.toLocaleString()} agents`,
      ),
    );
    console.log(chalk.yellow(`   Batch size: ${batchSize}`));
    console.log(
      chalk.yellow(
        `   Estimated batches: ${Math.ceil(state.missingHashes / batchSize)}`,
      ),
    );

    const confirmed = await promptConfirmation(
      "\nAre you sure you want to proceed?",
    );
    if (!confirmed) {
      console.log(chalk.red("\n❌ Migration cancelled"));
      process.exit(0);
    }
  }

  // Run migration
  const result = await migrateApiKeyHashes(batchSize, isDryRun);

  // Final summary
  console.log(
    chalk.green(`\n✅ ${isDryRun ? "Dry run" : "Migration"} complete!`),
  );
  console.log(
    chalk.gray(
      `   Hashes ${isDryRun ? "would be" : ""} generated: ${result.updated.toLocaleString()}`,
    ),
  );
  if (result.failed > 0) {
    console.log(chalk.red(`   Failed: ${result.failed.toLocaleString()}`));
    console.log(
      chalk.yellow(
        "\n⚠️  Failed agents will use live migration on next authentication",
      ),
    );
  }

  if (isDryRun) {
    console.log(
      chalk.yellow("\nTo execute the migration, run with --execute flag"),
    );
  }

  // Clean exit
  process.exit(0);
}

// Execute the script
main().catch((error) => {
  console.error(chalk.red("\n❌ Script failed:"), error);
  process.exit(1);
});
