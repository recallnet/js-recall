/**
 * Team Edit Script
 *
 * This script allows admins to edit existing team information in the Trading Simulator.
 * It connects directly to the database and does NOT require the server to be running.
 *
 * Usage:
 *   npm run edit:team
 *
 * Or with command line arguments:
 *   npm run edit:team -- "team@email.com" "0x123..." "0xabc..."
 *
 * The script will:
 * 1. Connect to the database
 * 2. Find the team by email
 * 3. Update the team's wallet address and/or bucket addresses
 * 4. Close the database connection
 */
import * as readline from 'readline';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DatabaseConnection } from '../src/database';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Create readline interface for prompting user
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

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

// Define team interface for type safety
interface TeamRecord {
  id: string;
  name: string;
  email: string;
  contact_person: string;
  wallet_address?: string;
  bucket_addresses?: string[];
}

/**
 * Edit an existing team
 */
async function editTeam() {
  try {
    // Banner with clear visual separation
    safeLog('\n\n');
    safeLog(
      `${colors.magenta}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    safeLog(
      `${colors.magenta}║                          EDIT TEAM                             ║${colors.reset}`,
    );
    safeLog(
      `${colors.magenta}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    safeLog(
      `\n${colors.cyan}This script allows you to edit team information in the Trading Simulator.${colors.reset}`,
    );
    safeLog(
      `${colors.cyan}You can update the team's wallet address and bucket addresses.${colors.reset}`,
    );
    safeLog(
      `${colors.yellow}--------------------------------------------------------------${colors.reset}\n`,
    );

    // Get team details from command line arguments or prompt for them
    let teamEmail = process.argv[2];
    let walletAddress = process.argv[3];
    let bucketAddress = process.argv[4];

    // Temporarily restore console.log for input
    console.log = originalConsoleLog;

    // Collect all input upfront before database operations
    if (!teamEmail) {
      teamEmail = await prompt('Enter team email to find the team:');
      if (!teamEmail) {
        throw new Error('Team email is required');
      }
    }

    // Apply the quieter console.log during database operations
    console.log = function (...args) {
      // Only log critical errors, or explicit service messages
      if (typeof args[0] === 'string' && args[0].includes('Error')) {
        originalConsoleLog.apply(console, args);
      }
    };

    // Find the team first
    safeLog(`\n${colors.blue}Finding team with email: ${teamEmail}...${colors.reset}`);

    // Fetch the team by email
    const db = DatabaseConnection.getInstance();
    const team = await db.query('SELECT * FROM teams WHERE email = $1', [teamEmail]);

    if (!team.rows || team.rows.length === 0) {
      throw new Error(`No team found with email: ${teamEmail}`);
    }

    const currentTeam = team.rows[0] as unknown as TeamRecord;

    safeLog(`\n${colors.green}✓ Team found: ${currentTeam.name}${colors.reset}`);
    safeLog(`\n${colors.cyan}Current Team Details:${colors.reset}`);
    safeLog(`${colors.cyan}----------------------------------------${colors.reset}`);
    safeLog(`Team ID: ${currentTeam.id}`);
    safeLog(`Team Name: ${currentTeam.name}`);
    safeLog(`Email: ${currentTeam.email}`);
    safeLog(`Contact: ${currentTeam.contact_person}`);
    safeLog(`Wallet Address: ${currentTeam.wallet_address || 'Not set'}`);
    safeLog(
      `Bucket Addresses: ${currentTeam.bucket_addresses ? currentTeam.bucket_addresses.join(', ') : 'None'}`,
    );
    safeLog(`${colors.cyan}----------------------------------------${colors.reset}`);

    const updateWallet =
      !walletAddress && (await prompt(`Do you want to update the wallet address? (y/n):`));

    if (
      (updateWallet && typeof updateWallet === 'string' && updateWallet.toLowerCase() === 'y') ||
      walletAddress
    ) {
      if (!walletAddress) {
        walletAddress = await prompt('Enter new wallet address (0x...): ');
      }

      if (walletAddress && !isValidEthereumAddress(walletAddress)) {
        throw new Error(
          'Invalid Ethereum address format. Must be 0x followed by 40 hex characters.',
        );
      }
    }

    const updateBucket =
      !bucketAddress && (await prompt(`Do you want to add a bucket address? (y/n):`));

    if (
      (updateBucket && typeof updateBucket === 'string' && updateBucket.toLowerCase() === 'y') ||
      bucketAddress
    ) {
      if (!bucketAddress) {
        bucketAddress = await prompt('Enter bucket address to add (0x...): ');
      }

      if (bucketAddress && !isValidEthereumAddress(bucketAddress)) {
        throw new Error('Invalid bucket address format. Must be 0x followed by 40 hex characters.');
      }
    }

    if (!walletAddress && !bucketAddress) {
      safeLog(`\n${colors.yellow}No changes requested. Operation cancelled.${colors.reset}`);
      return;
    }

    // Display summary of changes
    safeLog(`\n${colors.yellow}Changes to be applied:${colors.reset}`);
    if (walletAddress) {
      safeLog(`- Wallet Address: ${walletAddress}`);
    }
    if (bucketAddress) {
      safeLog(`- Add Bucket Address: ${bucketAddress}`);
    }

    const confirmUpdate = await prompt(
      `${colors.yellow}Proceed with these changes? (y/n):${colors.reset}`,
    );

    if (confirmUpdate.toLowerCase() !== 'y') {
      safeLog(`\n${colors.red}Update cancelled.${colors.reset}`);
      return;
    }

    // Proceed with updates
    safeLog(`\n${colors.blue}Updating team...${colors.reset}`);

    let params = [];
    let updateFields = [];
    let paramIndex = 1;

    if (walletAddress) {
      updateFields.push(`wallet_address = $${paramIndex}`);
      params.push(walletAddress);
      paramIndex++;
    }

    if (bucketAddress) {
      // If bucket_addresses is null, initialize as an array with the new address
      // Otherwise, append to the existing array
      updateFields.push(`bucket_addresses = CASE 
        WHEN bucket_addresses IS NULL THEN ARRAY[$${paramIndex}]::TEXT[] 
        WHEN $${paramIndex} = ANY(bucket_addresses) THEN bucket_addresses 
        ELSE array_append(bucket_addresses, $${paramIndex}) 
      END`);
      params.push(bucketAddress);
      paramIndex++;
    }

    if (updateFields.length > 0) {
      params.push(currentTeam.id);
      const updateQuery = `
        UPDATE teams 
        SET ${updateFields.join(', ')} 
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await db.query(updateQuery, params);
      const updatedTeam = result.rows[0] as unknown as TeamRecord;

      safeLog(`\n${colors.green}✓ Team updated successfully!${colors.reset}`);
      safeLog(`\n${colors.cyan}Updated Team Details:${colors.reset}`);
      safeLog(`${colors.cyan}----------------------------------------${colors.reset}`);
      safeLog(`Team ID: ${updatedTeam.id}`);
      safeLog(`Team Name: ${updatedTeam.name}`);
      safeLog(`Email: ${updatedTeam.email}`);
      safeLog(`Contact: ${updatedTeam.contact_person}`);
      safeLog(`Wallet Address: ${updatedTeam.wallet_address || 'Not set'}`);
      safeLog(
        `Bucket Addresses: ${updatedTeam.bucket_addresses ? updatedTeam.bucket_addresses.join(', ') : 'None'}`,
      );
      safeLog(`${colors.cyan}----------------------------------------${colors.reset}`);
    }
  } catch (error) {
    safeLog(
      `\n${colors.red}Error updating team:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );
  } finally {
    rl.close();

    // Restore original console.log before closing
    console.log = originalConsoleLog;

    // Close database connection
    try {
      await DatabaseConnection.getInstance().close();
      safeLog('Database connection closed.');
    } catch (err) {
      safeLog('Error closing database connection:', err);
    }

    // Exit the process after clean closure
    process.exit(0);
  }
}

// Run the edit function
editTeam();
