import * as dotenv from "dotenv";
import * as path from "path";
import * as readline from "readline";

import {
  batchInsertLeaderboard,
  getBulkAgentCompetitionRankings,
} from "@/database/repositories/competition-repository.js";
import { ServiceRegistry } from "@/services/index.js";
import { COMPETITION_STATUS } from "@/types/index.js";

const services = new ServiceRegistry();

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Create readline interface for prompting user
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Colors for console output
const colors = {
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  reset: "\x1b[0m",
};

// Prompt function that returns a promise
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}
/**
 * Calculate PnL for an agent in a specific competition using portfolio snapshots
 * This replicates the logic from AgentManager.getAgentPnlForComp
 */
async function calculateBulkAgentPnl(
  agentIds: string[],
  competitionId: string,
): Promise<Map<string, { pnl: number; rank: number; totalAgents: number }>> {
  try {
    // Get agent's ranking in this competition
    const rankings = await getBulkAgentCompetitionRankings(
      competitionId,
      agentIds,
    );
    const pnlMap = new Map<
      string,
      { pnl: number; rank: number; totalAgents: number }
    >();
    for (const agentId of agentIds) {
      const ranking = rankings.get(agentId);
      if (!ranking) {
        throw new Error(
          `No ranking found for agent ${agentId} in competition ${competitionId}`,
        );
      }
      const { rank, totalAgents } = ranking;
      const { pnl } = await services.agentManager.getAgentPnlForComp(
        agentId,
        competitionId,
      );
      pnlMap.set(agentId, { pnl, rank, totalAgents });
    }

    return pnlMap;
  } catch (error) {
    console.error(
      `${colors.red}Error calculating PnL for agents ${agentIds.join(
        ", ",
      )}:${colors.reset}`,
      error,
    );
    throw error;
  }
}

/**
 * Backfill PnL data for all agents in a competition's leaderboard
 */
async function backfillCompetitionPnl() {
  try {
    console.log(
      `${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.cyan}║                  BACKFILL COMPETITION PNL                     ║${colors.reset}`,
    );
    console.log(
      `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    console.log(
      `\nThis script will recalculate and update PnL values for all agents in a competition's leaderboard.`,
    );
    console.log(
      `${colors.magenta}----------------------------------------${colors.reset}`,
    );

    const continueOperation = await prompt(
      `${colors.yellow}Are you sure you want to continue? (y/n):${colors.reset} `,
    );
    if (continueOperation.toLowerCase() !== "y") {
      console.log(`${colors.red}Operation cancelled.${colors.reset}`);
      return;
    }

    console.log(
      `${colors.magenta}----------------------------------------${colors.reset}`,
    );

    const competitions = await services.competitionManager.getAllCompetitions();
    const endedCompetitions = competitions.filter(
      (c) => c.status === COMPETITION_STATUS.ENDED,
    );
    for (const competition of endedCompetitions) {
      const agentIds =
        await services.competitionManager.getAllCompetitionAgents(
          competition.id,
        );
      const pnlMap = await calculateBulkAgentPnl(agentIds, competition.id);
      const sortedPnlMap = new Map(
        [...pnlMap.entries()].sort((a, b) => a[1].rank - b[1].rank),
      );
      for (const [
        agentId,
        { pnl, rank, totalAgents },
      ] of sortedPnlMap.entries()) {
        await batchInsertLeaderboard([
          {
            agentId,
            competitionId: competition.id,
            rank,
            totalAgents,
            score: pnl,
            pnl,
          },
        ]);
      }
    }

    console.log(
      `${colors.magenta}----------------------------------------${colors.reset}`,
    );
    console.log(
      `${colors.green}Backfilling competition PnL completed${colors.reset}`,
    );
  } catch (error) {
    console.error(
      `\n${colors.red}Error backfilling competition PnL:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );
  } finally {
    rl.close();

    // Exit the process after clean closure
    process.exit(0);
  }
}

// Run the function
backfillCompetitionPnl();
