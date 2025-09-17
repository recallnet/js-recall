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
 * List all registered agents to help user find the agent ID
 */
async function listAllUsers() {
  try {
    const users = await services.userService.getAllUsers();

    if (users.length === 0) {
      console.log(
        `\n${colors.yellow}No users found in the database.${colors.reset}`,
      );
      return;
    }

    console.log(`\n${colors.cyan}Registered Users:${colors.reset}`);
    console.log(
      `${colors.cyan}----------------------------------------${colors.reset}`,
    );

    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.id})`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Created: ${user.createdAt?.toLocaleString()}`);
      if (index < users.length - 1) {
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
      `\n${colors.red}Error listing agents:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Delete a agent by ID
 */
async function deleteUser(userId: string) {
  try {
    // Get agent details first to confirm
    const user = await services.userService.getUser(userId);

    if (!user) {
      console.log(
        `\n${colors.red}Error: User with ID ${userId} not found.${colors.reset}`,
      );
      return false;
    }

    console.log(`\n${colors.yellow}User found:${colors.reset}`);
    console.log(`- User ID: ${user.id}`);
    console.log(`- User Name: ${user.name}`);
    console.log(`- Email: ${user.email}`);

    const confirmation =
      await prompt(`\n${colors.red}WARNING: This will permanently delete this user and all associated data.${colors.reset}
${colors.red}Type the user name (${user.name}) to confirm deletion:${colors.reset} `);

    if (confirmation !== user.name) {
      console.log(
        `\n${colors.yellow}Deletion cancelled. Agent name confirmation did not match.${colors.reset}`,
      );
      return false;
    }

    console.log(`\n${colors.blue}Deleting agent...${colors.reset}`);

    // Delete the agent
    const result = await services.userService.deleteUser(userId);

    if (result) {
      console.log(
        `\n${colors.green}✓ User "${user.name}" deleted successfully!${colors.reset}`,
      );
      return true;
    } else {
      console.log(
        `\n${colors.red}Failed to delete user "${user.name}".${colors.reset}`,
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
      `${colors.cyan}║                          DELETE USER                          ║${colors.reset}`,
    );
    console.log(
      `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    console.log(
      `\nThis script will delete a agent from the Trading Simulator.`,
    );
    console.log(`You'll need to provide the agent ID to delete.`);

    // Check if agent ID was provided as command-line argument
    let userId = process.argv[2];

    // If no agent ID provided, ask if user wants to list agents
    if (!userId) {
      const listUsers = await prompt(
        `\n${colors.yellow}Do you want to list all registered agents? (y/n):${colors.reset} `,
      );

      if (listUsers.toLowerCase() === "y") {
        await listAllUsers();
      }

      userId = await prompt(
        `\n${colors.yellow}Enter the ID of the agent to delete:${colors.reset} `,
      );
    }

    if (!userId) {
      console.log(
        `\n${colors.red}No user ID provided. Operation cancelled.${colors.reset}`,
      );
      return;
    }

    // Delete the user
    await deleteUser(userId);
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
