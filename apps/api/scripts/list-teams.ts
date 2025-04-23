import * as dotenv from 'dotenv';
import * as path from 'path';
import { services } from '../src/services';
import { DatabaseConnection } from '../src/database';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Colors for console output
const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
};

/**
 * List all registered teams with detailed information
 */
async function listAllTeams() {
  try {
    console.log(
      `${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.cyan}║                          TEAM LISTING                         ║${colors.reset}`,
    );
    console.log(
      `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    const teams = await services.teamManager.getAllTeams(false);

    if (teams.length === 0) {
      console.log(`\n${colors.yellow}No teams found in the database.${colors.reset}`);
      return;
    }

    console.log(`\n${colors.green}Found ${teams.length} registered team(s):${colors.reset}\n`);

    // Sort teams by creation date (newest first)
    teams.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      const created = new Date(team.createdAt).toLocaleString();
      const updated = new Date(team.updatedAt).toLocaleString();

      console.log(
        `${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
      );
      console.log(
        `${colors.cyan}║ TEAM #${i + 1}${' '.repeat(60 - `TEAM #${i + 1}`.length)}║${colors.reset}`,
      );
      console.log(
        `${colors.cyan}╠════════════════════════════════════════════════════════════════╣${colors.reset}`,
      );
      console.log(
        `${colors.cyan}║${colors.reset} ID:             ${colors.yellow}${team.id}${colors.reset}`,
      );
      console.log(
        `${colors.cyan}║${colors.reset} Name:           ${colors.green}${team.name}${colors.reset}`,
      );
      console.log(
        `${colors.cyan}║${colors.reset} Email:          ${colors.green}${team.email}${colors.reset}`,
      );
      console.log(
        `${colors.cyan}║${colors.reset} Contact Person: ${colors.green}${team.contactPerson}${colors.reset}`,
      );
      console.log(
        `${colors.cyan}║${colors.reset} API Key:        ${colors.magenta}${team.apiKey}${colors.reset}`,
      );
      console.log(`${colors.cyan}║${colors.reset} Created:        ${created}`);
      console.log(`${colors.cyan}║${colors.reset} Last Updated:   ${updated}`);
      console.log(
        `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
      );

      if (i < teams.length - 1) {
        console.log(''); // Add an empty line between teams
      }
    }

    console.log(`\n${colors.green}End of team listing.${colors.reset}`);
  } catch (error) {
    console.error(
      `\n${colors.red}Error listing teams:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );
  } finally {
    // Close database connection
    await DatabaseConnection.getInstance().close();

    // Exit the process after clean closure
    process.exit(0);
  }
}

// Run the function
listAllTeams();
