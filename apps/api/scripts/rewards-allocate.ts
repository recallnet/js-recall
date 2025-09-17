import * as dotenv from "dotenv";
import * as path from "path";
import { parse } from "ts-command-line-args";

import { RewardsService } from "@/services/rewards.service.js";

// Color functions for terminal output
const blue = (str: string) => str;
const cyan = (str: string) => str;
const green = (str: string) => str;
const red = (str: string) => str;
const yellow = (str: string) => str;

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

/**
 * Interface for command line arguments
 */
interface IAllocateRewardsArgs {
  competitionId: string;
  tokenAddress: string;
  startTimestamp: string;
  help?: boolean;
}

/**
 * Allocate rewards for a specific competition
 * This script instantiates the RewardsService and calls the allocate method
 * on the provided competitionId
 */
async function allocateRewards() {
  // Parse command line arguments
  const args = parse<IAllocateRewardsArgs>(
    {
      competitionId: {
        type: String,
        alias: "c",
        description: "The competition ID (UUID format)",
      },
      tokenAddress: {
        type: String,
        alias: "t",
        description: "The token contract address (0x... format)",
      },
      startTimestamp: {
        type: String,
        alias: "s",
        description:
          "The start timestamp for the reward allocation (Unix timestamp)",
      },
      help: {
        type: Boolean,
        alias: "h",
        optional: true,
        description: "Show this help message",
      },
    },
    {
      helpArg: "help",
      headerContentSections: [
        {
          header: "Rewards Allocation Script",
          content:
            "Allocates rewards for a specific competition by building a Merkle tree and storing it in the database.",
        },
      ],
      footerContentSections: [
        {
          header: "Example",
          content:
            "pnpm rewards:allocate --competitionId 123e4567-e89b-12d3-a456-426614174000 --tokenAddress 0x1234567890123456789012345678901234567890 --startTimestamp 1704067200",
        },
      ],
    },
  );

  try {
    console.log(
      cyan(
        `╔════════════════════════════════════════════════════════════════╗`,
      ),
    );
    console.log(
      cyan(`║                   ALLOCATING REWARDS                          ║`),
    );
    console.log(
      cyan(
        `╚════════════════════════════════════════════════════════════════╝`,
      ),
    );

    console.log(
      `\n${blue("Allocating rewards for competition:")} ${yellow(args.competitionId)}`,
    );
    console.log(`${blue("Token Address:")} ${yellow(args.tokenAddress)}`);
    console.log(`${blue("Start Timestamp:")} ${yellow(args.startTimestamp)}`);

    // Instantiate the RewardsService (will use config-based RewardsAllocator)
    const rewardsService = new RewardsService();

    // Call the allocate method with all required parameters
    await rewardsService.allocate(
      args.competitionId,
      args.tokenAddress as `0x${string}`,
      parseInt(args.startTimestamp),
    );

    console.log(
      `\n${green("Successfully allocated rewards for competition:")} ${yellow(args.competitionId)}`,
    );
    console.log(
      green(`Merkle tree has been built and stored in the database.`),
    );
  } catch (error) {
    console.error(
      `\n${red("Error allocating rewards:")}`,
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
