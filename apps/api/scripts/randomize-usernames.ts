#!/usr/bin/env node
/**
 * Script to replace all user names with random usernames
 *
 * This script overwrites existing usernames to remove potential PII
 * that may have been stored. It generates random usernames in the
 * format "user_XXXXXXXX" where X is a random alphanumeric character.
 *
 * Uses cursor-based pagination and batch updates for memory efficiency
 * with large user counts.
 *
 * Usage:
 *   pnpm tsx scripts/randomize-usernames.ts           # Dry run (preview changes)
 *   pnpm tsx scripts/randomize-usernames.ts --execute # Actually apply changes
 */
import chalk from "chalk";
import { asc, gt, inArray, sql } from "drizzle-orm";
import * as readline from "readline";
import { parse } from "ts-command-line-args";

import { users } from "@recallnet/db/schema/core/defs";

import { db } from "@/database/db.js";
import { logger } from "@/lib/logger.js";

interface Args {
  execute?: boolean;
  batchSize?: number;
}

const DEFAULT_BATCH_SIZE = 1000;

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
 * Get current user count and sample names
 */
async function checkCurrentState(): Promise<number> {
  const totalUsersResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(users);
  const totalUsers = totalUsersResult[0]?.count || 0;

  console.log(chalk.blue("\n📊 Current State:"));
  console.log(`   Total users: ${chalk.yellow(totalUsers)}`);

  // Show sample of current names
  const sampleUsers = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .limit(5);

  if (sampleUsers.length > 0) {
    console.log(chalk.blue("\n📝 Sample current names:"));
    sampleUsers.forEach((user) => {
      console.log(`   - ${user.name}`);
    });
  }

  // Show sample of what new names will look like (using the same SQL expression)
  console.log(chalk.blue("\n🔀 Sample new names (format):"));
  const sampleNames = await db.execute<{ name: string }>(
    sql`SELECT 'user_' || left(replace(gen_random_uuid()::text, '-', ''), 8) as name FROM generate_series(1, 3)`,
  );
  for (const row of sampleNames.rows) {
    console.log(`   - ${row.name}`);
  }

  return totalUsers;
}

/**
 * Main function to randomize usernames using cursor-based pagination
 */
async function randomizeUsernames(
  execute: boolean,
  batchSize: number,
): Promise<void> {
  console.log(chalk.cyan("\n🔄 Randomize Usernames Script"));
  console.log(chalk.cyan("================================\n"));

  if (!execute) {
    console.log(chalk.yellow("⚠️  DRY RUN MODE - No changes will be made\n"));
    console.log(chalk.gray("   Run with --execute flag to apply changes\n"));
  }

  const totalUsers = await checkCurrentState();

  console.log(
    chalk.blue(`\n📋 Will update ${chalk.yellow(totalUsers)} users\n`),
  );

  if (!execute) {
    console.log(chalk.yellow("✅ Dry run complete. No changes made."));
    console.log(chalk.gray("   Run with --execute flag to apply changes\n"));
    return;
  }

  // Prompt for confirmation
  const confirmed = await promptConfirmation(
    chalk.red(
      `\n⚠️  This will overwrite ALL ${totalUsers} usernames. Continue?`,
    ),
  );

  if (!confirmed) {
    console.log(chalk.yellow("\n❌ Operation cancelled by user."));
    return;
  }

  console.log(chalk.blue("\n🚀 Starting username randomization...\n"));

  let updated = 0;
  let batchCount = 0;
  let lastId: string | null = null;

  // Cursor-based pagination for memory efficiency
  while (true) {
    const batch = await db
      .select({ id: users.id })
      .from(users)
      .where(lastId ? gt(users.id, lastId) : undefined)
      .orderBy(asc(users.id))
      .limit(batchSize);

    if (batch.length === 0) break;

    const ids = batch.map((r) => r.id);

    try {
      // Single UPDATE statement for the entire batch with in-database random generation
      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({
            name: sql`'user_' || left(replace(gen_random_uuid()::text, '-', ''), 8)`,
          })
          .where(inArray(users.id, ids));
      });

      updated += batch.length;
      batchCount++;
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Failed batch ${batchCount + 1}: ${error.message}`);
      } else {
        logger.error(`Failed batch ${batchCount + 1}: unknown error`);
      }
    }

    lastId = ids[ids.length - 1] ?? null;
    console.log(
      chalk.gray(
        `   Progress: ${updated}/${totalUsers} (${Math.round((updated / totalUsers) * 100)}%)`,
      ),
    );
  }

  console.log(chalk.green("\n✅ Username randomization complete!"));
  console.log(`   Updated: ${chalk.green(updated)} users`);
  console.log(`   Batches: ${chalk.green(batchCount)}`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = parse<Args>({
    execute: {
      type: Boolean,
      optional: true,
      description: "Actually execute the changes (default: dry run)",
    },
    batchSize: {
      type: Number,
      optional: true,
      description: `Batch size for updates (default: ${DEFAULT_BATCH_SIZE})`,
    },
  });

  try {
    await randomizeUsernames(
      args.execute ?? false,
      args.batchSize ?? DEFAULT_BATCH_SIZE,
    );
    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Script failed: ${error.message}`);
    } else {
      logger.error("Script failed: unknown error");
    }
    process.exit(1);
  }
}

main();
