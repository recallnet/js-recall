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
 * 4. Display the results with new API keys
 */
import * as dotenv from "dotenv";
import * as path from "path";

import { ServiceRegistry } from "@/services/index.js";

// Load environment variables (this will be overridden by the ones we set above)
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
};

/**
 * Reset API keys for all agents
 */
async function resetAllAgentApiKeys() {
  try {
    console.log(
      `${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.cyan}║                    RESET ALL AGENT API KEYS                    ║${colors.reset}`,
    );
    console.log(
      `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    console.log(
      `\n${colors.yellow}Database: ${process.env.DATABASE_URL}${colors.reset}`,
    );
    console.log(
      `${colors.yellow}Encryption Key: ${process.env.ROOT_ENCRYPTION_KEY?.substring(0, 16)}...${colors.reset}`,
    );

    // Get all agents from the database
    console.log(
      `\n${colors.blue}Loading all agents from database...${colors.reset}`,
    );
    const agents = await services.agentManager.getAllAgents();

    if (agents.length === 0) {
      console.log(
        `\n${colors.yellow}No agents found in the database.${colors.reset}`,
      );
      return;
    }

    console.log(
      `\n${colors.green}Found ${agents.length} agent(s) to reset API keys for.${colors.reset}`,
    );

    // Confirm before proceeding
    console.log(
      `\n${colors.yellow}⚠️  WARNING: This will reset API keys for ALL agents!${colors.reset}`,
    );
    console.log(
      `${colors.yellow}   All existing API keys will be invalidated.${colors.reset}`,
    );

    // For scripts, we'll proceed automatically since this is likely run in a controlled environment
    // If you want to add a confirmation prompt, uncomment the lines below:

    // const readline = require('readline');
    // const rl = readline.createInterface({
    //   input: process.stdin,
    //   output: process.stdout,
    // });
    //
    // const answer = await new Promise(resolve => {
    //   rl.question(`\n${colors.cyan}Do you want to proceed? (y/N): ${colors.reset}`, resolve);
    // });
    // rl.close();
    //
    // if (answer.toLowerCase() !== 'y') {
    //   console.log(`\n${colors.red}Operation cancelled.${colors.reset}`);
    //   return;
    // }

    console.log(
      `\n${colors.blue}Proceeding to reset API keys for all agents...${colors.reset}`,
    );

    // Reset API keys for all agents
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];

      // Check if agent exists (TypeScript safety)
      if (!agent) {
        console.log(
          `${colors.red}✗ Agent at index ${i} is undefined, skipping...${colors.reset}`,
        );
        errorCount++;
        continue;
      }

      try {
        console.log(
          `\n${colors.cyan}[${i + 1}/${agents.length}] Resetting API key for agent: ${agent.name} (${agent.id})${colors.reset}`,
        );

        const resetResult = await services.agentManager.resetApiKey(agent.id);

        if (resetResult && resetResult.apiKey) {
          console.log(
            `${colors.green}✓ Successfully reset API key for ${agent.name}${colors.reset}`,
          );

          results.push({
            agentId: agent.id,
            agentName: agent.name,
            ownerId: agent.ownerId,
            newApiKey: resetResult.apiKey,
            success: true,
          });
          successCount++;
        } else {
          console.log(
            `${colors.red}✗ Failed to reset API key for ${agent.name} - No result returned${colors.reset}`,
          );

          results.push({
            agentId: agent.id,
            agentName: agent.name,
            ownerId: agent.ownerId,
            newApiKey: null,
            success: false,
            error: "No result returned from resetApiKey",
          });
          errorCount++;
        }
      } catch (error) {
        console.log(
          `${colors.red}✗ Failed to reset API key for ${agent.name}: ${error instanceof Error ? error.message : error}${colors.reset}`,
        );

        results.push({
          agentId: agent.id,
          agentName: agent.name,
          ownerId: agent.ownerId,
          newApiKey: null,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
        errorCount++;
      }
    }

    // Display summary
    console.log(
      `\n${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.cyan}║                           SUMMARY                              ║${colors.reset}`,
    );
    console.log(
      `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    console.log(
      `\n${colors.green}Successfully reset: ${successCount} agent(s)${colors.reset}`,
    );
    console.log(`${colors.red}Failed: ${errorCount} agent(s)${colors.reset}`);

    // Display detailed results
    console.log(
      `\n${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.cyan}║                      DETAILED RESULTS                          ║${colors.reset}`,
    );
    console.log(
      `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    results.forEach((result, index) => {
      console.log(
        `\n${colors.cyan}[${index + 1}] Agent: ${result.agentName} (${result.agentId})${colors.reset}`,
      );
      console.log(`    Owner ID: ${result.ownerId}`);

      if (result.success) {
        console.log(`    ${colors.green}✓ Status: SUCCESS${colors.reset}`);
        console.log(
          `    ${colors.magenta}New API Key: ${result.newApiKey}${colors.reset}`,
        );
      } else {
        console.log(`    ${colors.red}✗ Status: FAILED${colors.reset}`);
        console.log(`    ${colors.red}Error: ${result.error}${colors.reset}`);
      }
    });

    console.log(
      `\n${colors.green}API key reset operation completed.${colors.reset}`,
    );

    if (successCount > 0) {
      console.log(
        `\n${colors.yellow}⚠️  IMPORTANT: Save the new API keys above!${colors.reset}`,
      );
      console.log(
        `${colors.yellow}   Old API keys are no longer valid.${colors.reset}`,
      );
    }
  } catch (error) {
    console.error(
      `\n${colors.red}Error resetting agent API keys:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );
  } finally {
    // Exit the process after clean closure
    process.exit(0);
  }
}

// Run the function
resetAllAgentApiKeys();
