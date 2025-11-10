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
  gray: "\x1b[90m",
  white: "\x1b[97m",
  reset: "\x1b[0m",
};

/**
 * Format currency value
 * @param value The value to format
 * @returns Formatted string with 2 decimal places
 */
function formatCurrency(value: number): string {
  return value.toFixed(2);
}

/**
 * Format a date to a readable string
 * @param date The date to format
 * @returns Formatted date string
 */
function formatDate(date: Date | string | undefined | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleString();
}

/**
 * Calculate the time difference between now and a given date
 * @param startDate The start date
 * @returns Formatted duration string
 */
function calculateDuration(
  startDate: Date | string | undefined | null,
): string {
  if (!startDate) return "N/A";

  const start = new Date(startDate).getTime();
  const now = Date.now();
  const diffMs = now - start;

  // Convert to hours, minutes
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${minutes}m`;
}

/**
 * Display competition status and leaderboard
 */
async function showCompetitionStatus() {
  try {
    console.log(
      `${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.cyan}║                   COMPETITION STATUS                          ║${colors.reset}`,
    );
    console.log(
      `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

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
          `\n${colors.yellow}No active competitions found.${colors.reset}`,
        );
        console.log(
          `\n${colors.green}Use 'pnpm setup:competition' to start a new competition.${colors.reset}`,
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
        `${colors.cyan}tsx competition-status.ts <competition-id>${colors.reset}`,
      );
      return;
    }

    const competition =
      await services.competitionService.getCompetition(competitionId);

    if (!competition) {
      console.log(
        `\n${colors.yellow}Competition not found: ${competitionId}${colors.reset}`,
      );

      // Check if there are any previous competitions
      const pastCompetitions = await services.competitionRepository.findAll();
      const completedCompetitions = pastCompetitions.filter(
        (c) => c.status === "ended",
      );

      if (completedCompetitions.length > 0) {
        console.log(
          `\n${colors.blue}Previous completed competitions:${colors.reset}`,
        );
        completedCompetitions.forEach((comp, index) => {
          const startDateValue = comp.startDate as string | Date | undefined;
          const endDateValue = comp.endDate as string | Date | undefined;
          console.log(
            `${index + 1}. ${comp.name} (${formatDate(startDateValue)} - ${formatDate(endDateValue)})`,
          );
        });

        console.log(
          `\n${colors.green}Use 'pnpm setup:competition' to start a new competition.${colors.reset}`,
        );
      } else {
        console.log(
          `\n${colors.blue}No previous competitions found.${colors.reset}`,
        );
        console.log(
          `\n${colors.green}Use 'pnpm setup:competition' to start your first competition!${colors.reset}`,
        );
      }

      return;
    }

    // Get agents participating in the competition
    const participatingAgentIds =
      await services.competitionRepository.getCompetitionAgents(competition.id);

    // Get all agents (for mapping IDs to names) - direct DB access for script
    const allAgents = await services.agentRepository.findAll({
      limit: 1000000,
      offset: 0,
      sort: "-createdAt",
    });
    const agentMap = new Map(allAgents.map((agent) => [agent.id, agent]));

    // Map participating agent IDs to agent objects
    const participatingAgents = participatingAgentIds
      .map((id: string) => agentMap.get(id))
      .filter((agent) => agent !== undefined);

    // Get the leaderboard
    const leaderboard = await services.competitionService.getLeaderboard(
      competition.id,
    );

    // Display competition details
    console.log(
      `\n${colors.green}Active Competition:${colors.reset} ${colors.white}${competition.name}${colors.reset}`,
    );
    console.log(
      `${colors.green}Description:${colors.reset} ${competition.description || "(none)"}`,
    );
    console.log(
      `${colors.green}Status:${colors.reset} ${competition.status.toUpperCase()}`,
    );
    console.log(
      `${colors.green}Started:${colors.reset} ${formatDate(competition.startDate)}`,
    );
    console.log(
      `${colors.green}Duration:${colors.reset} ${calculateDuration(competition.startDate)}`,
    );
    console.log(
      `${colors.green}Participating Agents:${colors.reset} ${participatingAgents.length}`,
    );

    // Display agent participation summary
    console.log(`\n${colors.magenta}Participating Agents:${colors.reset}`);
    console.log(
      `${colors.magenta}----------------------------------------${colors.reset}`,
    );

    if (participatingAgents.length === 0) {
      console.log(`No agents are participating in this competition.`);
    } else {
      // Sort agents by name
      const sortedAgents = [...participatingAgents].sort((a, b) =>
        a!.name.localeCompare(b!.name),
      );

      // Create a formatted table-like output
      const columns = 3;
      const rows = Math.ceil(sortedAgents.length / columns);

      for (let row = 0; row < rows; row++) {
        let line = "";

        for (let col = 0; col < columns; col++) {
          const index = row + col * rows;
          if (index < sortedAgents.length) {
            const agent = sortedAgents[index];
            const name = agent!.name.padEnd(20).substring(0, 20);
            line += `${name} `;
          }
        }

        console.log(line);
      }
    }

    console.log(
      `${colors.magenta}----------------------------------------${colors.reset}`,
    );

    // Display leaderboard
    console.log(`\n${colors.cyan}Current Leaderboard:${colors.reset}`);
    console.log(
      `${colors.cyan}========================================${colors.reset}`,
    );

    if (leaderboard.length === 0) {
      console.log(
        `${colors.yellow}No agents have made trades yet.${colors.reset}`,
      );
    } else {
      // Sort leaderboard by value (descending)
      const sortedLeaderboard = [
        ...(leaderboard as [
          (typeof leaderboard)[number],
          ...typeof leaderboard,
        ]),
      ].sort((a, b) => b.value - a.value) as [
        {
          agentId: string;
          value: number;
          pnl: number; // TODO: casting here probably isn't right
        },
        ...{
          agentId: string;
          value: number;
          pnl: number; // TODO: casting here probably isn't right
        }[],
      ];

      // Get initial snapshots for each agent
      const initialSnapshots = new Map<string, number>();

      // Get the first snapshot for each agent in the competition
      for (const entry of sortedLeaderboard) {
        const snapshots =
          await services.competitionRepository.getAgentPortfolioSnapshots(
            competition.id,
            entry.agentId,
          );
        if (snapshots.length > 0) {
          // Sort by timestamp and get the first one (initial snapshot)
          const sortedSnapshots = snapshots.sort(
            (a, b) =>
              (a.timestamp?.getTime() ?? 0) - (b.timestamp?.getTime() ?? 0),
          );

          if (sortedSnapshots.length > 0) {
            initialSnapshots.set(entry.agentId, sortedSnapshots[0]!.totalValue);
          }
        }
      }

      // Calculate highest value for statistics
      const highestValue = sortedLeaderboard[0].value;
      const lowestValue =
        sortedLeaderboard[sortedLeaderboard.length - 1]!.value;

      // Display each agent's rank
      sortedLeaderboard.forEach((entry, index) => {
        const agent = agentMap.get(entry.agentId);
        const agentName = agent ? agent.name : "Unknown agent";

        // Format the ranking with colors based on rank
        let rankPrefix = `${(index + 1).toString().padStart(2, " ")}. `;
        let rankColor = colors.reset;

        if (index === 0) {
          rankPrefix = ` 🥇 `;
          rankColor = colors.yellow;
        } else if (index === 1) {
          rankPrefix = ` 🥈 `;
          rankColor = colors.blue;
        } else if (index === 2) {
          rankPrefix = ` 🥉 `;
          rankColor = colors.green;
        }

        // Get initial value for this agent, or fall back to current value if no initial snapshot
        const initialValue = initialSnapshots.get(entry.agentId) || entry.value;

        // Calculate performance metrics
        const performanceVsInitial = (entry.value / initialValue - 1) * 100;

        // Format the performance indicators
        const performanceColor =
          performanceVsInitial >= 0 ? colors.green : colors.red;
        const performanceSign = performanceVsInitial >= 0 ? "+" : "";
        const performanceText = `${performanceSign}${performanceVsInitial.toFixed(2)}%`;

        // Display agent ranking with portfolio value and performance
        console.log(
          `${rankColor}${rankPrefix}${colors.reset}` +
            `${agentName.padEnd(25).substring(0, 25)} ` +
            `${colors.cyan}$${formatCurrency(entry.value).padStart(10)}${colors.reset} ` +
            `${performanceColor}(${performanceText})${colors.reset}`,
        );
      });

      // Display performance statistics
      console.log(
        `${colors.cyan}========================================${colors.reset}`,
      );
      console.log(`${colors.blue}Statistics:${colors.reset}`);
      console.log(`- Highest Value: $${formatCurrency(highestValue)}`);
      console.log(`- Lowest Value: $${formatCurrency(lowestValue)}`);
      console.log(
        `- Average Value: $${formatCurrency(leaderboard.reduce((sum, entry) => sum + entry.value, 0) / leaderboard.length)}`,
      );

      // Update best/worst performer stats to use initial values
      const bestAgent = sortedLeaderboard[0];
      const worstAgent = sortedLeaderboard[sortedLeaderboard.length - 1]!;
      const bestInitial =
        initialSnapshots.get(bestAgent.agentId) || bestAgent.value;
      const worstInitial =
        initialSnapshots.get(worstAgent.agentId) || worstAgent.value;

      const bestPerformance = (bestAgent.value / bestInitial - 1) * 100;
      const worstPerformance = (worstAgent.value / worstInitial - 1) * 100;

      console.log(
        `- Best Performer: ${bestPerformance >= 0 ? "+" : ""}${bestPerformance.toFixed(2)}%`,
      );
      console.log(
        `- Worst Performer: ${worstPerformance >= 0 ? "+" : ""}${worstPerformance.toFixed(2)}%`,
      );
    }

    console.log(
      `\n${colors.green}Use 'pnpm end:competition' to end this competition.${colors.reset}`,
    );
  } catch (error) {
    console.error(
      `\n${colors.red}Error fetching competition status:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );
  } finally {
    // Exit the process after clean closure
    process.exit(0);
  }
}

// Run the function
showCompetitionStatus();
