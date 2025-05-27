import * as dotenv from "dotenv";
import * as path from "path";

import { ServiceRegistry } from "@/services/index.js";

const services = new ServiceRegistry();

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

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
 * List all registered agents with detailed information
 */
async function listAllAgents() {
  try {
    console.log(
      `${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.cyan}║                          AGENT LISTING                         ║${colors.reset}`,
    );
    console.log(
      `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    const agents = await services.agentManager.getAllAgents();

    if (agents.length === 0) {
      console.log(
        `\n${colors.yellow}No agents found in the database.${colors.reset}`,
      );
      return;
    }

    console.log(
      `\n${colors.green}Found ${agents.length} registered agent(s):${colors.reset}\n`,
    );

    // Sort agents by creation date (newest first)
    agents.sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
    );

    agents.forEach((agent, i) => {
      const created = agent.createdAt?.toLocaleString();
      const updated = agent.updatedAt?.toLocaleString();

      console.log(
        `${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
      );
      console.log(
        `${colors.cyan}║ AGENT #${i + 1}${" ".repeat(60 - `AGENT #${i + 1}`.length)}║${colors.reset}`,
      );
      console.log(
        `${colors.cyan}╠════════════════════════════════════════════════════════════════╣${colors.reset}`,
      );
      console.log(
        `${colors.cyan}║${colors.reset} ID:             ${colors.yellow}${agent.id}${colors.reset}`,
      );
      console.log(
        `${colors.cyan}║${colors.reset} Name:           ${colors.green}${agent.name}${colors.reset}`,
      );
      console.log(
        `${colors.cyan}║${colors.reset} API Key:        ${colors.magenta}${agent.apiKey}${colors.reset}`,
      );
      console.log(`${colors.cyan}║${colors.reset} Created:        ${created}`);
      console.log(`${colors.cyan}║${colors.reset} Last Updated:   ${updated}`);
      console.log(
        `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
      );

      if (i < agents.length - 1) {
        console.log(""); // Add an empty line between agents
      }
    });

    console.log(`\n${colors.green}End of agent listing.${colors.reset}`);
  } catch (error) {
    console.error(
      `\n${colors.red}Error listing agents:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );
  } finally {
    // Exit the process after clean closure
    process.exit(0);
  }
}

// Run the function
listAllAgents();
