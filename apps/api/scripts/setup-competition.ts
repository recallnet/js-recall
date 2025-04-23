import * as readline from 'readline';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { services } from '../src/services';
import { DatabaseConnection } from '../src/database';
import { Team } from '../src/types';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

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
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  white: '\x1b[97m',
  reset: '\x1b[0m',
};

/**
 * Parse selection input like "1,3,5-8" into an array of indices
 */
function parseSelectionInput(input: string, maxIndex: number): number[] {
  try {
    const result: number[] = [];
    const parts = input.split(',');

    for (const part of parts) {
      part.trim();
      if (part.includes('-')) {
        // Handle ranges (e.g., "5-8")
        const [start, end] = part.split('-').map((p) => parseInt(p.trim(), 10));
        if (isNaN(start) || isNaN(end)) continue;

        for (let i = start; i <= end; i++) {
          if (i > 0 && i <= maxIndex && !result.includes(i)) {
            result.push(i);
          }
        }
      } else {
        // Handle single numbers
        const num = parseInt(part.trim(), 10);
        if (!isNaN(num) && num > 0 && num <= maxIndex && !result.includes(num)) {
          result.push(num);
        }
      }
    }

    return result;
  } catch (error) {
    return [];
  }
}

/**
 * Display all teams with indices and allow selecting them
 */
async function selectTeams(): Promise<Team[]> {
  try {
    // Get all non-admin teams
    const teams = await services.teamManager.getAllTeams(false);

    if (teams.length === 0) {
      console.log(
        `\n${colors.yellow}No teams found in the database. Please register teams first.${colors.reset}`,
      );
      return [];
    }

    console.log(`\n${colors.cyan}Available Teams:${colors.reset}`);
    console.log(`${colors.cyan}----------------------------------------${colors.reset}`);

    // Sort teams by name for easier selection
    teams.sort((a, b) => a.name.localeCompare(b.name));

    // Display teams with indices
    teams.forEach((team, index) => {
      console.log(
        `${colors.green}${index + 1}.${colors.reset} ${colors.white}${team.name}${colors.reset} ${colors.gray}(${team.id})${colors.reset}`,
      );
      console.log(`   Email: ${team.email}`);
      console.log(`   Contact: ${team.contactPerson}`);

      if (index < teams.length - 1) {
        console.log(`   ${colors.cyan}----------------------------------------${colors.reset}`);
      }
    });

    console.log(`${colors.cyan}----------------------------------------${colors.reset}`);

    // Prompt for team selection
    console.log(`\n${colors.yellow}Select teams to include in the competition.${colors.reset}`);
    console.log(`Enter team numbers separated by commas or as ranges (e.g., "1,3,5-7").`);
    console.log(`To select all teams, enter "all".`);

    const selection = await prompt(`\n${colors.magenta}Team selection:${colors.reset} `);

    if (selection.toLowerCase() === 'all') {
      return teams;
    }

    // Parse the selection and return selected teams
    const selectedIndices = parseSelectionInput(selection, teams.length);
    const selectedTeams = selectedIndices.map((idx) => teams[idx - 1]);

    if (selectedTeams.length === 0) {
      console.log(`\n${colors.red}No valid teams selected. Please try again.${colors.reset}`);
      return await selectTeams(); // Retry selection
    }

    // Show selection summary
    console.log(`\n${colors.green}Selected Teams (${selectedTeams.length}):${colors.reset}`);
    selectedTeams.forEach((team, index) => {
      console.log(`${index + 1}. ${team.name}`);
    });

    // Confirm selection
    const confirm = await prompt(
      `\n${colors.yellow}Confirm this selection? (y/n):${colors.reset} `,
    );

    if (confirm.toLowerCase() !== 'y') {
      console.log(`\n${colors.blue}Let's select teams again.${colors.reset}`);
      return await selectTeams(); // Retry selection
    }

    return selectedTeams;
  } catch (error) {
    console.error(
      `\n${colors.red}Error selecting teams:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

/**
 * Set up a new competition
 */
async function setupCompetition() {
  try {
    console.log(
      `${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.cyan}║                     COMPETITION SETUP                         ║${colors.reset}`,
    );
    console.log(
      `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    console.log(`\nThis script will help you set up a new trading competition.`);

    // Check if a competition is already active
    const activeCompetition = await services.competitionManager.getActiveCompetition();

    if (activeCompetition) {
      console.log(
        `\n${colors.yellow}WARNING: There is already an active competition:${colors.reset}`,
      );
      console.log(`- ID: ${activeCompetition.id}`);
      console.log(`- Name: ${activeCompetition.name}`);
      console.log(`- Started: ${new Date(activeCompetition.startDate!).toLocaleString()}`);

      const proceed = await prompt(
        `\n${colors.red}Do you want to end the current competition and start a new one? (y/n):${colors.reset} `,
      );

      if (proceed.toLowerCase() !== 'y') {
        console.log(
          `\n${colors.blue}Setup cancelled. Use the admin dashboard to manage the current competition.${colors.reset}`,
        );
        return;
      }

      // End the current competition
      console.log(`\n${colors.blue}Ending current competition...${colors.reset}`);
      await services.competitionManager.endCompetition(activeCompetition.id);
      console.log(`${colors.green}Successfully ended previous competition.${colors.reset}`);
    }

    // Get competition details
    const name = await prompt(`\n${colors.yellow}Enter competition name:${colors.reset} `);
    if (!name) {
      throw new Error('Competition name is required.');
    }

    const description = await prompt(
      `${colors.yellow}Enter competition description (optional):${colors.reset} `,
    );

    // Select teams for the competition
    console.log(
      `\n${colors.blue}Now let's select teams to participate in the competition.${colors.reset}`,
    );
    const selectedTeams = await selectTeams();

    if (selectedTeams.length === 0) {
      throw new Error('At least one team must be selected for the competition.');
    }

    // Extract team IDs
    const teamIds = selectedTeams.map((team) => team.id);

    // Confirm competition setup
    console.log(`\n${colors.yellow}Competition Summary:${colors.reset}`);
    console.log(`${colors.yellow}----------------------------------------${colors.reset}`);
    console.log(`Name: ${name}`);
    console.log(`Description: ${description || '(none)'}`);
    console.log(`Teams: ${selectedTeams.length} selected`);
    console.log(`${colors.yellow}----------------------------------------${colors.reset}`);

    const confirmSetup = await prompt(
      `\n${colors.yellow}Do you want to create and start this competition? (y/n):${colors.reset} `,
    );

    if (confirmSetup.toLowerCase() !== 'y') {
      console.log(`\n${colors.red}Competition setup cancelled.${colors.reset}`);
      return;
    }

    // Create and start the competition
    console.log(`\n${colors.blue}Creating competition...${colors.reset}`);
    const competition = await services.competitionManager.createCompetition(name, description);

    console.log(
      `${colors.blue}Starting competition with ${teamIds.length} teams...${colors.reset}`,
    );
    const startedCompetition = await services.competitionManager.startCompetition(
      competition.id,
      teamIds,
    );

    console.log(`\n${colors.green}✓ Competition created and started successfully!${colors.reset}`);
    console.log(`\n${colors.cyan}Competition Details:${colors.reset}`);
    console.log(`${colors.cyan}----------------------------------------${colors.reset}`);
    console.log(`ID: ${startedCompetition.id}`);
    console.log(`Name: ${startedCompetition.name}`);
    console.log(`Description: ${startedCompetition.description || '(none)'}`);
    console.log(`Started: ${new Date(startedCompetition.startDate!).toLocaleString()}`);
    console.log(`Status: ${startedCompetition.status}`);
    console.log(`Teams: ${teamIds.length} participating`);
    console.log(`${colors.cyan}----------------------------------------${colors.reset}`);

    console.log(`\n${colors.green}Teams can now participate in the competition!${colors.reset}`);
  } catch (error) {
    console.error(
      `\n${colors.red}Error setting up competition:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );
  } finally {
    rl.close();

    // Close database connection
    await DatabaseConnection.getInstance().close();

    // Exit the process after clean closure
    process.exit(0);
  }
}

// Run the setup function
setupCompetition();
