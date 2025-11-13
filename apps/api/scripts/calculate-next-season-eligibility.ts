#!/usr/bin/env tsx
import { and, gte, sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { parseArgs } from "util";

import { convictionClaims } from "@recallnet/db/schema/conviction-claims/defs";

import { db } from "@/database/db.js";

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

interface EligibleAccount {
  address: string;
  activeStake: bigint;
  reward: bigint;
}

/**
 * Calculate eligibility for the next season of conviction claims airdrop.
 *
 * This script:
 * 1. Finds accounts with active stakes (where ex-date > reference time)
 * 2. Calculates total forfeited amounts from all seasons
 * 3. Subtracts claims from subsequent seasons to get available pool
 * 4. Distributes rewards proportionally based on active stake amounts
 */
async function calculateNextSeasonEligibility() {
  // Parse command line arguments
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      season: {
        type: "string",
        short: "s",
        description: "Season number for the output",
      },
      time: {
        type: "string",
        short: "t",
        description:
          "Reference time in ISO format (e.g., 2024-12-31T00:00:00Z)",
      },
      concat: {
        type: "boolean",
        short: "c",
        description: "Append new data to existing airdrop-data.csv",
      },
      help: {
        type: "boolean",
        short: "h",
        description: "Show help",
      },
    },
  });

  if (values.help) {
    console.log(`
${colors.cyan}Calculate Next Season Eligibility for Conviction Claims Airdrop${colors.reset}

Usage: pnpm tsx calculate-next-season-eligibility.ts --season <number> --time <ISO-date> [--concat]

Options:
  -s, --season    Season number for the output (required)
  -t, --time      Reference time in ISO format (required)
                  Example: 2024-12-31T00:00:00Z
  -c, --concat    Append new data to existing airdrop-data.csv
  -h, --help      Show this help message

Examples:
  pnpm tsx calculate-next-season-eligibility.ts --season 2 --time "2024-12-31T00:00:00Z"
  pnpm tsx calculate-next-season-eligibility.ts --season 2 --time "2024-12-31T00:00:00Z" --concat
`);
    process.exit(0);
  }

  // Validate arguments
  if (!values.season) {
    console.error(`${colors.red}Error: --season is required${colors.reset}`);
    process.exit(1);
  }

  if (!values.time) {
    console.error(`${colors.red}Error: --time is required${colors.reset}`);
    process.exit(1);
  }

  const seasonNumber = parseInt(values.season);
  if (isNaN(seasonNumber) || seasonNumber < 0) {
    console.error(`${colors.red}Error: Invalid season number${colors.reset}`);
    process.exit(1);
  }

  const referenceTime = new Date(values.time);
  if (isNaN(referenceTime.getTime())) {
    console.error(
      `${colors.red}Error: Invalid time format. Use ISO format like 2024-12-31T00:00:00Z${colors.reset}`,
    );
    process.exit(1);
  }

  console.log(
    `${colors.cyan}🔍 Calculating eligibility for season ${seasonNumber}${colors.reset}`,
  );
  console.log(`📅 Reference time: ${referenceTime.toISOString()}\n`);

  try {
    // Step 1: Find all accounts with active stakes
    console.log(
      `${colors.blue}Step 1: Finding accounts with active stakes...${colors.reset}`,
    );

    // Active stakes are those where blockTimestamp + duration > referenceTime
    // We need to convert duration (seconds) to milliseconds and add to timestamp
    const activeStakesQuery = await db
      .select({
        account: convictionClaims.account,
        claimedAmount: convictionClaims.claimedAmount,
        blockTimestamp: convictionClaims.blockTimestamp,
        duration: convictionClaims.duration,
        season: convictionClaims.season,
      })
      .from(convictionClaims)
      .where(
        and(
          // Only claims with duration > 0 (actual stakes)
          gte(convictionClaims.duration, 1n),
          // Ex-date calculation: blockTimestamp + duration seconds > referenceTime
          sql`${convictionClaims.blockTimestamp} + (${convictionClaims.duration} * interval '1 second') > ${referenceTime}`,
        ),
      );

    // Group active stakes by account
    const accountStakes = new Map<string, bigint>();
    for (const stake of activeStakesQuery) {
      const current = accountStakes.get(stake.account) || 0n;
      accountStakes.set(stake.account, current + stake.claimedAmount);
    }

    console.log(`✅ Found ${accountStakes.size} accounts with active stakes\n`);

    // Step 2: Calculate total active stakes
    console.log(
      `${colors.blue}Step 2: Calculating total active stakes...${colors.reset}`,
    );

    let totalActiveStakes = 0n;
    for (const stakeAmount of accountStakes.values()) {
      totalActiveStakes += stakeAmount;
    }

    console.log(`📊 Total active stakes: ${totalActiveStakes.toString()}\n`);

    // Step 3: Calculate total forfeited amounts
    console.log(
      `${colors.blue}Step 3: Calculating total forfeited amounts...${colors.reset}`,
    );

    // Get all claims to calculate forfeited amounts
    const allClaims = await db
      .select({
        eligibleAmount: convictionClaims.eligibleAmount,
        claimedAmount: convictionClaims.claimedAmount,
        season: convictionClaims.season,
      })
      .from(convictionClaims);

    // Calculate total forfeited (eligibleAmount - claimedAmount for each claim)
    let totalForfeited = 0n;
    const forfeitedBySeason = new Map<number, bigint>();

    for (const claim of allClaims) {
      const forfeited = claim.eligibleAmount - claim.claimedAmount;
      totalForfeited += forfeited;

      const currentSeasonForfeited = forfeitedBySeason.get(claim.season) || 0n;
      forfeitedBySeason.set(claim.season, currentSeasonForfeited + forfeited);
    }

    console.log(
      `💰 Total forfeited across all seasons: ${totalForfeited.toString()}`,
    );

    // Show breakdown by season
    for (const [season, amount] of forfeitedBySeason.entries()) {
      console.log(`   Season ${season}: ${amount.toString()}`);
    }

    // Step 4: Calculate claims from subsequent seasons (seasons after 0)
    console.log(
      `\n${colors.blue}Step 4: Calculating claims from subsequent seasons...${colors.reset}`,
    );

    const subsequentSeasonClaims = await db
      .select({
        season: convictionClaims.season,
        totalClaimed: sql<string>`SUM(${convictionClaims.claimedAmount})`.as(
          "totalClaimed",
        ),
      })
      .from(convictionClaims)
      .where(gte(convictionClaims.season, 1))
      .groupBy(convictionClaims.season);

    let totalSubsequentClaims = 0n;
    for (const seasonData of subsequentSeasonClaims) {
      const claimed = BigInt(seasonData.totalClaimed || "0");
      totalSubsequentClaims += claimed;
      console.log(`   Season ${seasonData.season}: ${claimed.toString()}`);
    }

    if (subsequentSeasonClaims.length === 0) {
      console.log(`   No subsequent season claims found`);
    }

    // Step 5: Calculate available rewards pool
    console.log(
      `\n${colors.blue}Step 5: Calculating available rewards pool...${colors.reset}`,
    );

    const availableRewards = totalForfeited - totalSubsequentClaims;
    console.log(`🎁 Available rewards: ${availableRewards.toString()}`);
    console.log(
      `   (${totalForfeited.toString()} forfeited - ${totalSubsequentClaims.toString()} already claimed)\n`,
    );

    // Step 6: Calculate individual rewards
    console.log(
      `${colors.blue}Step 6: Calculating individual rewards...${colors.reset}`,
    );

    const eligibleAccounts: EligibleAccount[] = [];

    if (totalActiveStakes > 0n && availableRewards > 0n) {
      for (const [address, activeStake] of accountStakes.entries()) {
        // Calculate proportional reward: (account_stake / total_stakes) * available_rewards
        const reward = (activeStake * availableRewards) / totalActiveStakes;

        eligibleAccounts.push({
          address,
          activeStake,
          reward,
        });
      }
    }

    // Sort by reward amount (descending)
    eligibleAccounts.sort((a, b) => {
      if (a.reward > b.reward) return -1;
      if (a.reward < b.reward) return 1;
      return 0;
    });

    console.log(
      `✅ Calculated rewards for ${eligibleAccounts.length} accounts\n`,
    );

    // Step 7: Generate CSV output
    console.log(
      `${colors.blue}Step 7: Generating CSV output...${colors.reset}`,
    );

    const csvFileName = `airdrop_${seasonNumber}_${referenceTime.toISOString()}.csv`;
    const csvPath = path.join(process.cwd(), "scripts", "data", csvFileName);

    // Create CSV header
    const csvLines: string[] = [
      "address,amount,season,category,sybilClassification,flaggedAt,flaggingReason,powerUser,recallSnapper,aiBuilder,aiExplorer",
    ];

    // Add data rows
    for (const account of eligibleAccounts) {
      // Format: address,amount,season,category,sybilClassification,flaggedAt,flaggingReason,powerUser,recallSnapper,aiBuilder,aiExplorer
      // We're only filling in address, amount, season, and category
      // Other fields are left empty or set to 0 as defaults
      const row = [
        account.address,
        account.reward.toString(),
        seasonNumber.toString(),
        "conviction_staking", // category
        "", // sybilClassification
        "", // flaggedAt
        "", // flaggingReason
        "0", // powerUser
        "0", // recallSnapper
        "0", // aiBuilder
        "0", // aiExplorer
      ].join(",");

      csvLines.push(row);
    }

    // Write CSV file
    fs.writeFileSync(csvPath, csvLines.join("\n"));

    console.log(
      `✅ CSV file written to: ${colors.green}scripts/data/${csvFileName}${colors.reset}\n`,
    );

    // Step 8: Append to master airdrop-data.csv if --concat flag is set
    if (values.concat) {
      console.log(
        `${colors.blue}Step 8: Appending to airdrop-data.csv...${colors.reset}`,
      );

      const masterCsvPath = path.join(
        process.cwd(),
        "scripts",
        "data",
        "airdrop-data.csv",
      );

      // Read existing airdrop-data.csv
      if (fs.existsSync(masterCsvPath)) {
        const existingData = fs.readFileSync(masterCsvPath, "utf-8");
        const existingLines = existingData.split("\n");

        // Skip the header from new data (csvLines[0]) and append only the data rows
        const newDataWithoutHeader = csvLines.slice(1);

        // Combine existing data with new data
        const combinedLines = [...existingLines];

        // If existing file doesn't end with newline, add one before appending
        if (existingLines[existingLines.length - 1] !== "") {
          combinedLines.push(...newDataWithoutHeader);
        } else {
          // Replace the empty last line with new data
          combinedLines.splice(
            existingLines.length - 1,
            1,
            ...newDataWithoutHeader,
          );
        }

        // Write the combined data back to airdrop-data.csv
        fs.writeFileSync(masterCsvPath, combinedLines.join("\n"));

        console.log(
          `✅ Data appended to: ${colors.green}scripts/data/airdrop-data.csv${colors.reset}`,
        );
        console.log(`   Added ${newDataWithoutHeader.length} new entries\n`);
      } else {
        console.log(
          `${colors.yellow}⚠️  Warning: airdrop-data.csv not found. Creating new file.${colors.reset}`,
        );
        // If master file doesn't exist, create it with full data including header
        fs.writeFileSync(masterCsvPath, csvLines.join("\n"));
        console.log(
          `✅ Created new file: ${colors.green}scripts/data/airdrop-data.csv${colors.reset}\n`,
        );
      }
    }

    // Summary
    console.log(`${colors.magenta}📊 Summary:${colors.reset}`);
    console.log(`   Total eligible accounts: ${eligibleAccounts.length}`);
    console.log(`   Total active stakes: ${totalActiveStakes.toString()}`);
    console.log(`   Total available rewards: ${availableRewards.toString()}`);
    console.log(
      `   Total distributed: ${eligibleAccounts.reduce((sum, a) => sum + a.reward, 0n).toString()}`,
    );

    if (eligibleAccounts.length > 0) {
      console.log(`\n${colors.cyan}Top 5 recipients:${colors.reset}`);
      for (let i = 0; i < Math.min(5, eligibleAccounts.length); i++) {
        const account = eligibleAccounts[i];
        console.log(
          `   ${i + 1}. ${account?.address}: ${account?.reward.toString()}`,
        );
      }
    }
  } catch (error) {
    console.error(`${colors.red}Error: ${error}${colors.reset}`);
    process.exit(1);
  }

  process.exit(0);
}

// Run the script
calculateNextSeasonEligibility().catch((error) => {
  console.error(`${colors.red}Fatal error: ${error}${colors.reset}`);
  process.exit(1);
});
