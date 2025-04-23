import * as readline from 'readline';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { services } from '../src/services';
import { DatabaseConnection } from '../src/database';

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
  reset: '\x1b[0m',
};

/**
 * List all registered teams to help user find the team ID
 */
async function listAllTeams() {
  try {
    const teams = await services.teamManager.getAllTeams(false);

    if (teams.length === 0) {
      console.log(`\n${colors.yellow}No teams found in the database.${colors.reset}`);
      return;
    }

    console.log(`\n${colors.cyan}Registered Teams:${colors.reset}`);
    console.log(`${colors.cyan}----------------------------------------${colors.reset}`);

    teams.forEach((team, index) => {
      console.log(`${index + 1}. ${team.name} (${team.id})`);
      console.log(`   Email: ${team.email}`);
      console.log(`   Contact: ${team.contactPerson}`);
      console.log(`   Created: ${team.createdAt.toLocaleString()}`);
      if (index < teams.length - 1) {
        console.log(`   ${colors.cyan}----------------------------------------${colors.reset}`);
      }
    });

    console.log(`${colors.cyan}----------------------------------------${colors.reset}`);
  } catch (error) {
    console.error(
      `\n${colors.red}Error listing teams:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Delete a team by ID
 */
async function deleteTeam(teamId: string) {
  try {
    // Get team details first to confirm
    const team = await services.teamManager.getTeam(teamId);

    if (!team) {
      console.log(`\n${colors.red}Error: Team with ID ${teamId} not found.${colors.reset}`);
      return false;
    }

    console.log(`\n${colors.yellow}Team found:${colors.reset}`);
    console.log(`- Team ID: ${team.id}`);
    console.log(`- Team Name: ${team.name}`);
    console.log(`- Email: ${team.email}`);
    console.log(`- Contact Person: ${team.contactPerson}`);

    const confirmation =
      await prompt(`\n${colors.red}WARNING: This will permanently delete this team and all associated data.${colors.reset}
${colors.red}Type the team name (${team.name}) to confirm deletion:${colors.reset} `);

    if (confirmation !== team.name) {
      console.log(
        `\n${colors.yellow}Deletion cancelled. Team name confirmation did not match.${colors.reset}`,
      );
      return false;
    }

    console.log(`\n${colors.blue}Deleting team...${colors.reset}`);

    // Delete the team
    const result = await services.teamManager.deleteTeam(teamId);

    if (result) {
      console.log(`\n${colors.green}✓ Team "${team.name}" deleted successfully!${colors.reset}`);
      return true;
    } else {
      console.log(`\n${colors.red}Failed to delete team "${team.name}".${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.error(
      `\n${colors.red}Error deleting team:${colors.reset}`,
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
      `${colors.cyan}║                          DELETE TEAM                          ║${colors.reset}`,
    );
    console.log(
      `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    console.log(`\nThis script will delete a team from the Trading Simulator.`);
    console.log(`You'll need to provide the team ID to delete.`);

    // Check if team ID was provided as command-line argument
    let teamId = process.argv[2];

    // If no team ID provided, ask if user wants to list teams
    if (!teamId) {
      const listTeams = await prompt(
        `\n${colors.yellow}Do you want to list all registered teams? (y/n):${colors.reset} `,
      );

      if (listTeams.toLowerCase() === 'y') {
        await listAllTeams();
      }

      teamId = await prompt(
        `\n${colors.yellow}Enter the ID of the team to delete:${colors.reset} `,
      );
    }

    if (!teamId) {
      console.log(`\n${colors.red}No team ID provided. Operation cancelled.${colors.reset}`);
      return;
    }

    // Delete the team
    await deleteTeam(teamId);
  } catch (error) {
    console.error(
      `\n${colors.red}Error:${colors.reset}`,
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

// Run the main function
main();
