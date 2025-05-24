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

// Prompt function that returns a promise
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Colors for console output
const colors = {
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  reset: "\x1b[0m",
};

/**
 * List all registered teams to help user find the agent ID
 */
async function listAllTeams() {
  try {
    const agents = await services.agentManager.getAllAgents();

    if (agents.length === 0) {
      console.log(
        `\n${colors.yellow}No agents found in the database.${colors.reset}`,
      );
      return;
    }

    console.log(`\n${colors.cyan}Registered Agents:${colors.reset}`);
    console.log(
      `${colors.cyan}----------------------------------------${colors.reset}`,
    );

    agents.forEach((agent, index) => {
      console.log(`${index + 1}. ${agent.name} (${agent.id})`);
      console.log(`   Created: ${agent.createdAt?.toLocaleString()}`);
      if (index < agents.length - 1) {
        console.log(
          `   ${colors.cyan}----------------------------------------${colors.reset}`,
        );
      }
    });

    console.log(
      `${colors.cyan}----------------------------------------${colors.reset}`,
    );
  } catch (error) {
    console.error(
      `\n${colors.red}Error listing teams:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Delete a agent by ID
 */
async function deleteTeam(teamId: string) {
  try {
    // Get agent details first to confirm
    const agent = await services.agentManager.getAgent(teamId);

    if (!agent) {
      console.log(
        `\n${colors.red}Error: Agent with ID ${teamId} not found.${colors.reset}`,
      );
      return false;
    }

    console.log(`\n${colors.yellow}Agent found:${colors.reset}`);
    console.log(`- Agent ID: ${agent.id}`);
    console.log(`- Agent Name: ${agent.name}`);

    const confirmation =
      await prompt(`\n${colors.red}WARNING: This will permanently delete this agent and all associated data.${colors.reset}
${colors.red}Type the agent name (${agent.name}) to confirm deletion:${colors.reset} `);

    if (confirmation !== agent.name) {
      console.log(
        `\n${colors.yellow}Deletion cancelled. Agent name confirmation did not match.${colors.reset}`,
      );
      return false;
    }

    console.log(`\n${colors.blue}Deleting agent...${colors.reset}`);

    // Delete the agent
    const result = await services.agentManager.deleteAgent(teamId);

    if (result) {
      console.log(
        `\n${colors.green}✓ Agent "${agent.name}" deleted successfully!${colors.reset}`,
      );
      return true;
    } else {
      console.log(
        `\n${colors.red}Failed to delete agent "${agent.name}".${colors.reset}`,
      );
      return false;
    }
  } catch (error) {
    console.error(
      `\n${colors.red}Error deleting agent:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

/**
 * Main function to run the script
 */
async function main() {
  try {
    console.log(
      `${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.cyan}║                          DELETE Agent                          ║${colors.reset}`,
    );
    console.log(
      `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    console.log(
      `\nThis script will delete a agent from the Trading Simulator.`,
    );
    console.log(`You'll need to provide the agent ID to delete.`);

    // Check if agent ID was provided as command-line argument
    let teamId = process.argv[2];

    // If no agent ID provided, ask if user wants to list teams
    if (!teamId) {
      const listTeams = await prompt(
        `\n${colors.yellow}Do you want to list all registered teams? (y/n):${colors.reset} `,
      );

      if (listTeams.toLowerCase() === "y") {
        await listAllTeams();
      }

      teamId = await prompt(
        `\n${colors.yellow}Enter the ID of the agent to delete:${colors.reset} `,
      );
    }

    if (!teamId) {
      console.log(
        `\n${colors.red}No agent ID provided. Operation cancelled.${colors.reset}`,
      );
      return;
    }

    // Delete the agent
    await deleteTeam(teamId);
  } catch (error) {
    console.error(
      `\n${colors.red}Error:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );
  } finally {
    rl.close();

    // Exit the process after clean closure
    process.exit(0);
  }
}

// Run the main function
main();
