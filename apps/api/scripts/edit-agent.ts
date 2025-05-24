/**
 * Agent Edit Script
 *
 * This script allows admins to edit existing team information in the Trading Simulator.
 * It connects directly to the database and does NOT require the server to be running.
 *
 * Usage:
 *   pnpm edit:team
 *
 * Or with command line arguments:
 *   pnpm edit:agent -- "agentId" "0x123..." "New Agent Name"
 *
 * The script will:
 * 1. Connect to the database
 * 2. Find the team by email
 * 3. Update the team's wallet address and/or bucket addresses
 * 4. Close the database connection
 */
import * as dotenv from "dotenv";
import { eq } from "drizzle-orm";
import * as path from "path";
import * as readline from "readline";

import { db } from "@/database/db.js";
import { agents } from "@/database/schema/core/defs.js";

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
  // Add some visual highlighting to make the prompt stand out
  const highlightedQuestion = `\n${colors.cyan}>> ${question}${colors.reset}`;
  return new Promise((resolve) => {
    rl.question(highlightedQuestion, (answer) => {
      resolve(answer);
    });
  });
}

// Safe console log that won't be overridden
function safeLog(...args: unknown[]) {
  originalConsoleLog.apply(console, args);
}

// Store original console.log
const originalConsoleLog = console.log;

// Validate Ethereum address
function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Edit an existing team
 */
async function editAgent() {
  try {
    // Banner with clear visual separation
    safeLog("\n\n");
    safeLog(
      `${colors.magenta}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    safeLog(
      `${colors.magenta}║                          EDIT AGENT                            ║${colors.reset}`,
    );
    safeLog(
      `${colors.magenta}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    safeLog(
      `\n${colors.cyan}This script allows you to edit team information in the Trading Simulator.${colors.reset}`,
    );
    safeLog(
      `${colors.cyan}You can update the team's wallet address and bucket addresses.${colors.reset}`,
    );
    safeLog(
      `${colors.yellow}--------------------------------------------------------------${colors.reset}\n`,
    );

    // Get team details from command line arguments or prompt for them
    let agentId = process.argv[2];
    let walletAddress = process.argv[3];
    let agentName = process.argv[4];

    // Temporarily restore console.log for input
    console.log = originalConsoleLog;

    // Collect all input upfront before database operations
    if (!agentId) {
      agentId = await prompt("Enter agent ID to find the agent:");
      if (!agentId) {
        throw new Error("Agent ID is required");
      }
    }

    // Apply the quieter console.log during database operations
    console.log = function (...args) {
      // Only log critical errors, or explicit service messages
      if (typeof args[0] === "string" && args[0].includes("Error")) {
        originalConsoleLog.apply(console, args);
      }
    };

    // Find the team first
    safeLog(
      `\n${colors.blue}Finding agent with ID: ${agentId}...${colors.reset}`,
    );

    // Fetch the team by email
    const currentAgent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
    });

    if (!currentAgent) {
      throw new Error(`No agent found with ID: ${agentId}`);
    }

    safeLog(
      `\n${colors.green}✓ Agent found: ${currentAgent.name}${colors.reset}`,
    );
    safeLog(`\n${colors.cyan}Current Agent Details:${colors.reset}`);
    safeLog(
      `${colors.cyan}----------------------------------------${colors.reset}`,
    );
    safeLog(`Agent ID: ${currentAgent.id}`);
    safeLog(`Agent Name: ${currentAgent.name}`);
    safeLog(
      `Agent's Wallet Address: ${currentAgent.walletAddress || "Not set"}`,
    );
    safeLog(
      `${colors.cyan}----------------------------------------${colors.reset}`,
    );

    const updateWallet =
      !walletAddress &&
      (await prompt(`Do you want to update the wallet address? (y/n):`));

    if (
      (updateWallet &&
        typeof updateWallet === "string" &&
        updateWallet.toLowerCase() === "y") ||
      walletAddress
    ) {
      if (!walletAddress) {
        walletAddress = await prompt("Enter new wallet address (0x...): ");
      }

      if (walletAddress && !isValidEthereumAddress(walletAddress)) {
        throw new Error(
          "Invalid Ethereum address format. Must be 0x followed by 40 hex characters.",
        );
      }
    }

    const updateName =
      !agentName &&
      (await prompt(`Do you want to update the agent name? (y/n):`));

    if (
      (updateName &&
        typeof updateName === "string" &&
        updateName.toLowerCase() === "y") ||
      agentName
    ) {
      if (!agentName) {
        agentName = await prompt("Enter new agent name: ");
      }

      if (agentName && !isValidEthereumAddress(agentName)) {
        throw new Error(
          "Invalid agent name format. Must be 0x followed by 40 hex characters.",
        );
      }
    }

    if (!walletAddress && !agentName) {
      safeLog(
        `\n${colors.yellow}No changes requested. Operation cancelled.${colors.reset}`,
      );
      return;
    }

    // Display summary of changes
    safeLog(`\n${colors.yellow}Changes to be applied:${colors.reset}`);
    if (walletAddress) {
      safeLog(`- Wallet Address: ${walletAddress}`);
    }
    if (agentName) {
      safeLog(`- Agent Name: ${agentName}`);
    }

    const confirmUpdate = await prompt(
      `${colors.yellow}Proceed with these changes? (y/n):${colors.reset}`,
    );

    if (confirmUpdate.toLowerCase() !== "y") {
      safeLog(`\n${colors.red}Update cancelled.${colors.reset}`);
      return;
    }

    // Proceed with updates
    safeLog(`\n${colors.blue}Updating team...${colors.reset}`);

    const updatedAgent = await db.transaction(async (tx) => {
      // Get the latest team data since some time has passed
      const agent = await tx.query.agents.findFirst({
        where: eq(agents.id, agentId),
      });
      if (!agent) {
        tx.rollback();
        return;
      }
      const [result] = await tx
        .update(agents)
        .set({
          walletAddress,
          name: agentName,
        })
        .where(eq(agents.id, agent.id))
        .returning();
      return result;
    });

    if (updatedAgent) {
      safeLog(`\n${colors.green}✓ Agent updated successfully!${colors.reset}`);
      safeLog(`\n${colors.cyan}Updated Agent Details:${colors.reset}`);
      safeLog(
        `${colors.cyan}----------------------------------------${colors.reset}`,
      );
      safeLog(`Agent ID: ${updatedAgent.id}`);
      safeLog(`Agent Name: ${updatedAgent.name}`);
      safeLog(`Wallet Address: ${updatedAgent.walletAddress || "Not set"}`);
      safeLog(
        `${colors.cyan}----------------------------------------${colors.reset}`,
      );
    }
  } catch (error) {
    safeLog(
      `\n${colors.red}Error updating team:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );
  } finally {
    rl.close();

    // Restore original console.log before closing
    console.log = originalConsoleLog;

    // Exit the process after clean closure
    process.exit(0);
  }
}

// Run the edit function
editAgent();
