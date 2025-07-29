import chalk from "chalk";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { Rating, rate, rating } from "openskill";
import * as readline from "readline";
import { parse } from "ts-command-line-args";

import { db } from "@/database/db.js";
import * as competitionRepo from "@/database/repositories/competition-repository.js";
import {
  competitionAgents,
  competitions,
} from "@/database/schema/core/defs.js";
import {
  agentScore,
  agentScoreHistory,
} from "@/database/schema/ranking/defs.js";

interface Args {
  competitions: string;
  execute?: boolean;
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
 * Check for missing agent score history entries
 */
async function checkMissingAgentScores(competitionId: string) {
  // Get active agents in the competition
  const activeAgents = await db
    .select({
      agentId: competitionAgents.agentId,
    })
    .from(competitionAgents)
    .where(
      and(
        eq(competitionAgents.competitionId, competitionId),
        eq(competitionAgents.status, "active"),
      ),
    );

  // Get existing agent score history for this competition
  const existingHistory = await db
    .select({
      agentId: agentScoreHistory.agentId,
    })
    .from(agentScoreHistory)
    .where(eq(agentScoreHistory.competitionId, competitionId));

  const existingAgentIds = new Set(existingHistory.map((h) => h.agentId));
  const missingAgents = activeAgents.filter(
    (a) => !existingAgentIds.has(a.agentId),
  );

  return {
    totalActiveAgents: activeAgents.length,
    missingAgents: missingAgents.map((a) => a.agentId),
  };
}

/**
 * Backfill agent scores for a specific competition
 */
async function backfillCompetitionScores(competitionId: string) {
  console.log(
    chalk.blue(`\nBackfilling scores for competition ${competitionId}...`),
  );

  const competition = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);

  if (!competition[0]) {
    console.log(chalk.red(`Competition ${competitionId} not found`));
    return;
  }

  const comp = competition[0];
  console.log(chalk.gray(`Competition: ${comp.name}`));

  // Get ALL active agents in this competition (not just those with leaderboard entries)
  const activeAgents = await db
    .select({
      agentId: competitionAgents.agentId,
    })
    .from(competitionAgents)
    .where(
      and(
        eq(competitionAgents.competitionId, competitionId),
        eq(competitionAgents.status, "active"),
      ),
    );

  if (activeAgents.length === 0) {
    console.log(chalk.yellow(`No active agents found, skipping`));
    return;
  }

  console.log(chalk.gray(`Processing ${activeAgents.length} active agents`));

  // Get the leaderboard for this competition (might be incomplete)
  const leaderboard =
    await competitionRepo.findLeaderboardByCompetition(competitionId);

  // Create a map for easy lookup of leaderboard positions
  const leaderboardMap = new Map<string, number>();
  if (leaderboard) {
    leaderboard.forEach((entry, index) => {
      leaderboardMap.set(entry.agentId, index);
    });
  }

  // Get the agent ranks as they were BEFORE this competition
  // We need to look at the most recent score history BEFORE this competition's end date
  const previousScoresRaw = await db.execute(sql`
    WITH previous_scores AS (
      SELECT DISTINCT ON (ash.agent_id)
        ash.agent_id,
        ash.mu,
        ash.sigma,
        ash.ordinal
      FROM agent_score_history ash
      JOIN competitions c ON ash.competition_id = c.id
      WHERE c.end_date < ${comp.endDate}
      ORDER BY ash.agent_id, c.end_date DESC
    )
    SELECT * FROM previous_scores
  `);

  const ratings: Record<string, Rating> = {};

  // Initialize ratings from previous competition results
  for (const row of previousScoresRaw.rows) {
    const agentId = String(row.agent_id);
    ratings[agentId] = rating({
      mu: Number(row.mu),
      sigma: Number(row.sigma),
    });
  }

  // For all active agents, ensure they have ratings
  for (const agent of activeAgents) {
    if (!ratings[agent.agentId]) {
      ratings[agent.agentId] = rating(); // use default rating
    }
  }

  // If we have leaderboard data, use it to calculate new scores
  let batchUpdateData: Array<{
    agentId: string;
    competitionId: string;
    mu: number;
    sigma: number;
    ordinal: number;
  }> = [];

  if (leaderboard && leaderboard.length > 0) {
    // Create teams array based on leaderboard order
    const teams = leaderboard.map((entry) => [ratings[entry.agentId]!]);

    // Update ratings using the PlackettLuce model
    const updatedRatings = rate(teams);

    // Create update data for agents in the leaderboard
    const leaderboardUpdates = leaderboard.map((entry, index) => {
      const agentId = entry.agentId;
      const r = updatedRatings[index]![0]!;

      // Calculate ordinal score scaled to match ELO range
      const value = ordinal(r, { alpha: 24, target: 1500 });

      return {
        agentId,
        competitionId,
        mu: r.mu,
        sigma: r.sigma,
        ordinal: value,
      };
    });

    // For agents not in the leaderboard, keep their previous scores (or defaults)
    const missingAgentUpdates = activeAgents
      .filter((agent) => !leaderboardMap.has(agent.agentId))
      .map((agent) => {
        const prevRating = ratings[agent.agentId]!;
        return {
          agentId: agent.agentId,
          competitionId,
          mu: prevRating.mu,
          sigma: prevRating.sigma,
          ordinal: ordinal(prevRating, { alpha: 24, target: 1500 }),
        };
      });

    batchUpdateData = [...leaderboardUpdates, ...missingAgentUpdates];
  } else {
    // No leaderboard data - all agents keep their previous scores
    console.log(
      chalk.yellow(
        `No leaderboard data found - using previous scores for all agents`,
      ),
    );
    batchUpdateData = activeAgents.map((agent) => {
      const prevRating = ratings[agent.agentId]!;
      return {
        agentId: agent.agentId,
        competitionId,
        mu: prevRating.mu,
        sigma: prevRating.sigma,
        ordinal: ordinal(prevRating, { alpha: 24, target: 1500 }),
      };
    });
  }

  // Insert/update agent score history
  await db.transaction(async (tx) => {
    for (const data of batchUpdateData) {
      // Delete existing history entry if it exists
      await tx
        .delete(agentScoreHistory)
        .where(
          and(
            eq(agentScoreHistory.agentId, data.agentId),
            eq(agentScoreHistory.competitionId, competitionId),
          ),
        );

      // Insert new history entry
      await tx.insert(agentScoreHistory).values({
        id: crypto.randomUUID(),
        agentId: data.agentId,
        competitionId: data.competitionId,
        mu: data.mu,
        sigma: data.sigma,
        ordinal: data.ordinal,
      });
    }
  });

  console.log(
    chalk.gray(`Backfilled scores for ${batchUpdateData.length} agents`),
  );

  // Log details about what was backfilled
  const inLeaderboard = batchUpdateData.filter((d) =>
    leaderboardMap.has(d.agentId),
  ).length;
  const notInLeaderboard = batchUpdateData.length - inLeaderboard;
  if (notInLeaderboard > 0) {
    console.log(chalk.gray(`  - ${inLeaderboard} agents from leaderboard`));
    console.log(
      chalk.gray(
        `  - ${notInLeaderboard} agents not in leaderboard (kept previous scores)`,
      ),
    );
  }
}

/**
 * Update agent_score table with latest values from history
 */
async function updateAgentScoresFromHistory(
  excludedCompetitionIds: string[] = [],
) {
  console.log(chalk.blue("\nUpdating agent scores from history..."));

  // Get the most recent score history for each agent
  let latestScoresQuery = sql`
    WITH latest_scores AS (
      SELECT DISTINCT ON (agent_id)
        agent_id,
        mu,
        sigma,
        ordinal,
        created_at
      FROM agent_score_history
      `;

  // Add WHERE clause if we have exclusions
  if (excludedCompetitionIds.length > 0) {
    latestScoresQuery = sql`${latestScoresQuery}
      WHERE competition_id NOT IN (${sql.join(
        excludedCompetitionIds.map((id) => sql`${id}`),
        sql`, `,
      )})`;
  }

  latestScoresQuery = sql`${latestScoresQuery}
      ORDER BY agent_id, created_at DESC
    )
    SELECT * FROM latest_scores`;

  const latestScoresRaw = await db.execute(latestScoresQuery);

  // Transform the results
  const latestScores = latestScoresRaw.rows.map((row) => ({
    agentId: String(row.agent_id),
    mu: Number(row.mu),
    sigma: Number(row.sigma),
    ordinal: Number(row.ordinal),
  }));

  console.log(
    chalk.gray(`Found ${latestScores.length} agents with score history`),
  );

  // Clear and repopulate agent scores
  await db.delete(agentScore);
  console.log(chalk.gray("Cleared existing agent scores"));

  if (latestScores.length > 0) {
    await db.transaction(async (tx) => {
      for (const row of latestScores) {
        await tx.insert(agentScore).values({
          id: crypto.randomUUID(),
          agentId: row.agentId,
          mu: row.mu,
          sigma: row.sigma,
          ordinal: row.ordinal,
        });
      }
    });

    console.log(
      chalk.gray(
        `Updated scores for ${latestScores.length} agents from history`,
      ),
    );
  }

  console.log(chalk.green("Agent score update complete!"));
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
      description:
        "Comma-separated list of competition IDs to check and backfill",
    },
    execute: {
      type: Boolean,
      optional: true,
      description: "Execute the backfill (default is dry-run)",
    },
    exclude: {
      type: String,
      optional: true,
      description:
        "Comma-separated list of competition IDs to exclude from global rank calculations",
    },
  });

  const competitionIds = args.competitions.split(",").map((id) => id.trim());
  const excludedCompetitionIds = args.exclude
    ? args.exclude.split(",").map((id) => id.trim())
    : [];
  const isDryRun = !args.execute;

  console.log(chalk.bold("\n🔧  Agent Score Backfill Script"));
  console.log(chalk.gray("====================================\n"));

  if (isDryRun) {
    console.log(
      chalk.yellow("⚠️  Running in DRY RUN mode - no changes will be made"),
    );
    console.log(
      chalk.yellow("   Add --execute flag to perform actual backfill\n"),
    );
  } else {
    console.log(
      chalk.red("⚠️  Running in EXECUTE mode - scores WILL be updated!\n"),
    );
  }

  if (excludedCompetitionIds.length > 0) {
    console.log(
      chalk.blue("📌 Excluding competitions from global rank calculations:"),
    );
    console.log(chalk.gray(`   ${excludedCompetitionIds.join(", ")}\n`));
  }

  // Check for missing agent scores
  console.log(chalk.blue("Checking for missing agent scores..."));

  const competitionsToBackfill: string[] = [];
  let foundMissingData = false;
  let firstMissingIndex = -1; // Track when we first find missing data

  // Get all competitions for our list of competitionIds—and sort chronologically, in case we need
  // to recalculate scores for a competition that depends on the previous one.
  const competitionsSorted = await db
    .select()
    .from(competitions)
    .where(inArray(competitions.id, competitionIds))
    .orderBy(asc(competitions.endDate));

  console.log(
    chalk.gray(
      `\nProcessing ${competitionsSorted.length} competitions in chronological order...`,
    ),
  );

  for (const competition of competitionsSorted) {
    const competitionId = competition.id;
    console.log(`\n${chalk.bold(competitionId)}: ${competition.name}`);
    console.log(chalk.gray(`  Status: ${competition.status}`));
    console.log(chalk.gray(`  End date: ${competition.endDate || "Not set"}`));

    if (competition.status !== "ended") {
      console.log(chalk.yellow(`  ⚠️  Competition is not ended, skipping`));
      continue;
    }

    const missingInfo = await checkMissingAgentScores(competitionId);
    console.log(
      chalk.gray(`  Active agents: ${missingInfo.totalActiveAgents}`),
    );
    console.log(
      chalk.gray(`  Missing scores: ${missingInfo.missingAgents.length}`),
    );

    // If we've already found missing data, or this competition has missing data
    if (foundMissingData || missingInfo.missingAgents.length > 0) {
      if (missingInfo.missingAgents.length > 0) {
        console.log(
          chalk.yellow(
            `  ⚠️  Missing agents: ${missingInfo.missingAgents.join(", ")}`,
          ),
        );
        foundMissingData = true; // Mark that we found missing data
        if (firstMissingIndex === -1) {
          firstMissingIndex = competitionsSorted.findIndex(
            (c) => c.id === competitionId,
          );
        }
      } else {
        console.log(
          chalk.yellow(
            `  ⚠️  Requires recalculation due to previous competition changes`,
          ),
        );
      }
      competitionsToBackfill.push(competitionId);
    } else {
      console.log(chalk.green(`  ✓ All agent scores present`));
    }
  }

  if (competitionsToBackfill.length === 0) {
    console.log(chalk.green("\n✅ No missing agent scores found!"));
    process.exit(0);
  }

  // Confirmation
  if (!isDryRun) {
    console.log(
      chalk.yellow(
        `\n⚠️  Will backfill scores for ${competitionsToBackfill.length} competition(s)`,
      ),
    );

    // Count how many competitions are affected by cascade
    // All competitions after the first one with missing data need recalculation
    const cascadeCount =
      firstMissingIndex >= 0
        ? competitionsSorted.length - firstMissingIndex - 1
        : 0;

    if (cascadeCount > 0) {
      console.log(
        chalk.yellow(
          `   Including ${cascadeCount} competition(s) that need recalculation due to earlier changes`,
        ),
      );
    }

    const confirmed = await promptConfirmation(
      "\nAre you sure you want to proceed?",
    );
    if (!confirmed) {
      console.log(chalk.red("\n❌ Backfill cancelled"));
      process.exit(0);
    }
  }

  // Backfill missing scores
  if (!isDryRun) {
    console.log(chalk.blue("\nBackfilling scores..."));
    console.log(
      chalk.gray(
        `Processing ${competitionsToBackfill.length} competitions in order\n`,
      ),
    );

    // IMPORTANT: We must process competitions in chronological order
    // Since we've already sorted competitionsSorted, we need to maintain that order
    const sortedBackfillIds = competitionsSorted
      .filter((comp) => competitionsToBackfill.includes(comp.id))
      .map((comp) => comp.id);

    for (const competitionId of sortedBackfillIds) {
      await backfillCompetitionScores(competitionId);
    }

    // Update agent_score table with latest values
    await updateAgentScoresFromHistory(excludedCompetitionIds);
  }

  console.log(
    chalk.green(`\n✅ ${isDryRun ? "Dry run" : "Backfill"} complete!`),
  );

  if (isDryRun) {
    console.log(
      chalk.yellow("\nTo execute the backfill, run with --execute flag"),
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
