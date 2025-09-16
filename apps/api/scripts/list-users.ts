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
async function listAllUsers() {
  try {
    console.log(
      `${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.cyan}║                          USER LISTING                          ║${colors.reset}`,
    );
    console.log(
      `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    const users = await services.userService.getAllUsers();

    if (users.length === 0) {
      console.log(
        `\n${colors.yellow}No agents found in the database.${colors.reset}`,
      );
      return;
    }

    console.log(
      `\n${colors.green}Found ${users.length} registered user(s):${colors.reset}\n`,
    );

    // Sort agents by creation date (newest first)
    users.sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
    );

    users.forEach((user, i) => {
      const created = user.createdAt?.toLocaleString();
      const updated = user.updatedAt?.toLocaleString();

      console.log(
        `${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
      );
      console.log(
        `${colors.cyan}║ USER #${i + 1}${" ".repeat(60 - `USER #${i + 1}`.length)}║${colors.reset}`,
      );
      console.log(
        `${colors.cyan}╠════════════════════════════════════════════════════════════════╣${colors.reset}`,
      );
      console.log(
        `${colors.cyan}║${colors.reset} ID:             ${colors.yellow}${user.id}${colors.reset}`,
      );
      console.log(
        `${colors.cyan}║${colors.reset} Name:           ${colors.green}${user.name}${colors.reset}`,
      );
      console.log(
        `${colors.cyan}║${colors.reset} Email:          ${colors.green}${user.email}${colors.reset}`,
      );
      console.log(`${colors.cyan}║${colors.reset} Created:        ${created}`);
      console.log(`${colors.cyan}║${colors.reset} Last Updated:   ${updated}`);
      console.log(
        `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
      );

      if (i < users.length - 1) {
        console.log(""); // Add an empty line between users
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
listAllUsers();
