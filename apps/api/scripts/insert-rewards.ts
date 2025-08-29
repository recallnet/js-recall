import * as dotenv from "dotenv";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

import { db } from "@/database/db.js";
import { competitions } from "@/database/schema/core/defs.js";
import { rewards } from "@/database/schema/voting/defs.js";
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
 * Insert one competition and three rewards into the database
 */
async function insertCompetitionAndRewards() {
  try {
    console.log(
      `${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.cyan}║              INSERTING COMPETITION AND REWARDS                 ║${colors.reset}`,
    );
    console.log(
      `${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`,
    );

    // Insert competition
    const competitionId = uuidv4();

    console.log(
      `\n${colors.blue}Inserting competition with ID: ${colors.yellow}${competitionId}${colors.reset}`,
    );

    await db.insert(competitions).values({
      id: competitionId,
      name: "Test Competition",
      description: "A test competition for rewards",
      status: "active",
      type: "trading",
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
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
      `\n${colors.blue}Inserting rewards for competition: ${colors.yellow}${competitionId}${colors.reset}`,
    );

    // Insert rewards
    for (const reward of rewardsData) {
      const leafHash = createLeafNode(reward.address, reward.amount);

      await db.insert(rewards).values({
        id: uuidv4(),
        competitionId: competitionId,
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
      `\n${colors.green}Successfully inserted competition and rewards.${colors.reset}`,
    );
    console.log(
      `${colors.green}Competition ID: ${colors.yellow}${competitionId}${colors.reset}`,
    );
    console.log(
      `${colors.green}You can now run: ${colors.yellow}pnpm rewards:allocate ${competitionId}${colors.reset}`,
    );
  } catch (error) {
    console.error(
      `\n${colors.red}Error inserting competition and rewards:${colors.reset}`,
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  } finally {
    // Exit the process after clean closure
    process.exit(0);
  }
}

// Run the function
insertCompetitionAndRewards();
