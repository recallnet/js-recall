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
 * Allocate rewards for a specific epoch
 * This script instantiates the RewardsService and calls the allocate method
 * on the provided epochId
 */
async function allocateRewards() {
  // Get the epochId from command line arguments
  const epochId = process.argv[2];

  if (!epochId) {
    console.error(
      `${colors.red}Error: Missing required parameter.${colors.reset}`,
    );
    console.log(
      `${colors.yellow}Usage: pnpm rewards:allocate <epochId>${colors.reset}`,
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

    console.log(`\n${colors.blue}Allocating rewards for epoch: ${colors.yellow}${epochId}${colors.reset}`);
    
    // Instantiate the RewardsService
    const rewardsService = new RewardsService();
    
    // Call the allocate method
    await rewardsService.allocate(epochId);
    
    console.log(`\n${colors.green}Successfully allocated rewards for epoch: ${colors.yellow}${epochId}${colors.reset}`);
    console.log(`${colors.green}Merkle tree has been built and stored in the database.${colors.reset}`);
    
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
