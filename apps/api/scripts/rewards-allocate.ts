import * as dotenv from "dotenv";
import * as path from "path";

import { RewardsService } from "@/services/rewards.service.js";

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
 * Allocate rewards for a specific competition
 * This script instantiates the RewardsService and calls the allocate method
 * on the provided competitionId
 */
async function allocateRewards() {
  // Get the required parameters from command line arguments
  const competitionId = process.argv[2];
  const tokenAddress = process.argv[3];
  const startTimestamp = process.argv[4];

  if (!competitionId || !tokenAddress || !startTimestamp) {
    console.error(
      `${colors.red}Error: Missing required parameters.${colors.reset}`,
    );
    console.log(
      `${colors.cyan}Example: pnpm rewards:allocate 123e4567-e89b-12d3-a456-426614174000 0x1234567890123456789012345678901234567890 1704067200${colors.reset}`,
    );
    process.exit(1);
  }

  try {
    console.log(
      `${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.cyan}║                   ALLOCATING REWARDS                          ║${colors.reset}`,
    );
    console.log(
      `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    console.log(
      `\n${colors.blue}Allocating rewards for competition: ${colors.yellow}${competitionId}${colors.reset}`,
    );
    console.log(
      `${colors.blue}Token Address: ${colors.yellow}${tokenAddress}${colors.reset}`,
    );
    console.log(
      `${colors.blue}Start Timestamp: ${colors.yellow}${startTimestamp}${colors.reset}`,
    );

    // Instantiate the RewardsService (will use config-based RewardsAllocator)
    const rewardsService = new RewardsService();

    // Call the allocate method with all required parameters
    await rewardsService.allocate(
      competitionId,
      tokenAddress as `0x${string}`,
      parseInt(startTimestamp),
    );

    console.log(
      `\n${colors.green}Successfully allocated rewards for competition: ${colors.yellow}${competitionId}${colors.reset}`,
    );
    console.log(
      `${colors.green}Merkle tree has been built and stored in the database.${colors.reset}`,
    );
  } catch (error) {
    console.error(
      `\n${colors.red}Error allocating rewards:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  } finally {
    // Exit the process after clean closure
    process.exit(0);
  }
}

// Run the function
allocateRewards();
