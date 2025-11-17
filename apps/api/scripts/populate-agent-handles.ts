#!/usr/bin/env node
/**
 * Script to populate agent handles for existing agents
 *
 * This is part of a multi-step migration process:
 * 1. Run first migration to add nullable handle column
 * 2. Run this script to populate handle values
 * 3. Run second migration to add NOT NULL and UNIQUE constraints
 *
 * The script prioritizes agents by their score, giving higher-ranked
 * agents first choice on handles in case of conflicts.
 */
import chalk from "chalk";
import { desc, eq, isNull, sql } from "drizzle-orm";
import * as readline from "readline";
import { parse } from "ts-command-line-args";

import { agents } from "@recallnet/db/schema/core/defs";
import { agentScore } from "@recallnet/db/schema/ranking/defs";
import {
  appendHandleSuffix,
  generateHandleFromName,
} from "@recallnet/services/lib";

import { db } from "@/database/db.js";
import { logger } from "@/lib/logger.js";

interface Args {
  execute?: boolean;
  batchSize?: number;
}

interface AgentWithScore {
  id: string;
  name: string;
  handle: string | null;
  score: number | null;
  createdAt?: Date;
}

const DEFAULT_BATCH_SIZE = 5000; // Increased batch size for bulk updates

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
 * Check current state of agent handles
 */
async function checkHandleState() {
  // Count total agents
  const totalAgentsResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(agents);
  const totalAgents = totalAgentsResult[0]?.count || 0;

  // Count agents without handles
  const missingHandlesResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(agents)
    .where(isNull(agents.handle));
  const missingHandles = missingHandlesResult[0]?.count || 0;

  // Count agents with handles
  const existingHandlesResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(agents)
    .where(sql`${agents.handle} IS NOT NULL`);
  const existingHandles = existingHandlesResult[0]?.count || 0;

  // Check for duplicate handles (shouldn't exist but let's verify)
  const duplicateCheck = await db.execute(sql`
    SELECT handle, COUNT(*) as count 
    FROM agents 
    WHERE handle IS NOT NULL 
    GROUP BY handle 
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 10
  `);

  return {
    totalAgents,
    missingHandles,
    existingHandles,
    duplicates: duplicateCheck.rows,
  };
}

/**
 * Populate agent handles
 */
async function populateAgentHandles(batchSize: number, isDryRun: boolean) {
  try {
    // Step 1: Get all agents ordered by score (highest first)
    console.log(chalk.blue("\nFetching agents ordered by score..."));

    // Get all agents without handles, with their scores if available
    const agentsQuery = await db
      .select({
        id: agents.id,
        name: agents.name,
        handle: agents.handle,
        score: agentScore.ordinal,
        createdAt: agents.createdAt,
      })
      .from(agents)
      .leftJoin(agentScore, eq(agents.id, agentScore.agentId))
      .where(isNull(agents.handle))
      .orderBy(
        sql`${agentScore.ordinal} DESC NULLS LAST`,
        desc(agents.createdAt),
      );

    const allAgents = agentsQuery;

    // Debug: Check for duplicates
    const uniqueAgentIds = new Set(allAgents.map((a) => a.id));
    let allAgentsUnique: AgentWithScore[] = allAgents;

    if (uniqueAgentIds.size !== allAgents.length) {
      console.log(
        chalk.yellow(`Warning: Found duplicate agents in query results`),
      );
      console.log(chalk.yellow(`  Total rows: ${allAgents.length}`));
      console.log(chalk.yellow(`  Unique agents: ${uniqueAgentIds.size}`));

      // Deduplicate by keeping the first occurrence (highest score due to ordering)
      const seenIds = new Set<string>();
      allAgentsUnique = allAgents.filter((agent) => {
        if (seenIds.has(agent.id)) {
          return false;
        }
        seenIds.add(agent.id);
        return true;
      });

      console.log(
        chalk.gray(`Deduplicated to ${allAgentsUnique.length} unique agents`),
      );
    }

    console.log(
      chalk.gray(`Found ${allAgentsUnique.length} agents without handles`),
    );

    if (allAgentsUnique.length === 0) {
      console.log(chalk.green("✓ No agents need handle population"));
      return { updated: 0, skipped: 0 };
    }

    // Debug: Show processing order for agents with scores
    const agentsWithScoresList = allAgentsUnique
      .filter((a: AgentWithScore) => a.score !== null)
      .slice(0, 10);

    if (agentsWithScoresList.length > 0) {
      console.log(chalk.blue("\n🏆 Processing order (top scored agents):"));
      agentsWithScoresList.forEach((agent: AgentWithScore, idx) => {
        const baseHandle = generateHandleFromName(agent.name);
        console.log(
          chalk.gray(
            `  ${idx + 1}. "${agent.name}" (score: ${agent.score}) → base: "${baseHandle}"`,
          ),
        );
      });
    }

    // Step 2: Generate handles and ensure uniqueness
    console.log(chalk.blue("\nGenerating unique handles..."));
    const handleMap = new Map<string, string>(); // agentId -> handle
    const usedHandles = new Set<string>();

    // First, get all existing handles to avoid conflicts
    const existingHandles = await db
      .select({ handle: agents.handle })
      .from(agents)
      .where(sql`${agents.handle} IS NOT NULL`);

    existingHandles.forEach(({ handle }) => {
      if (handle) usedHandles.add(handle.toLowerCase());
    });

    console.log(chalk.gray(`Found ${usedHandles.size} existing handles`));

    // Analyze potential conflicts by grouping agents by their base handle
    const baseHandleGroups = new Map<
      string,
      Array<{ id: string; name: string }>
    >();

    for (const agent of allAgentsUnique) {
      const baseHandle = generateHandleFromName(agent.name);
      if (!baseHandleGroups.has(baseHandle)) {
        baseHandleGroups.set(baseHandle, []);
      }
      baseHandleGroups.get(baseHandle)!.push({
        id: agent.id,
        name: agent.name,
      });
    }

    // Report on handles that will have conflicts
    const conflictingHandles = Array.from(baseHandleGroups.entries())
      .filter(([, agents]) => agents.length > 1)
      .sort((a, b) => b[1].length - a[1].length); // Sort by number of conflicts

    if (conflictingHandles.length > 0) {
      console.log(
        chalk.yellow(
          `\n⚠️  Found ${conflictingHandles.length} base handles with multiple agents:`,
        ),
      );

      // Show top 5 most conflicted handles
      conflictingHandles.slice(0, 5).forEach(([handle, agents]) => {
        console.log(chalk.yellow(`\n  "${handle}" - ${agents.length} agents:`));
        agents.slice(0, 3).forEach((agent, idx) => {
          console.log(chalk.gray(`    ${idx + 1}. "${agent.name}"`));
        });
        if (agents.length > 3) {
          console.log(chalk.gray(`    ... and ${agents.length - 3} more`));
        }
      });

      if (conflictingHandles.length > 5) {
        console.log(
          chalk.yellow(
            `\n  ... and ${conflictingHandles.length - 5} more conflicting handles`,
          ),
        );
      }
    }

    // Generate unique handles for each agent
    let conflictCount = 0;
    const handleConflicts: Array<{
      name: string;
      baseHandle: string;
      finalHandle: string;
    }> = [];

    for (const agent of allAgentsUnique) {
      const baseHandle = generateHandleFromName(agent.name);
      let finalHandle = baseHandle;
      let suffix = 1;
      let hadConflict = false;

      // Keep trying until we find a unique handle
      while (usedHandles.has(finalHandle.toLowerCase())) {
        finalHandle = appendHandleSuffix(baseHandle, suffix);
        suffix++;
        hadConflict = true;
      }

      if (hadConflict) {
        conflictCount++;
        if (handleConflicts.length < 10) {
          handleConflicts.push({
            name: agent.name,
            baseHandle,
            finalHandle,
          });
        }
      }

      handleMap.set(agent.id, finalHandle);
      usedHandles.add(finalHandle.toLowerCase());
    }

    console.log(chalk.gray(`Generated ${handleMap.size} unique handles`));
    if (conflictCount > 0) {
      console.log(
        chalk.yellow(
          `  - ${conflictCount} handles had conflicts and were modified`,
        ),
      );
      if (handleConflicts.length > 0) {
        console.log(
          chalk.gray("\n  Sample conflicts (in order of processing):"),
        );
        handleConflicts.forEach((conflict) => {
          console.log(
            chalk.gray(
              `    "${conflict.name}" → ${conflict.baseHandle} → ${conflict.finalHandle}`,
            ),
          );
        });
        if (conflictCount > 10) {
          console.log(chalk.gray(`    ... and ${conflictCount - 10} more`));
        }
      }
    }

    // Show handle assignment summary for conflicted base handles
    if (conflictingHandles.length > 0 && isDryRun) {
      console.log(chalk.blue("\n📊 Handle Assignment Preview:"));
      conflictingHandles.slice(0, 3).forEach(([baseHandle, agents]) => {
        console.log(chalk.blue(`\n  Base handle: "${baseHandle}"`));
        const assignments = agents.map((agent) => {
          const assigned = handleMap.get(agent.id);
          return { name: agent.name, handle: assigned };
        });
        assignments.slice(0, 5).forEach((assignment, idx) => {
          console.log(
            chalk.gray(
              `    ${idx + 1}. "${assignment.name}" → ${assignment.handle}`,
            ),
          );
        });
        if (assignments.length > 5) {
          console.log(chalk.gray(`    ... and ${assignments.length - 5} more`));
        }
      });
    }

    if (isDryRun) {
      console.log(chalk.yellow("\n⚠️  DRY RUN - No changes will be made"));
      return { updated: handleMap.size, skipped: 0 };
    }

    // Step 3: Update database in batches
    console.log(
      chalk.blue(`\nUpdating database in batches of ${batchSize}...`),
    );
    const entries = Array.from(handleMap.entries());
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);

      try {
        // Use a single bulk update query for the entire batch
        if (batch.length > 0) {
          // Build the UPDATE query using VALUES clause for better performance
          // This approach sends all updates in a single query
          const values = batch
            .map(([agentId, handle]) => {
              // Escape single quotes in handle to prevent SQL injection
              const escapedHandle = handle.replace(/'/g, "''");
              return `('${agentId}'::uuid, '${escapedHandle}'::text)`;
            })
            .join(", ");

          // Use UPDATE ... FROM VALUES pattern which is much more efficient
          // This executes as a single query instead of N queries
          await db.execute(sql`
            UPDATE agents
            SET handle = v.handle
            FROM (VALUES ${sql.raw(values)}) AS v(id, handle)
            WHERE agents.id = v.id
          `);
        }

        updated += batch.length;
        const progress = Math.round((updated / entries.length) * 100);
        console.log(
          chalk.gray(
            `  Progress: ${updated}/${entries.length} agents (${progress}%)`,
          ),
        );
      } catch (error) {
        failed += batch.length;
        console.log(
          chalk.red(`  ❌ Failed to update batch starting at index ${i}`),
        );
        logger.error({ error }, "Batch update error:");
      }
    }

    console.log(chalk.green(`\n✓ Successfully updated ${updated} agents`));
    if (failed > 0) {
      console.log(chalk.red(`  ❌ Failed to update ${failed} agents`));
    }

    // Verify no duplicates
    console.log(chalk.blue("\nVerifying handle uniqueness..."));
    const duplicateCheck = await db.execute(sql`
      SELECT handle, COUNT(*) as count 
      FROM agents 
      WHERE handle IS NOT NULL 
      GROUP BY handle 
      HAVING COUNT(*) > 1
    `);

    if (duplicateCheck.rows.length > 0) {
      console.log(chalk.red("❌ Found duplicate handles:"));
      duplicateCheck.rows.forEach((row) => {
        console.log(chalk.red(`  - "${row.handle}": ${row.count} occurrences`));
      });
      throw new Error("Duplicate handles detected!");
    }

    console.log(chalk.green("✓ Verification passed - all handles are unique"));

    return { updated, skipped: failed };
  } catch (error) {
    logger.error({ error }, "Error populating agent handles:");
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
      description: "Execute the backfill (default is dry-run)",
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

  console.log(chalk.bold("\n🔧  Agent Handle Population Script"));
  console.log(chalk.gray("====================================\n"));

  if (isDryRun) {
    console.log(
      chalk.yellow("⚠️  Running in DRY RUN mode - no changes will be made"),
    );
    console.log(
      chalk.yellow("   Add --execute flag to perform actual population\n"),
    );
  } else {
    console.log(
      chalk.red("⚠️  Running in EXECUTE mode - handles WILL be populated!\n"),
    );
  }

  // Check current state
  console.log(chalk.blue("Checking current handle state..."));
  const state = await checkHandleState();

  console.log(chalk.gray(`\nCurrent state:`));
  console.log(
    chalk.gray(`  Total agents: ${state.totalAgents.toLocaleString()}`),
  );
  console.log(
    chalk.gray(`  With handles: ${state.existingHandles.toLocaleString()}`),
  );
  console.log(
    chalk.yellow(`  Missing handles: ${state.missingHandles.toLocaleString()}`),
  );

  if (state.duplicates.length > 0) {
    console.log(chalk.red(`\n❌ Found existing duplicate handles:`));
    state.duplicates.forEach((row) => {
      console.log(chalk.red(`  - "${row.handle}": ${row.count} occurrences`));
    });
    console.log(chalk.red("\nPlease resolve duplicates before proceeding!"));
    process.exit(1);
  }

  if (state.missingHandles === 0) {
    console.log(chalk.green("\n✅ All agents already have handles!"));
    process.exit(0);
  }

  // Show migration instructions
  console.log(chalk.blue("\n📋 Migration Process:"));
  console.log(chalk.gray("1. First migration adds nullable handle column"));
  console.log(chalk.gray("2. This script populates handle values"));
  console.log(
    chalk.gray("3. Second migration adds NOT NULL and UNIQUE constraints"),
  );
  console.log(
    chalk.gray("\nEnsure you've run the first migration before proceeding."),
  );

  // Confirmation
  if (!isDryRun) {
    console.log(
      chalk.yellow(
        `\n⚠️  Will populate handles for ${state.missingHandles.toLocaleString()} agents`,
      ),
    );
    console.log(chalk.yellow(`   Batch size: ${batchSize}`));
    console.log(
      chalk.yellow(
        `   Estimated batches: ${Math.ceil(state.missingHandles / batchSize)}`,
      ),
    );

    const confirmed = await promptConfirmation(
      "\nAre you sure you want to proceed?",
    );
    if (!confirmed) {
      console.log(chalk.red("\n❌ Handle population cancelled"));
      process.exit(0);
    }
  }

  // Populate handles
  const result = await populateAgentHandles(batchSize, isDryRun);

  // Final summary
  console.log(
    chalk.green(`\n✅ ${isDryRun ? "Dry run" : "Population"} complete!`),
  );
  console.log(
    chalk.gray(
      `   Handles ${isDryRun ? "would be" : ""} populated: ${result.updated.toLocaleString()}`,
    ),
  );
  if (result.skipped > 0) {
    console.log(chalk.yellow(`   Skipped: ${result.skipped.toLocaleString()}`));
  }

  if (isDryRun) {
    console.log(
      chalk.yellow("\nTo execute the population, run with --execute flag"),
    );
  } else {
    console.log(chalk.blue("\n📋 Next steps:"));
    console.log(
      chalk.gray("1. Verify the handles look correct in the database"),
    );
    console.log(chalk.gray("2. Run the second migration to add constraints"));
  }

  // Clean exit
  process.exit(0);
}

// Execute the script
main().catch((error) => {
  console.error(chalk.red("\n❌ Script failed:"), error);
  process.exit(1);
});
