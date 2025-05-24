/**
 * Team Registration Script
 *
 * This script registers a new team in the Trading Simulator.
 * It connects directly to the database and does NOT require the server to be running.
 *
 * Usage:
 *   pnpm register:agent
 *
 * Or with command line arguments:
 *   pnpm register:agent -- "Agent Name" "0xWalletAddress"
 *
 * The script will:
 * 1. Connect to the database
 * 2. Create a new agent with API credentials using the AgentManager service
 * 3. Update the agent with the wallet address using database connection
 * 4. Display the API key (only shown once)
 * 5. Close the database connection
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as readline from "readline";

import { ServiceRegistry } from "@/services/index.js";

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
 * Register a new team using AgentManager service and update with wallet address
 */
async function registerAgent() {
  try {
    // Banner with clear visual separation
    safeLog("\n\n");
    safeLog(
      `${colors.magenta}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    safeLog(
      `${colors.magenta}║                      REGISTER NEW AGENT                      ║${colors.reset}`,
    );
    safeLog(
      `${colors.magenta}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    safeLog(
      `\n${colors.cyan}This script will register a new agent in the Trading Simulator.${colors.reset}`,
    );
    safeLog(
      `${colors.cyan}You'll need to provide the owner's wallet address, and agent name.${colors.reset}`,
    );
    safeLog(
      `${colors.yellow}--------------------------------------------------------------${colors.reset}\n`,
    );

    // Get team details from command line arguments or prompt for them
    let agentName = process.argv[2];
    let walletAddress = process.argv[3];

    // Temporarily restore console.log for input
    console.log = originalConsoleLog;

    // Collect all input upfront before database operations
    if (!agentName) {
      agentName = await prompt("Enter agent name: ");
      if (!agentName) {
        throw new Error("Agent name is required");
      }
    }

    if (!walletAddress) {
      walletAddress = await prompt("Enter wallet address (0x...): ");
      if (!walletAddress) {
        throw new Error("Wallet address is required");
      }

      if (!isValidEthereumAddress(walletAddress)) {
        throw new Error(
          "Invalid Ethereum address format. Must be 0x followed by 40 hex characters.",
        );
      }
    } else if (!isValidEthereumAddress(walletAddress)) {
      throw new Error(
        "Invalid Ethereum address format. Must be 0x followed by 40 hex characters.",
      );
    }

    safeLog(
      `\n${colors.yellow}Registering agent with the following details:${colors.reset}`,
    );
    safeLog(`- Agent Name: ${agentName}`);
    safeLog(`- Owner's Wallet Address: ${walletAddress}`);

    const confirmRegistration = await prompt(
      `${colors.yellow}Proceed with registration? (y/n): ${colors.reset}`,
    );

    if (confirmRegistration.toLowerCase() !== "y") {
      safeLog(`\n${colors.red}Registration cancelled.${colors.reset}`);
      return;
    }

    // Apply the quieter console.log during database operations
    console.log = function (...args) {
      // Only log critical errors, or explicit service messages
      if (typeof args[0] === "string" && args[0].includes("Error")) {
        originalConsoleLog.apply(console, args);
      }
    };

    safeLog(`\n${colors.blue}Registering agent...${colors.reset}`);

    // Register the team using the updated TeamManager service method
    const owner =
      await services.userManager.getUserByWalletAddress(walletAddress);
    if (!owner) {
      throw new Error("Owner not found");
    }

    const agent = await services.agentManager.createAgent(owner.id, agentName);

    safeLog(`\n${colors.green}✓ Agent registered successfully!${colors.reset}`);
    safeLog(`\n${colors.cyan}Agent Details:${colors.reset}`);
    safeLog(
      `${colors.cyan}----------------------------------------${colors.reset}`,
    );
    safeLog(`Agent ID: ${agent.id}`);
    safeLog(`Agent Name: ${agent.name}`);
    safeLog(`Owner ID: ${owner.id}`);
    safeLog(`Owner Wallet Address: ${owner.walletAddress}`);
    safeLog(
      `${colors.cyan}----------------------------------------${colors.reset}`,
    );

    safeLog(
      `\n${colors.yellow}API Credentials (SAVE THESE SECURELY):${colors.reset}`,
    );
    safeLog(
      `${colors.yellow}----------------------------------------${colors.reset}`,
    );
    safeLog(`API Key: ${agent.apiKey}`); // Using apiKey from the team object returned by AgentManager
    safeLog(
      `${colors.yellow}----------------------------------------${colors.reset}`,
    );

    safeLog(
      `\n${colors.red}IMPORTANT: The API Key will only be shown once when the team is first created.${colors.reset}`,
    );
    safeLog(`Make sure to securely store these credentials.`);
  } catch (error) {
    safeLog(
      `\n${colors.red}Error registering team:${colors.reset}`,
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

// Run the registration function
registerAgent();
