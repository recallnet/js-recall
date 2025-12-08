import chalk from "chalk";
import { eq, inArray, sql } from "drizzle-orm";
import * as readline from "readline";
import { parse } from "ts-command-line-args";

import {
  competitionAgents,
  competitions,
  competitionsLeaderboard,
} from "@recallnet/db/schema/core/defs";
import {
  agentScore,
  agentScoreHistory,
} from "@recallnet/db/schema/ranking/defs";
import {
  portfolioSnapshots,
  trades,
  tradingCompetitions,
  tradingCompetitionsLeaderboard,
  tradingConstraints,
} from "@recallnet/db/schema/trading/defs";

import { db } from "@/database/db.js";

interface Args {
  competitions: string;
  execute?: boolean;
  force?: boolean;
  exclude?: string;
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
 * Get detailed information about what will be deleted
 */
async function analyzeCompetitions(competitionIds: string[]) {
  const results = await Promise.all(
    competitionIds.map(async (competitionId) => {
      const competition = await db
        .select()
        .from(competitions)
        .where(eq(competitions.id, competitionId))
        .limit(1);

      if (!competition[0]) {
        return {
          id: competitionId,
          exists: false,
        };
      }

      const comp = competition[0];

      // Count data in each table
      const [
        agentCount,
        tradeCount,
        snapshotCount,
        leaderboardCount,

        scoreHistoryCount,
      ] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(competitionAgents)
          .where(eq(competitionAgents.competitionId, competitionId))
          .then((r) => r[0]?.count || 0),
        db
          .select({ count: sql<number>`count(*)` })
          .from(trades)
          .where(eq(trades.competitionId, competitionId))
          .then((r) => r[0]?.count || 0),
        db
          .select({ count: sql<number>`count(*)` })
          .from(portfolioSnapshots)
          .where(eq(portfolioSnapshots.competitionId, competitionId))
          .then((r) => r[0]?.count || 0),
        db
          .select({ count: sql<number>`count(*)` })
          .from(competitionsLeaderboard)
          .where(eq(competitionsLeaderboard.competitionId, competitionId))
          .then((r) => r[0]?.count || 0),

        db
          .select({ count: sql<number>`count(*)` })
          .from(agentScoreHistory)
          .where(eq(agentScoreHistory.competitionId, competitionId))
          .then((r) => r[0]?.count || 0),
      ]);

      return {
        id: competitionId,
        exists: true,
        name: comp.name,
        status: comp.status,
        startDate: comp.startDate,
        endDate: comp.endDate,
        isEnded: comp.status === "ended",
        dataCounts: {
          agents: agentCount,
          trades: tradeCount,
          snapshots: snapshotCount,
          leaderboard: leaderboardCount,

          scoreHistory: scoreHistoryCount,
        },
      };
    }),
  );

  return results;
}

/**
 * Delete all data for a competition
 */
async function deleteCompetitionData(
  competitionId: string,
  dryRun: boolean = true,
) {
  console.log(
    chalk.yellow(
      `\n${dryRun ? "[DRY RUN] " : ""}Deleting data for competition ${competitionId}...`,
    ),
  );

  const deletions: Array<{ table: string; count: number }> = [];

  try {
    await db.transaction(async (tx) => {
      // Delete from object_index

      // Delete from trades
      const tradesDeleted = await tx
        .delete(trades)
        .where(eq(trades.competitionId, competitionId))
        .returning({ id: trades.id });
      deletions.push({ table: "trades", count: tradesDeleted.length });

      // Delete from agent_score_history
      const scoreHistoryDeleted = await tx
        .delete(agentScoreHistory)
        .where(eq(agentScoreHistory.competitionId, competitionId))
        .returning({ id: agentScoreHistory.id });
      deletions.push({
        table: "agent_score_history",
        count: scoreHistoryDeleted.length,
      });

      // Delete from portfolio_snapshots
      const snapshotsDeleted = await tx
        .delete(portfolioSnapshots)
        .where(eq(portfolioSnapshots.competitionId, competitionId))
        .returning({ id: portfolioSnapshots.id });
      deletions.push({
        table: "portfolio_snapshots",
        count: snapshotsDeleted.length,
      });

      // Delete from trading_constraints
      const constraintsDeleted = await tx
        .delete(tradingConstraints)
        .where(eq(tradingConstraints.competitionId, competitionId))
        .returning({ id: tradingConstraints.competitionId });
      deletions.push({
        table: "trading_constraints",
        count: constraintsDeleted.length,
      });

      // Delete from trading_competitions_leaderboard
      const tradingLeaderboardDeleted = await tx
        .select({ count: sql<number>`count(*)` })
        .from(tradingCompetitionsLeaderboard)
        .innerJoin(
          competitionsLeaderboard,
          eq(
            tradingCompetitionsLeaderboard.competitionsLeaderboardId,
            competitionsLeaderboard.id,
          ),
        )
        .where(eq(competitionsLeaderboard.competitionId, competitionId))
        .then((r) => r[0]?.count || 0);
      deletions.push({
        table: "trading_competitions_leaderboard",
        count: Number(tradingLeaderboardDeleted),
      });

      // Delete from competitions_leaderboard
      const leaderboardDeleted = await tx
        .delete(competitionsLeaderboard)
        .where(eq(competitionsLeaderboard.competitionId, competitionId))
        .returning({ id: competitionsLeaderboard.id });
      deletions.push({
        table: "competitions_leaderboard",
        count: leaderboardDeleted.length,
      });

      // Delete from competition_agents
      const agentsDeleted = await tx
        .delete(competitionAgents)
        .where(eq(competitionAgents.competitionId, competitionId))
        .returning({ agentId: competitionAgents.agentId });
      deletions.push({
        table: "competition_agents",
        count: agentsDeleted.length,
      });

      // Delete from trading_competitions
      const tradingCompDeleted = await tx
        .delete(tradingCompetitions)
        .where(eq(tradingCompetitions.competitionId, competitionId))
        .returning({ id: tradingCompetitions.competitionId });
      deletions.push({
        table: "trading_competitions",
        count: tradingCompDeleted.length,
      });

      // Finally, delete from competitions
      const compDeleted = await tx
        .delete(competitions)
        .where(eq(competitions.id, competitionId))
        .returning({ id: competitions.id });
      deletions.push({ table: "competitions", count: compDeleted.length });

      if (dryRun) {
        // Rollback transaction in dry run mode
        throw new Error("DRY_RUN_ROLLBACK");
      }
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "DRY_RUN_ROLLBACK") {
      console.log(chalk.yellow("[DRY RUN] Transaction rolled back"));
    } else {
      throw error;
    }
  }

  // Log deletion summary
  console.log(
    chalk.green(`\nDeletion summary for competition ${competitionId}:`),
  );
  deletions.forEach(({ table, count }) => {
    if (count > 0) {
      console.log(chalk.gray(`  - ${table}: ${count} rows`));
    }
  });

  return deletions;
}

/**
 * Recalculate agent scores after deleting ended competitions
 * @param excludedCompetitionIds - Competition IDs to exclude from rank calculations
 */
async function recalculateAgentScores(excludedCompetitionIds: string[] = []) {
  console.log(chalk.blue("\nRecalculating agent scores from history..."));

  if (excludedCompetitionIds.length > 0) {
    console.log(
      chalk.yellow(
        `Excluding competitions from rank calculations: ${excludedCompetitionIds.join(", ")}`,
      ),
    );
  }

  try {
    // First, if we have excluded competitions, delete their history entries
    if (excludedCompetitionIds.length > 0) {
      const deletedHistory = await db
        .delete(agentScoreHistory)
        .where(inArray(agentScoreHistory.competitionId, excludedCompetitionIds))
        .returning({ id: agentScoreHistory.id });

      console.log(
        chalk.gray(
          `Deleted ${deletedHistory.length} history entries for excluded competitions`,
        ),
      );
    }

    // Get the most recent score history for each agent
    const latestScoresRaw = await db.execute(sql`
      WITH latest_scores AS (
        SELECT DISTINCT ON (agent_id)
          agent_id,
          mu,
          sigma,
          ordinal,
          created_at
        FROM agent_score_history
        ORDER BY agent_id, created_at DESC
      )
      SELECT * FROM latest_scores
    `);
    // Transform snake_case to camelCase
    const latestScores = latestScoresRaw.rows.map((row) => ({
      agentId: String(row.agent_id),
      mu: Number(row.mu),
      sigma: Number(row.sigma),
      ordinal: Number(row.ordinal),
    }));
    console.log(
      chalk.gray(`Found ${latestScores.length} agents with score history`),
    );

    // Get current agent IDs in agent_score table
    const currentAgentIds = await db
      .select({ agentId: agentScore.agentId })
      .from(agentScore);

    // Delete scores for agents not in the latest history
    const agentIdsToKeep = new Set(latestScores.map((row) => row.agentId));
    const agentIdsToDelete = currentAgentIds
      .filter((row) => !agentIdsToKeep.has(row.agentId))
      .map((row) => row.agentId);

    if (agentIdsToDelete.length > 0) {
      await db
        .delete(agentScore)
        .where(inArray(agentScore.agentId, agentIdsToDelete));
      console.log(
        chalk.gray(
          `Deleted ${agentIdsToDelete.length} agent scores for agents not in history`,
        ),
      );
    }

    // Upsert the latest scores for each agent
    if (latestScores.length > 0) {
      await db.transaction(async (tx) => {
        for (const row of latestScores) {
          await tx
            .insert(agentScore)
            .values({
              id: crypto.randomUUID(),
              agentId: row.agentId,
              mu: row.mu,
              sigma: row.sigma,
              ordinal: row.ordinal,
            })
            .onConflictDoUpdate({
              target: agentScore.agentId,
              set: {
                mu: row.mu,
                sigma: row.sigma,
                ordinal: row.ordinal,
                updatedAt: new Date(),
              },
            });
        }
      });

      console.log(
        chalk.gray(
          `Updated scores for ${latestScores.length} agents from history`,
        ),
      );
    }

    console.log(chalk.green("Agent score recalculation complete!"));
  } catch (error) {
    console.error(chalk.red("Error recalculating agent scores:"), error);
    throw error;
  }
}

/**
 * Main script execution
 */
async function main() {
  const args = parse<Args>({
    competitions: {
      type: String,
      description: "Comma-separated list of competition IDs to delete",
    },
    execute: {
      type: Boolean,
      optional: true,
      description: "Execute the deletion (default is dry-run)",
    },
    exclude: {
      type: String,
      optional: true,
      description:
        "Comma-separated list of competition IDs to exclude from global rank calculations",
    },
    force: {
      type: Boolean,
      optional: true,
      description: "Skip confirmation prompts",
    },
  });

  const competitionIds = args.competitions.split(",").map((id) => id.trim());
  const excludedCompetitionIds = args.exclude
    ? args.exclude.split(",").map((id) => id.trim())
    : [];
  const isDryRun = !args.execute;

  console.log(chalk.bold("\n🗑️  Competition Data Deletion Script"));
  console.log(chalk.gray("====================================\n"));

  if (isDryRun) {
    console.log(
      chalk.yellow("⚠️  Running in DRY RUN mode - no data will be deleted"),
    );
    console.log(
      chalk.yellow("   Add --execute flag to perform actual deletion\n"),
    );
  } else {
    console.log(
      chalk.red("⚠️  Running in EXECUTE mode - data WILL be deleted!\n"),
    );
  }

  if (excludedCompetitionIds.length > 0) {
    console.log(
      chalk.blue("📌 Excluding competitions from global rank calculations:"),
    );
    console.log(chalk.gray(`   ${excludedCompetitionIds.join(", ")}\n`));
  }

  // Analyze competitions
  console.log(chalk.blue("Analyzing competitions..."));
  const analysisResults = await analyzeCompetitions(competitionIds);

  // Display analysis results
  let hasEndedCompetitions = false;
  analysisResults.forEach((result) => {
    console.log(`\n${chalk.bold(result.id)}:`);
    if (!result.exists) {
      console.log(chalk.red("  ❌ Competition not found"));
    } else {
      console.log(chalk.green(`  ✓ ${result.name}`));
      console.log(chalk.gray(`  Status: ${result.status}`));
      console.log(chalk.gray(`  Start: ${result.startDate || "Not set"}`));
      console.log(chalk.gray(`  End: ${result.endDate || "Not set"}`));
      console.log(chalk.gray("\n  Data counts:"));
      Object.entries(result.dataCounts ?? {}).forEach(([table, count]) => {
        if (count > 0) {
          console.log(chalk.gray(`    - ${table}: ${count}`));
        }
      });
      if (result.isEnded) {
        hasEndedCompetitions = true;
        console.log(
          chalk.yellow(
            "\n  ⚠️  This is an ENDED competition - will affect agent scores!",
          ),
        );
      }
    }
  });

  const validCompetitions = analysisResults.filter((r) => r.exists);
  if (validCompetitions.length === 0) {
    console.log(chalk.red("\n❌ No valid competitions found to delete"));
    process.exit(1);
  }

  // Confirmation
  if (!args.force && !isDryRun) {
    console.log(chalk.yellow("\n⚠️  WARNING: This action cannot be undone!"));
    if (hasEndedCompetitions) {
      console.log(
        chalk.yellow(
          "⚠️  Deleting ended competitions will trigger agent score recalculation!",
        ),
      );
    }

    const confirmed = await promptConfirmation(
      "\nAre you sure you want to proceed?",
    );
    if (!confirmed) {
      console.log(chalk.red("\n❌ Deletion cancelled"));
      process.exit(0);
    }
  }

  // Delete competitions
  console.log(chalk.blue("\nStarting deletion process..."));

  for (const result of validCompetitions) {
    await deleteCompetitionData(result.id, isDryRun);
  }

  // Recalculate agent scores if we deleted any ended competitions
  if (hasEndedCompetitions && !isDryRun) {
    await recalculateAgentScores(excludedCompetitionIds);
  }

  console.log(
    chalk.green(`\n✅ ${isDryRun ? "Dry run" : "Deletion"} complete!`),
  );

  if (isDryRun) {
    console.log(
      chalk.yellow("\nTo execute the deletion, run with --execute flag"),
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
