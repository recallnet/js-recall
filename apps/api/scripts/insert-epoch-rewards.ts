import * as dotenv from "dotenv";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

import { db } from "@/database/db.js";
import { epochs, rewards } from "@/database/schema/voting/defs.js";
import { createLeafNode } from "@/services/rewards.service.js";

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
 * Insert one epoch and three rewards into the database
 */
async function insertEpochAndRewards() {
  try {
    console.log(
      `${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.cyan}║                INSERTING EPOCH AND REWARDS                    ║${colors.reset}`,
    );
    console.log(
      `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    // Insert epoch
    const epochId = uuidv4();

    console.log(
      `\n${colors.blue}Inserting epoch with ID: ${colors.yellow}${epochId}${colors.reset}`,
    );

    await db.insert(epochs).values({
      id: epochId,
      startedAt: new Date(),
      endedAt: null,
    });

    // Define reward data
    const rewardsData = [
      {
        address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        amount: BigInt("100000000000000000000"), // 100 tokens with 18 decimals
      },
      {
        address: "0x2345678901234567890123456789012345678901" as `0x${string}`,
        amount: BigInt("200000000000000000000"), // 200 tokens with 18 decimals
      },
      {
        address: "0x3456789012345678901234567890123456789012" as `0x${string}`,
        amount: BigInt("300000000000000000000"), // 300 tokens with 18 decimals
      },
    ];

    console.log(
      `\n${colors.blue}Inserting rewards for epoch: ${colors.yellow}${epochId}${colors.reset}`,
    );

    // Insert rewards
    for (const reward of rewardsData) {
      const leafHash = createLeafNode(reward.address, reward.amount);

      await db.insert(rewards).values({
        id: uuidv4(),
        epoch: epochId,
        address: reward.address,
        amount: reward.amount,
        leafHash: new Uint8Array(leafHash),
        claimed: false,
      });

      console.log(
        `${colors.green}Inserted reward for address: ${colors.yellow}${reward.address}${colors.reset} with amount: ${colors.yellow}${reward.amount.toString()}${colors.reset}`,
      );
    }

    console.log(
      `\n${colors.green}Successfully inserted epoch and rewards.${colors.reset}`,
    );
    console.log(
      `${colors.green}Epoch ID: ${colors.yellow}${epochId}${colors.reset}`,
    );
    console.log(
      `${colors.green}You can now run: ${colors.yellow}pnpm rewards:allocate ${epochId}${colors.reset}`,
    );
  } catch (error) {
    console.error(
      `\n${colors.red}Error inserting epoch and rewards:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  } finally {
    // Exit the process after clean closure
    process.exit(0);
  }
}

// Run the function
insertEpochAndRewards();
