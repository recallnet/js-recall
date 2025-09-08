/**
 * Reset Agent Portfolio Script
 *
 * This script resets an agent's balances and deletes their trades and portfolio snapshots
 * for a specific competition, with an optional parameter to ignore a specific snapshot.
 *
 * Usage:
 *   cd apps/api && pnpm tsx scripts/reset-competition-agent.ts
 *
 * The script will:
 * 1. Reset the agent's balances using BalanceManager
 * 2. Delete all trades for the agent in the specified competition
 * 3. Delete portfolio snapshots for the agent in the specified competition
 * 4. Optionally preserve a specific portfolio snapshot if provided
 */
import * as dotenv from "dotenv";
import { and, eq, ne } from "drizzle-orm";
import * as path from "path";
import * as readline from "readline";

import { portfolioSnapshots, trades } from "@recallnet/db-schema/trading/defs";

import { db } from "@/database/db.js";
import { ServiceRegistry } from "@/services/index.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const services = new ServiceRegistry();

// Colors for console output
const colors = {
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

/**
 * Create a readline interface for user input
 */
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt function that returns a promise
 */
function prompt(question: string): Promise<string> {
  const rl = createReadlineInterface();
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Ask user for confirmation
 */
async function askForConfirmation(message: string): Promise<boolean> {
  const answer = await prompt(`${message} (y/N): `);
  return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
}

/**
 * Validate environment setup
 */
function validateEnvironment(): boolean {
  if (!process.env.DATABASE_URL) {
    console.log(
      `${colors.red}❌ DATABASE_URL environment variable is required${colors.reset}`,
    );
    return false;
  }

  return true;
}

/**
 * Display script header
 */
function displayHeader(): void {
  console.log(
    `${colors.cyan}${colors.bold}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
  );
  console.log(
    `${colors.cyan}${colors.bold}║                   RESET AGENT PORTFOLIO                        ║${colors.reset}`,
  );
  console.log(
    `${colors.cyan}${colors.bold}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
  );
}

/**
 * Reset agent portfolio
 */
async function resetAgentPortfolio(
  agentId: string,
  competitionId: string,
  ignoreSnapshotId?: number,
): Promise<void> {
  try {
    // First, verify the agent exists
    console.log(`\n${colors.blue}Verifying agent exists...${colors.reset}`);
    const agent = await services.agentManager.getAgent(agentId);

    if (!agent) {
      console.log(
        `${colors.red}❌ Agent with ID ${agentId} not found${colors.reset}`,
      );
      return;
    }

    console.log(`${colors.green}✓ Agent found: ${agent.name}${colors.reset}`);

    // Get portfolio snapshots count before deletion
    console.log(
      `\n${colors.blue}Checking portfolio snapshots...${colors.reset}`,
    );

    let whereConditions = and(
      eq(portfolioSnapshots.agentId, agentId),
      eq(portfolioSnapshots.competitionId, competitionId),
    );

    // Add ignore condition if snapshot ID is provided
    if (ignoreSnapshotId) {
      whereConditions = and(
        whereConditions,
        ne(portfolioSnapshots.id, ignoreSnapshotId),
      );
    }

    const snapshotsToDelete = await db
      .select()
      .from(portfolioSnapshots)
      .where(whereConditions);

    console.log(
      `${colors.yellow}Found ${snapshotsToDelete.length} portfolio snapshot(s) to delete${colors.reset}`,
    );

    if (ignoreSnapshotId) {
      console.log(
        `${colors.cyan}(Ignoring snapshot ID: ${ignoreSnapshotId})${colors.reset}`,
      );
    }

    // Get trades count before deletion
    console.log(`\n${colors.blue}Checking trades...${colors.reset}`);

    const tradesToDelete = await db
      .select()
      .from(trades)
      .where(
        and(
          eq(trades.agentId, agentId),
          eq(trades.competitionId, competitionId),
        ),
      );

    console.log(
      `${colors.yellow}Found ${tradesToDelete.length} trade(s) to delete${colors.reset}`,
    );

    // Display warning and get confirmation
    console.log(
      `\n${colors.yellow}${colors.bold}⚠️  WARNING: This will:${colors.reset}`,
    );
    console.log(
      `${colors.yellow}   1. Reset agent balances to initial values${colors.reset}`,
    );
    console.log(
      `${colors.yellow}   2. Delete ${snapshotsToDelete.length} portfolio snapshot(s)${colors.reset}`,
    );
    console.log(
      `${colors.yellow}   3. Delete ${tradesToDelete.length} trade(s)${colors.reset}`,
    );
    console.log(
      `${colors.yellow}   This action cannot be undone!${colors.reset}`,
    );

    const confirmed = await askForConfirmation(
      `\n${colors.cyan}${colors.bold}Do you want to proceed?${colors.reset}`,
    );

    if (!confirmed) {
      console.log(`\n${colors.red}Operation cancelled by user.${colors.reset}`);
      return;
    }

    // Reset agent balances
    console.log(`\n${colors.blue}Resetting agent balances...${colors.reset}`);

    await services.balanceManager.resetAgentBalances(agentId);
    console.log(
      `${colors.green}✓ Agent balances reset successfully${colors.reset}`,
    );

    // Delete portfolio snapshots
    if (snapshotsToDelete.length > 0) {
      console.log(
        `\n${colors.blue}Deleting portfolio snapshots...${colors.reset}`,
      );

      await db.delete(portfolioSnapshots).where(whereConditions);

      console.log(
        `${colors.green}✓ Deleted ${snapshotsToDelete.length} portfolio snapshot(s) successfully${colors.reset}`,
      );
    }

    // Delete trades
    if (tradesToDelete.length > 0) {
      console.log(`\n${colors.blue}Deleting trades...${colors.reset}`);

      await db
        .delete(trades)
        .where(
          and(
            eq(trades.agentId, agentId),
            eq(trades.competitionId, competitionId),
          ),
        );

      console.log(
        `${colors.green}✓ Deleted ${tradesToDelete.length} trade(s) successfully${colors.reset}`,
      );
    }

    // Display summary
    console.log(
      `\n${colors.green}${colors.bold}✓ Portfolio reset completed successfully!${colors.reset}`,
    );
    console.log(`\n${colors.cyan}Summary:${colors.reset}`);
    console.log(`  - Agent: ${agent.name} (${agentId})`);
    console.log(`  - Competition: ${competitionId}`);
    console.log(`  - Balances: Reset to initial values`);
    console.log(`  - Snapshots deleted: ${snapshotsToDelete.length}`);
    console.log(`  - Trades deleted: ${tradesToDelete.length}`);
    if (ignoreSnapshotId) {
      console.log(`  - Ignored snapshot ID: ${ignoreSnapshotId}`);
    }
  } catch (error) {
    console.error(
      `\n${colors.red}${colors.bold}❌ Error resetting agent portfolio:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );
    throw error;
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    displayHeader();

    // Validate environment
    if (!validateEnvironment()) {
      console.log(
        `\n${colors.red}${colors.bold}❌ Environment validation failed. Exiting.${colors.reset}`,
      );
      process.exit(1);
    }

    console.log(
      `\n${colors.green}✓ Database connection configured${colors.reset}`,
    );

    console.log(
      `\nThis script will reset an agent's balances and delete their portfolio snapshots.`,
    );

    // Get agent ID
    const agentId = await prompt(
      `\n${colors.yellow}Enter the Agent ID:${colors.reset} `,
    );

    if (!agentId) {
      console.log(
        `\n${colors.red}No agent ID provided. Operation cancelled.${colors.reset}`,
      );
      return;
    }

    // Get competition ID
    const competitionId = await prompt(
      `${colors.yellow}Enter the Competition ID:${colors.reset} `,
    );

    if (!competitionId) {
      console.log(
        `\n${colors.red}No competition ID provided. Operation cancelled.${colors.reset}`,
      );
      return;
    }

    // Get optional ignore snapshot ID
    const ignoreSnapshotIdStr = await prompt(
      `${colors.yellow}Enter Portfolio Snapshot ID to ignore (optional, press Enter to skip):${colors.reset} `,
    );

    let ignoreSnapshotId: number | undefined;
    if (ignoreSnapshotIdStr) {
      ignoreSnapshotId = parseInt(ignoreSnapshotIdStr, 10);
      if (isNaN(ignoreSnapshotId)) {
        console.log(
          `\n${colors.red}Invalid snapshot ID. Must be a number.${colors.reset}`,
        );
        return;
      }
    }

    // Execute the reset
    await resetAgentPortfolio(agentId, competitionId, ignoreSnapshotId);
  } catch (error) {
    console.error(
      `\n${colors.red}${colors.bold}Fatal error:${colors.reset}`,
      error,
    );
    process.exit(1);
  }
}

// Run the main function
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(
      `${colors.red}${colors.bold}Fatal error:${colors.reset}`,
      error,
    );
    process.exit(1);
  });
