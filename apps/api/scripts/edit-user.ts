/**
 * User Edit Script
 *
 * This script allows admins to edit existing user information in the Trading Simulator.
 * It connects directly to the database and does NOT require the server to be running.
 *
 * Usage:
 *   pnpm edit:user
 *
 * Or with command line arguments:
 *   pnpm edit:user -- "0x123..."
 *
 * The script will:
 * 1. Connect to the database
 * 2. Find the user by wallet address
 * 3. Update the user's wallet address
 * 4. Close the database connection
 */
import * as dotenv from "dotenv";
import { eq } from "drizzle-orm";
import * as path from "path";
import * as readline from "readline";

import { db } from "@/database/db.js";
import { users } from "@/database/schema/core/defs.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Create readline interface for prompting user
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

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

// Prompt function that returns a promise
function prompt(question: string): Promise<string> {
  // Add some visual highlighting to make the prompt stand out
  const highlightedQuestion = `\n${colors.cyan}>> ${question}${colors.reset}`;
  return new Promise((resolve) => {
    rl.question(highlightedQuestion, (answer) => {
      resolve(answer);
    });
  });
}

// Safe console log that won't be overridden
function safeLog(...args: unknown[]) {
  originalConsoleLog.apply(console, args);
}

// Store original console.log
const originalConsoleLog = console.log;

// Validate Ethereum address
function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Edit an existing user
 */
async function editUser() {
  try {
    // Banner with clear visual separation
    safeLog("\n\n");
    safeLog(
      `${colors.magenta}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    safeLog(
      `${colors.magenta}║                          EDIT USER                             ║${colors.reset}`,
    );
    safeLog(
      `${colors.magenta}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    safeLog(
      `\n${colors.cyan}This script allows you to edit user information in the Trading Simulator.${colors.reset}`,
    );
    safeLog(
      `${colors.cyan}You can update the user's wallet address.${colors.reset}`,
    );
    safeLog(
      `${colors.yellow}--------------------------------------------------------------${colors.reset}\n`,
    );

    // Get user details from command line arguments or prompt for them
    let walletAddress = process.argv[2];

    // Temporarily restore console.log for input
    console.log = originalConsoleLog;

    // Collect all input upfront before database operations
    if (!walletAddress) {
      walletAddress = await prompt(
        "Enter user wallet address to find the user:",
      );
      if (!walletAddress) {
        throw new Error("User wallet address is required");
      }
    }

    // Apply the quieter console.log during database operations
    console.log = function (...args) {
      // Only log critical errors, or explicit service messages
      if (typeof args[0] === "string" && args[0].includes("Error")) {
        originalConsoleLog.apply(console, args);
      }
    };

    // Find the user first
    safeLog(
      `\n${colors.blue}Finding user with wallet address: ${walletAddress}...${colors.reset}`,
    );

    // Fetch the user by wallet address
    const currentUser = await db.query.users.findFirst({
      where: eq(users.walletAddress, walletAddress),
    });

    if (!currentUser) {
      throw new Error(`No user found with wallet address: ${walletAddress}`);
    }

    safeLog(
      `\n${colors.green}✓ User found: ${currentUser.name}${colors.reset}`,
    );
    safeLog(`\n${colors.cyan}Current User Details:${colors.reset}`);
    safeLog(
      `${colors.cyan}----------------------------------------${colors.reset}`,
    );
    safeLog(`User ID: ${currentUser.id}`);
    safeLog(`User Name: ${currentUser.name}`);
    safeLog(`Email: ${currentUser.email}`);
    safeLog(`Wallet Address: ${currentUser.walletAddress || "Not set"}`);
    safeLog(
      `${colors.cyan}----------------------------------------${colors.reset}`,
    );

    const updateWallet =
      !walletAddress &&
      (await prompt(`Do you want to update the wallet address? (y/n):`));

    if (
      (updateWallet &&
        typeof updateWallet === "string" &&
        updateWallet.toLowerCase() === "y") ||
      walletAddress
    ) {
      if (!walletAddress) {
        walletAddress = await prompt("Enter new wallet address (0x...): ");
      }

      if (walletAddress && !isValidEthereumAddress(walletAddress)) {
        throw new Error(
          "Invalid Ethereum address format. Must be 0x followed by 40 hex characters.",
        );
      }
    }

    if (!walletAddress) {
      safeLog(
        `\n${colors.yellow}No changes requested. Operation cancelled.${colors.reset}`,
      );
      return;
    }

    // Display summary of changes
    safeLog(`\n${colors.yellow}Changes to be applied:${colors.reset}`);
    if (walletAddress) {
      safeLog(`- Wallet Address: ${walletAddress}`);
    }

    const confirmUpdate = await prompt(
      `${colors.yellow}Proceed with these changes? (y/n):${colors.reset}`,
    );

    if (confirmUpdate.toLowerCase() !== "y") {
      safeLog(`\n${colors.red}Update cancelled.${colors.reset}`);
      return;
    }

    // Proceed with updates
    safeLog(`\n${colors.blue}Updating user...${colors.reset}`);

    const updatedUser = await db.transaction(async (tx) => {
      // Get the latest user data since some time has passed
      const user = await tx.query.users.findFirst({
        where: eq(users.walletAddress, walletAddress),
      });
      if (!user) {
        tx.rollback();
        return;
      }
      const [result] = await tx
        .update(users)
        .set({
          walletAddress,
        })
        .where(eq(users.id, user.id))
        .returning();
      return result;
    });

    if (updatedUser) {
      safeLog(`\n${colors.green}✓ User updated successfully!${colors.reset}`);
      safeLog(`\n${colors.cyan}Updated User Details:${colors.reset}`);
      safeLog(
        `${colors.cyan}----------------------------------------${colors.reset}`,
      );
      safeLog(`User ID: ${updatedUser.id}`);
      safeLog(`User Name: ${updatedUser.name}`);
      safeLog(`Email: ${updatedUser.email}`);
      safeLog(`Wallet Address: ${updatedUser.walletAddress || "Not set"}`);
      safeLog(
        `${colors.cyan}----------------------------------------${colors.reset}`,
      );
    }
  } catch (error) {
    safeLog(
      `\n${colors.red}Error updating user:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );
  } finally {
    rl.close();

    // Restore original console.log before closing
    console.log = originalConsoleLog;

    // Exit the process after clean closure
    process.exit(0);
  }
}

// Run the edit function
editUser();
