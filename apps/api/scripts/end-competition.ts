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
  magenta: "\x1b[35m",
  reset: "\x1b[0m",
};

/**
 * End the currently active competition
 */
async function endCompetition() {
  try {
    console.log(
      `${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.cyan}║                     END COMPETITION                           ║${colors.reset}`,
    );
    console.log(
      `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    console.log(`\nThis script will help you end a competition.`);

    // Get competition ID from command line argument
    const competitionId = process.argv[2];

    // If no ID provided, list active competitions and exit with helpful message
    if (!competitionId) {
      const allCompetitions = await services.competitionRepository.findAll();
      const activeCompetitions = allCompetitions.filter(
        (c) => c.status === "active",
      );

      if (activeCompetitions.length === 0) {
        console.log(
          `\n${colors.yellow}No active competitions to end.${colors.reset}`,
        );
        return;
      }

      console.log(`\n${colors.blue}Active competitions:${colors.reset}`);
      activeCompetitions.forEach((comp, index) => {
        console.log(`${index + 1}. ${comp.name} (ID: ${comp.id})`);
      });

      console.log(
        `\n${colors.yellow}Please provide a competition ID as an argument:${colors.reset}`,
      );
      console.log(
        `${colors.cyan}tsx end-competition.ts <competition-id>${colors.reset}`,
      );
      return;
    }

    const activeCompetition =
      await services.competitionService.getCompetition(competitionId);

    if (!activeCompetition) {
      console.log(
        `\n${colors.yellow}Competition not found: ${competitionId}${colors.reset}`,
      );
      return;
    }

    // Display competition details
    const startDate = new Date(activeCompetition.startDate!).toLocaleString();
    const duration = Math.floor(
      (Date.now() - new Date(activeCompetition.startDate!).getTime()) /
        (1000 * 60 * 60),
    );

    console.log(`\n${colors.blue}Active Competition Details:${colors.reset}`);
    console.log(
      `${colors.blue}----------------------------------------${colors.reset}`,
    );
    console.log(`ID: ${activeCompetition.id}`);
    console.log(`Name: ${activeCompetition.name}`);
    console.log(`Description: ${activeCompetition.description || "(none)"}`);
    console.log(`Started: ${startDate}`);
    console.log(`Duration: ~${duration} hours`);
    console.log(`Status: ${activeCompetition.status}`);
    console.log(
      `${colors.blue}----------------------------------------${colors.reset}`,
    );

    // Get the leaderboard to show current standings
    console.log(
      `\n${colors.blue}Fetching current leaderboard...${colors.reset}`,
    );
    const leaderboard = await services.competitionService.getLeaderboard(
      activeCompetition.id,
    );

    // Get all agents - direct DB access for script
    const agents = await services.agentRepository.findAll({
      limit: 1000000,
      offset: 0,
      sort: "-createdAt",
    });

    // Map agent IDs to names
    const agentMap = new Map(agents.map((agent) => [agent.id, agent.name]));

    if (leaderboard.length > 0) {
      console.log(`\n${colors.green}Current Standings:${colors.reset}`);
      console.log(
        `${colors.green}----------------------------------------${colors.reset}`,
      );

      leaderboard.forEach((entry, index) => {
        const agentName = agentMap.get(entry.agentId) || "Unknown Agent";
        console.log(
          `${index + 1}. ${agentName}: ${entry.value.toFixed(2)} USD`,
        );
      });

      console.log(
        `${colors.green}----------------------------------------${colors.reset}`,
      );
    } else {
      console.log(
        `\n${colors.yellow}No agents have participated in this competition yet.${colors.reset}`,
      );
    }

    // Confirm ending the competition
    const confirm = await prompt(
      `\n${colors.red}Are you sure you want to end this competition? (y/n):${colors.reset} `,
    );

    if (confirm.toLowerCase() !== "y") {
      console.log(
        `\n${colors.blue}Operation cancelled. Competition remains active.${colors.reset}`,
      );
      return;
    }

    // End the competition
    console.log(`\n${colors.blue}Ending competition...${colors.reset}`);
    const { competition: endedCompetition, leaderboard: finalLeaderboard } =
      await services.competitionService.endCompetition(activeCompetition.id);

    console.log(
      `\n${colors.green}✓ Competition ended successfully!${colors.reset}`,
    );
    console.log(`\n${colors.cyan}Final Competition Details:${colors.reset}`);
    console.log(
      `${colors.cyan}----------------------------------------${colors.reset}`,
    );
    console.log(`ID: ${endedCompetition.id}`);
    console.log(`Name: ${endedCompetition.name}`);
    console.log(`Description: ${endedCompetition.description || "(none)"}`);
    console.log(
      `Started: ${new Date(endedCompetition.startDate!).toLocaleString()}`,
    );
    console.log(
      `Ended: ${new Date(endedCompetition.endDate!).toLocaleString()}`,
    );
    console.log(`Status: ${endedCompetition.status}`);
    console.log(
      `${colors.cyan}----------------------------------------${colors.reset}`,
    );

    // Display final results
    if (finalLeaderboard.length > 0) {
      console.log(`\n${colors.magenta}FINAL RESULTS:${colors.reset}`);
      console.log(
        `${colors.magenta}========================================${colors.reset}`,
      );

      // Sort leaderboard by value (descending)
      const sortedLeaderboard = [...finalLeaderboard].sort(
        (a, b) => b.value - a.value,
      );

      sortedLeaderboard.forEach((entry, index) => {
        const agentName = agentMap.get(entry.agentId) || "Unknown Agent";
        let rank = `${index + 1}. `;
        let rankColor = colors.reset;

        // Highlight top 3 finishers
        if (index === 0) {
          rank = `🥇 `;
          rankColor = colors.yellow;
        } else if (index === 1) {
          rank = `🥈 `;
          rankColor = colors.blue;
        } else if (index === 2) {
          rank = `🥉 `;
          rankColor = colors.green;
        }

        console.log(
          `${rankColor}${rank}${agentName}${colors.reset}: ${colors.cyan}${entry.value.toFixed(2)} USD${colors.reset}`,
        );
      });

      console.log(
        `${colors.magenta}========================================${colors.reset}`,
      );
    } else {
      console.log(
        `\n${colors.yellow}No agents participated in this competition.${colors.reset}`,
      );
    }

    console.log(
      `\n${colors.green}Competition has been successfully ended and archived.${colors.reset}`,
    );
  } catch (error) {
    console.error(
      `\n${colors.red}Error ending competition:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );
  } finally {
    rl.close();

    // Exit the process after clean closure
    process.exit(0);
  }
}

// Run the function
endCompetition();
