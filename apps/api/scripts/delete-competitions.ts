import chalk from "chalk";
import { eq, sql } from "drizzle-orm";
import { Rating, rate, rating } from "openskill";
import * as readline from "readline";
import { parse } from "ts-command-line-args";

import { db } from "@/database/db.js";
import * as agentScoreRepo from "@/database/repositories/agentscore-repository.js";
import * as competitionRepo from "@/database/repositories/competition-repository.js";
import {
  competitionAgents,
  competitions,
  competitionsLeaderboard,
  votes,
} from "@/database/schema/core/defs.js";
import {
  agentScore,
  agentScoreHistory,
} from "@/database/schema/ranking/defs.js";
import { objectIndex } from "@/database/schema/syncing/defs.js";
import {
  portfolioSnapshots,
  portfolioTokenValues,
  trades,
  tradingCompetitions,
  tradingCompetitionsLeaderboard,
  tradingConstraints,
} from "@/database/schema/trading/defs.js";

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
        voteCount,
        tradeCount,
        snapshotCount,
        leaderboardCount,
        objectIndexCount,
        scoreHistoryCount,
      ] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(competitionAgents)
          .where(eq(competitionAgents.competitionId, competitionId))
          .then((r) => r[0]?.count || 0),
        db
          .select({ count: sql<number>`count(*)` })
          .from(votes)
          .where(eq(votes.competitionId, competitionId))
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
          .from(objectIndex)
          .where(eq(objectIndex.competitionId, competitionId))
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
          votes: voteCount,
          trades: tradeCount,
          snapshots: snapshotCount,
          leaderboard: leaderboardCount,
          objectIndex: objectIndexCount,
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
      const objectIndexDeleted = await tx
        .delete(objectIndex)
        .where(eq(objectIndex.competitionId, competitionId))
        .returning({ id: objectIndex.id });
      deletions.push({
        table: "object_index",
        count: objectIndexDeleted.length,
      });

      // Delete from trades
      const tradesDeleted = await tx
        .delete(trades)
        .where(eq(trades.competitionId, competitionId))
        .returning({ id: trades.id });
      deletions.push({ table: "trades", count: tradesDeleted.length });

      // Delete from votes
      const votesDeleted = await tx
        .delete(votes)
        .where(eq(votes.competitionId, competitionId))
        .returning({ id: votes.id });
      deletions.push({ table: "votes", count: votesDeleted.length });

      // Delete from agent_score_history
      const scoreHistoryDeleted = await tx
        .delete(agentScoreHistory)
        .where(eq(agentScoreHistory.competitionId, competitionId))
        .returning({ id: agentScoreHistory.id });
      deletions.push({
        table: "agent_score_history",
        count: scoreHistoryDeleted.length,
      });

      // Delete from portfolio_token_values (through portfolio_snapshots cascade)
      const tokenValuesDeleted = await tx
        .select({ count: sql<number>`count(*)` })
        .from(portfolioTokenValues)
        .innerJoin(
          portfolioSnapshots,
          eq(portfolioTokenValues.portfolioSnapshotId, portfolioSnapshots.id),
        )
        .where(eq(portfolioSnapshots.competitionId, competitionId))
        .then((r) => r[0]?.count || 0);
      deletions.push({
        table: "portfolio_token_values",
        count: Number(tokenValuesDeleted),
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
  console.log(chalk.blue("\nRecalculating agent scores..."));

  if (excludedCompetitionIds.length > 0) {
    console.log(
      chalk.yellow(
        `Excluding competitions from rank calculations: ${excludedCompetitionIds.join(", ")}`,
      ),
    );
  }

  try {
    // Get all remaining competitions that have ended
    const query = db
      .select()
      .from(competitions)
      .where(eq(competitions.status, "ended"));

    const endedCompetitions = await query.orderBy(competitions.endDate);

    // Filter out excluded competitions (note: pattern used for logging purposes)
    const competitionsToProcess = endedCompetitions.filter(
      (comp) => !excludedCompetitionIds.includes(comp.id),
    );

    console.log(
      chalk.gray(
        `Found ${competitionsToProcess.length} ended competitions to process (${endedCompetitions.length} total, ${excludedCompetitionIds.length} excluded)`,
      ),
    );

    // Clear existing agent scores
    await db.delete(agentScore);
    console.log(chalk.gray("Cleared existing agent scores"));

    // Process each competition in chronological order
    for (const competition of competitionsToProcess) {
      console.log(
        chalk.gray(
          `Processing competition: ${competition.name} (${competition.id})`,
        ),
      );

      const leaderboard = await competitionRepo.findLeaderboardByCompetition(
        competition.id,
      );
      if (!leaderboard || leaderboard.length === 0) {
        console.log(chalk.yellow(`  No leaderboard entries found, skipping`));
        continue;
      }

      const currentRanks = await agentScoreRepo.getAllAgentRanks();
      const ratings: Record<string, Rating> = {};

      // Initialize ratings for all agents in the leaderboard
      for (const entry of leaderboard) {
        const agentId = entry.agentId;
        const existingRank = currentRanks.find((rank) => rank.id === agentId);
        if (existingRank) {
          ratings[agentId] = rating({
            mu: existingRank.mu,
            sigma: existingRank.sigma,
          });
        } else {
          ratings[agentId] = rating(); // use default
        }
      }

      const teams = leaderboard.map((entry) => [ratings[entry.agentId]!]);

      // Update ratings using the PlackettLuce model
      const updatedRatings = rate(teams);

      const batchUpdateData = leaderboard.map((entry, index) => {
        const agentId = entry.agentId;
        const r = updatedRatings[index]![0]!;

        // Calculate ordinal score scaled to match ELO range
        const value = ordinal(r, { alpha: 24, target: 1500 });

        return {
          agentId,
          mu: r.mu,
          sigma: r.sigma,
          ordinal: value,
        };
      });

      // Update agent scores (this will create/update records)
      await db.transaction(async (tx) => {
        for (const data of batchUpdateData) {
          await tx
            .insert(agentScore)
            .values({
              id: crypto.randomUUID(),
              ...data,
            })
            .onConflictDoUpdate({
              target: agentScore.agentId,
              set: {
                mu: data.mu,
                sigma: data.sigma,
                ordinal: data.ordinal,
                updatedAt: new Date(),
              },
            });
        }
      });

      console.log(
        chalk.gray(`  Updated scores for ${batchUpdateData.length} agents`),
      );
    }

    console.log(chalk.green("Agent score recalculation complete!"));
  } catch (error) {
    console.error(chalk.red("Error recalculating agent scores:"), error);
    throw error;
  }
}

/**
 * Compute ordinal score (copied from agentrank.service.ts)
 */
function ordinal(
  { mu, sigma }: Rating,
  options: {
    z?: number;
    alpha?: number;
    target?: number;
  } = {},
): number {
  const { z = 3.0, alpha = 1, target = 0 } = options;
  return alpha * (mu - z * sigma + target / alpha);
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
}

// Execute the script
main().catch((error) => {
  console.error(chalk.red("\n❌ Script failed:"), error);
  process.exit(1);
});
