/**
 * Reset All Agent API Keys Script
 *
 * This script resets the API keys for all agents in the database.
 * It connects to a specific database and uses a specific ROOT_ENCRYPTION_KEY.
 *
 * Usage:
 *   cd apps/api && pnpm tsx scripts/reset-all-agent-api-keys.ts
 *
 * The script will:
 * 1. Connect to the specified database
 * 2. Load all agents from the database
 * 3. Reset each agent's API key using the AgentManager service
 * 4. Display the results with success/failure counts
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as readline from "readline";

import { findAll as findAllAgents } from "@/database/repositories/agent-repository.js";
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
 * Ask user for confirmation
 */
async function askForConfirmation(): Promise<boolean> {
  const rl = createReadlineInterface();

  return new Promise((resolve) => {
    rl.question(
      `\n${colors.cyan}${colors.bold}Do you want to proceed? (y/N): ${colors.reset}`,
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
      },
    );
  });
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

  if (!process.env.ROOT_ENCRYPTION_KEY) {
    console.log(
      `${colors.red}❌ ROOT_ENCRYPTION_KEY environment variable is required${colors.reset}`,
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
    `${colors.cyan}${colors.bold}║                    RESET ALL AGENT API KEYS                    ║${colors.reset}`,
  );
  console.log(
    `${colors.cyan}${colors.bold}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
  );
}

/**
 * Display environment status
 */
function displayEnvironmentStatus(): void {
  console.log(
    `\n${colors.green}✓ Database connection configured${colors.reset}`,
  );
  console.log(`${colors.green}✓ Encryption key configured${colors.reset}`);
}

/**
 * Display progress bar
 */
function displayProgress(
  current: number,
  total: number,
  agentName: string,
): void {
  const percentage = Math.round((current / total) * 100);
  const progressBar =
    "█".repeat(Math.round(percentage / 5)) +
    "░".repeat(20 - Math.round(percentage / 5));

  console.log(
    `\n${colors.cyan}[${current}/${total}] ${colors.bold}${agentName}${colors.reset}`,
  );
  console.log(`${colors.dim}${progressBar} ${percentage}%${colors.reset}`);
}

/**
 * Display summary
 */
function displaySummary(
  successCount: number,
  errorCount: number,
  total: number,
): void {
  console.log(
    `\n${colors.cyan}${colors.bold}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
  );
  console.log(
    `${colors.cyan}${colors.bold}║                           SUMMARY                              ║${colors.reset}`,
  );
  console.log(
    `${colors.cyan}${colors.bold}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
  );

  console.log(
    `\n${colors.bold}Total agents processed: ${total}${colors.reset}`,
  );
  console.log(
    `${colors.green}${colors.bold}✓ Successfully reset: ${successCount}${colors.reset}`,
  );
  console.log(
    `${colors.red}${colors.bold}✗ Failed: ${errorCount}${colors.reset}`,
  );

  const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;
  console.log(
    `${colors.magenta}${colors.bold}Success rate: ${successRate}%${colors.reset}`,
  );
}

/**
 * Display detailed results
 */
function displayDetailedResults(
  results: Array<{
    agentId: string;
    agentName: string;
    ownerId: string;
    success: boolean;
    error?: string;
  }>,
): void {
  console.log(
    `\n${colors.cyan}${colors.bold}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
  );
  console.log(
    `${colors.cyan}${colors.bold}║                      DETAILED RESULTS                          ║${colors.reset}`,
  );
  console.log(
    `${colors.cyan}${colors.bold}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
  );

  results.forEach((result, index) => {
    console.log(
      `\n${colors.cyan}[${index + 1}] ${colors.bold}${result.agentName}${colors.reset} ${colors.dim}(${result.agentId})${colors.reset}`,
    );
    console.log(`    ${colors.dim}Owner: ${result.ownerId}${colors.reset}`);

    if (result.success) {
      console.log(
        `    ${colors.green}✓ API key successfully reset${colors.reset}`,
      );
    } else {
      console.log(`    ${colors.red}✗ Failed to reset API key${colors.reset}`);
      if (result.error) {
        console.log(
          `    ${colors.red}${colors.dim}Error: ${result.error}${colors.reset}`,
        );
      }
    }
  });
}

/**
 * Reset API keys for all agents
 */
async function resetAllAgentApiKeys(): Promise<void> {
  try {
    displayHeader();

    // Validate environment
    if (!validateEnvironment()) {
      console.log(
        `\n${colors.red}${colors.bold}❌ Environment validation failed. Exiting.${colors.reset}`,
      );
      process.exit(1);
    }

    displayEnvironmentStatus();

    // Get all agents from the database
    console.log(
      `\n${colors.blue}${colors.bold}Loading agents from database...${colors.reset}`,
    );
    // Get all agents - direct DB access for script
    const agents = await findAllAgents({
      limit: 1000000,
      offset: 0,
      sort: "createdAt:desc",
    });

    if (agents.length === 0) {
      console.log(
        `\n${colors.yellow}No agents found in the database.${colors.reset}`,
      );
      return;
    }

    console.log(
      `\n${colors.green}${colors.bold}Found ${agents.length} agent(s)${colors.reset}`,
    );

    // Warning and confirmation
    console.log(
      `\n${colors.yellow}${colors.bold}⚠️  WARNING: This will reset API keys for ALL agents!${colors.reset}`,
    );
    console.log(
      `${colors.yellow}   All existing API keys will be invalidated.${colors.reset}`,
    );
    console.log(
      `${colors.yellow}   Make sure to update any systems using these keys.${colors.reset}`,
    );

    const confirmed = await askForConfirmation();
    if (!confirmed) {
      console.log(`\n${colors.red}Operation cancelled by user.${colors.reset}`);
      return;
    }

    console.log(
      `\n${colors.blue}${colors.bold}Resetting API keys...${colors.reset}`,
    );

    // Reset API keys for all agents
    const results: Array<{
      agentId: string;
      agentName: string;
      ownerId: string;
      success: boolean;
      error?: string;
    }> = [];

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];

      if (!agent) {
        console.log(
          `${colors.red}⚠️  Agent at index ${i} is undefined, skipping...${colors.reset}`,
        );
        errorCount++;
        continue;
      }

      displayProgress(i + 1, agents.length, agent.name);

      try {
        const resetResult = await services.agentManager.resetApiKey(agent.id);

        if (resetResult?.apiKey) {
          console.log(`${colors.green}✓ Success${colors.reset}`);
          results.push({
            agentId: agent.id,
            agentName: agent.name,
            ownerId: agent.ownerId,
            success: true,
          });
          successCount++;
        } else {
          console.log(
            `${colors.red}✗ Failed - No result returned${colors.reset}`,
          );
          results.push({
            agentId: agent.id,
            agentName: agent.name,
            ownerId: agent.ownerId,
            success: false,
            error: "No result returned from resetApiKey",
          });
          errorCount++;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.log(`${colors.red}✗ Failed - ${errorMessage}${colors.reset}`);

        results.push({
          agentId: agent.id,
          agentName: agent.name,
          ownerId: agent.ownerId,
          success: false,
          error: errorMessage,
        });
        errorCount++;
      }
    }

    // Display results
    displayDetailedResults(results);
    displaySummary(successCount, errorCount, agents.length);

    if (successCount > 0) {
      console.log(
        `\n${colors.yellow}${colors.bold}⚠️  IMPORTANT NOTES:${colors.reset}`,
      );
      console.log(
        `${colors.yellow}   • ${successCount} agent(s) have new API keys${colors.reset}`,
      );
      console.log(
        `${colors.yellow}   • Old API keys are no longer valid${colors.reset}`,
      );
      console.log(
        `${colors.yellow}   • Update any systems using these keys${colors.reset}`,
      );
      console.log(
        `${colors.yellow}   • New keys are available via the agent management interface${colors.reset}`,
      );
    }

    console.log(
      `\n${colors.green}${colors.bold}✓ API key reset operation completed${colors.reset}`,
    );
  } catch (error) {
    console.error(
      `\n${colors.red}${colors.bold}❌ Error resetting agent API keys:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

// Run the function
resetAllAgentApiKeys()
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
