#!/usr/bin/env node
/**
 * Script to replace all user names with random usernames
 *
 * This script overwrites existing usernames to remove potential PII
 * that may have been stored. It generates random usernames in the
 * format "user_XXXXXXXX" where X is a random alphanumeric character.
 *
 * Usage:
 *   pnpm tsx scripts/randomize-usernames.ts           # Dry run (preview changes)
 *   pnpm tsx scripts/randomize-usernames.ts --execute # Actually apply changes
 */
import chalk from "chalk";
import { sql } from "drizzle-orm";
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
 * Generate a random alphanumeric string
 */
function generateRandomString(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a random username in the format "user_XXXXXXXX"
 */
function generateRandomUsername(): string {
  return `user_${generateRandomString(8)}`;
}

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
async function checkCurrentState(): Promise<void> {
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

  // Show sample of what new names will look like
  console.log(chalk.blue("\n🔀 Sample new names (format):"));
  for (let i = 0; i < 3; i++) {
    console.log(`   - ${generateRandomUsername()}`);
  }
}

/**
 * Main function to randomize usernames
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

  await checkCurrentState();

  // Get all users
  const allUsers = await db
    .select({ id: users.id, name: users.name })
    .from(users);

  console.log(
    chalk.blue(`\n📋 Will update ${chalk.yellow(allUsers.length)} users\n`),
  );

  if (!execute) {
    console.log(chalk.yellow("✅ Dry run complete. No changes made."));
    console.log(chalk.gray("   Run with --execute flag to apply changes\n"));
    return;
  }

  // Prompt for confirmation
  const confirmed = await promptConfirmation(
    chalk.red(
      `\n⚠️  This will overwrite ALL ${allUsers.length} usernames. Continue?`,
    ),
  );

  if (!confirmed) {
    console.log(chalk.yellow("\n❌ Operation cancelled by user."));
    return;
  }

  console.log(chalk.blue("\n🚀 Starting username randomization...\n"));

  let updated = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < allUsers.length; i += batchSize) {
    const batch = allUsers.slice(i, i + batchSize);

    for (const user of batch) {
      try {
        const newUsername = generateRandomUsername();
        await db
          .update(users)
          .set({ name: newUsername })
          .where(sql`${users.id} = ${user.id}`);
        updated++;
      } catch (error) {
        errors++;
        if (error instanceof Error) {
          logger.error(`Failed to update user ${user.id}: ${error.message}`);
        } else {
          logger.error(`Failed to update user ${user.id}: unknown error`);
        }
      }
    }

    const progress = Math.min(i + batchSize, allUsers.length);
    console.log(
      chalk.gray(
        `   Progress: ${progress}/${allUsers.length} (${Math.round((progress / allUsers.length) * 100)}%)`,
      ),
    );
  }

  console.log(chalk.green("\n✅ Username randomization complete!"));
  console.log(`   Updated: ${chalk.green(updated)}`);
  if (errors > 0) {
    console.log(`   Errors: ${chalk.red(errors)}`);
  }
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
