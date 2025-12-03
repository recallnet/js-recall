#!/usr/bin/env tsx
import { and, eq, gte, lte, sql, sum } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { parseArgs } from "util";

import { attoValueToStringValue } from "@recallnet/conversions/atto-conversions";
import { BlockchainAddressAsU8A } from "@recallnet/db/coders";
import { seasons } from "@recallnet/db/schema/airdrop/defs";
import { agentBoosts, boostChanges } from "@recallnet/db/schema/boost/defs";
import { convictionClaims } from "@recallnet/db/schema/conviction-claims/defs";
import {
  agents,
  competitionAgents,
  competitions,
  users,
} from "@recallnet/db/schema/core/defs";

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
 * Calculates the median of an array of bigints.
 * For even-length arrays, returns the average of the two middle elements.
 */
function calculateMedian(values: bigint[]): bigint {
  if (values.length === 0) return 0n;

  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  if (sorted.length % 2 === 1) {
    return sorted[Math.floor(sorted.length / 2)]!;
  }

  return (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2n;
}

/**
 * Calculate eligibility for the next conviction claims airdrop.
 *
 * This script:
 * 1. Finds accounts with stakes that are locked until after the start of the
 *    given season
 * 2. Calculates total forfeited amounts from all seasons
 * 3. Subtracts claims from conviction claim seasons to get available pool
 * 4. Distributes rewards proportionally based on locked stake amounts
 */
async function calculateNextSeasonEligibility() {
  // Parse command line arguments
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      airdrop: {
        type: "string",
        short: "a",
        description: "Airdrop number to be calculated",
      },
      prepend: {
        type: "string",
        short: "p",
        description:
          "Prepend existing data from the specified file to the new csv file",
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

Usage: pnpm tsx calculate-next-season-eligibility.ts --airdrop <number> [--prepend <file>]

Options:
  -a, --airdrop   Airdrop number for the output (required)
  -p, --prepend   Prepend existing data from the specified file to the new csv file
  -h, --help      Show this help message

Examples:
  pnpm tsx calculate-next-season-eligibility.ts --airdrop 2
  pnpm tsx calculate-next-season-eligibility.ts --airdrop 2 --prepend airdrop_1_2024-11-29T00:00:00.000Z.csv
`);
    process.exit(0);
  }

  // Validate arguments
  if (!values.airdrop) {
    console.error(`${colors.red}Error: --airdrop is required${colors.reset}`);
    process.exit(1);
  }

  const airdropNumber = parseInt(values.airdrop, 10);
  if (isNaN(airdropNumber) || airdropNumber < 1) {
    console.error(`${colors.red}Error: Invalid airdrop number${colors.reset}`);
    process.exit(1);
  }

  console.log(
    `${colors.cyan}🔍 Calculating eligibility for airdrop season ${airdropNumber}${colors.reset}`,
  );

  try {
    // Step 1: Find all accounts with active stakes
    console.log(
      `${colors.blue}Step 1: Finding accounts with active stakes...${colors.reset}`,
    );
    const [currentSeason] = await db
      .select()
      .from(seasons)
      .where(eq(seasons.number, airdropNumber - 1));
    if (!currentSeason) {
      console.error(`Season ${airdropNumber - 1} not found`);
      process.exit(1);
    }

    // Actively locked stakes that came from an airdrop are those where
    // blockTimestamp + duration > season start time
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
          // get stakes from claims before the end of the current season
          lte(convictionClaims.blockTimestamp, currentSeason.endDate),
          // and with durations that lasted at least until the end of the current season
          sql`${convictionClaims.blockTimestamp} + (${convictionClaims.duration} * interval '1 second') > ${currentSeason.endDate}`,
        ),
      );

    // Group active stakes by account, to get the sum for each address
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

    console.log(
      `📊 Total active stakes: ${attoValueToStringValue(totalActiveStakes)}\n`,
    );

    // Step 3: Calculate total forfeited amounts
    console.log(
      `${colors.blue}Step 3: Calculating total forfeited amounts...${colors.reset}`,
    );

    // Get all claims, up to the end of the current season, to calculate
    // the total forfeited amount.  We will can use this with the total amount
    // of completed conviction claims to get the current conviction reward pool
    const allClaims = await db
      .select({
        eligibleAmount: convictionClaims.eligibleAmount,
        claimedAmount: convictionClaims.claimedAmount,
        season: convictionClaims.season,
      })
      .from(convictionClaims)
      .where(lte(convictionClaims.blockTimestamp, currentSeason.endDate));

    // Calculate total forfeited (eligibleAmount - claimedAmount for each claim)
    let totalForfeited = 0n;
    // Also collect season information for logging
    const forfeitedBySeason = new Map<number, bigint>();

    for (const claim of allClaims) {
      const forfeited = claim.eligibleAmount - claim.claimedAmount;
      totalForfeited += forfeited;

      const currentSeasonForfeited = forfeitedBySeason.get(claim.season) || 0n;
      forfeitedBySeason.set(claim.season, currentSeasonForfeited + forfeited);
    }

    // Step 4: Calculate claims from seasons after 0, these are the conviction
    //         rewards claims
    console.log(
      `\n${colors.blue}Step 4: Calculating conviction rewards claims...${colors.reset}`,
    );

    // Get all claims from season 1 and forward, so we can subtract that value
    // from the total forfeited amount to get the remaining conviction pool.
    const convictionClaimsBySeason = await db
      .select({
        season: convictionClaims.season,
        totalClaimed: sql<string>`SUM(${convictionClaims.claimedAmount})`.as(
          "totalClaimed",
        ),
      })
      .from(convictionClaims)
      // everything up to the end of this season, exclude season 0
      .where(
        and(
          // season 1 up to the airdrop being calculated
          gte(convictionClaims.season, 1),
          lte(convictionClaims.season, airdropNumber - 1),
        ),
      )
      .groupBy(convictionClaims.season);

    let totalConvictionRewardsClaimed = 0n;
    for (const seasonData of convictionClaimsBySeason) {
      const claimed = BigInt(seasonData.totalClaimed || "0");
      totalConvictionRewardsClaimed += claimed;
    }

    // Step 5: Calculate remaining available conviction rewards pool
    console.log(
      `\n${colors.blue}Step 5: Calculating conviction rewards pool...${colors.reset}`,
    );

    const availableRewards = totalForfeited - totalConvictionRewardsClaimed;
    console.log(
      `🎁 Available rewards: ${attoValueToStringValue(availableRewards)}`,
    );
    console.log(
      `   (${attoValueToStringValue(totalForfeited)} forfeited - ${attoValueToStringValue(totalConvictionRewardsClaimed)} already claimed)\n`,
    );

    // Step 6: Query for all agent boosters during the season.
    const userAgentBoosts = await db
      .select({
        address: boostChanges.wallet,
        boostAmount: sum(boostChanges.deltaAmount),
      })
      .from(agentBoosts)
      .innerJoin(boostChanges, eq(agentBoosts.changeId, boostChanges.id))
      .where(
        and(
          gte(agentBoosts.createdAt, currentSeason.startDate),
          lte(agentBoosts.createdAt, currentSeason.endDate),
        ),
      )
      .groupBy(boostChanges.wallet);

    const userAgentBoostsMap = userAgentBoosts.reduce(
      (acc, boost) =>
        acc.set(
          BlockchainAddressAsU8A.decode(boost.address),
          BigInt(boost.boostAmount || "0"),
        ),
      new Map<string, bigint>(),
    );

    // Step 7: Query for all users that had an agent compete in a competition during the season.
    const userCompetitions = await db
      .select({
        address: users.walletAddress,
        competitionIds: sql<
          string[]
        >`array_agg(DISTINCT ${competitions.id})`.as("competitionIds"),
      })
      .from(users)
      .innerJoin(agents, eq(users.id, agents.ownerId))
      .innerJoin(competitionAgents, eq(agents.id, competitionAgents.agentId))
      .innerJoin(
        competitions,
        eq(competitionAgents.competitionId, competitions.id),
      )
      .where(
        and(
          gte(competitions.startDate, currentSeason.startDate),
          lte(competitions.startDate, currentSeason.endDate),
          eq(competitionAgents.status, "active"),
        ),
      )
      .groupBy(users.walletAddress);

    const userCompetitionsMap = userCompetitions.reduce(
      (acc, userCompetition) =>
        acc.set(userCompetition.address, userCompetition.competitionIds),
      new Map<string, string[]>(),
    );

    // Step 8: Calculate individual rewards
    console.log(
      `${colors.blue}Step 8: Calculating individual rewards...${colors.reset}`,
    );

    const eligibleAccounts: EligibleAccount[] = [];

    if (totalActiveStakes > 0n && availableRewards > 0n) {
      for (const [address, activeStake] of accountStakes.entries()) {
        const isEligible =
          userAgentBoostsMap.has(address) || userCompetitionsMap.has(address);

        if (isEligible) {
          // Calculate proportional reward: (account_stake / total_stakes) * available_rewards
          const reward = (activeStake * availableRewards) / totalActiveStakes;

          eligibleAccounts.push({
            address,
            activeStake,
            reward: reward,
          });
        }
      }
    }

    // Sort by reward amount (descending), then by address (ascending)
    eligibleAccounts.sort((a, b) => {
      if (a.reward > b.reward) return -1;
      if (a.reward < b.reward) return 1;
      if (a.address < b.address) return -1;
      if (a.address > b.address) return 1;
      return 0;
    });

    // Step 9: Generate CSV output
    console.log(
      `${colors.blue}Step 9: Generating CSV output...${colors.reset}`,
    );

    const csvFileName = `airdrop_${airdropNumber}_${currentSeason.endDate.toISOString()}.csv`;
    const csvPath = path.join(process.cwd(), "scripts", "data", csvFileName);

    // Create CSV header
    let csvLines: string[] = [
      "address,amount,season,category,sybilClassification,flaggedAt,flaggingReason,powerUser,recallSnapper,aiBuilder,aiExplorer",
    ];

    // Step 10: Prepend lines from the specified file to the new file if --prepend flag is set
    if (values.prepend) {
      console.log(
        `${colors.blue}Step 10: Prepending from ${values.prepend} to ${csvFileName}...${colors.reset}`,
      );

      const prependSourceCsvPath = path.join(
        process.cwd(),
        "scripts",
        "data",
        values.prepend,
      );

      if (fs.existsSync(prependSourceCsvPath)) {
        const existingData = fs
          .readFileSync(prependSourceCsvPath, "utf-8")
          .trimEnd();
        const existingLines = existingData.split("\n");

        // Skip the header from existing data (existingLines[0]) and prepend only the data rows
        const existingLinesWithoutHeader = existingLines.slice(1);

        csvLines = [csvLines[0]!, ...existingLinesWithoutHeader];

        console.log(
          `✅ Data from ${values.prepend} prepended to new csv lines${colors.reset}`,
        );
        console.log(
          `   Prepended ${existingLinesWithoutHeader.length} entries\n`,
        );
      } else {
        console.error(`❌ File ${values.prepend} does not exist. Exiting.\n`);
        process.exit(1);
      }
    }

    // Add data rows
    for (const entry of eligibleAccounts) {
      // Format: address,amount,season,category,sybilClassification,flaggedAt,flaggingReason,powerUser,recallSnapper,aiBuilder,aiExplorer
      // We're only filling in address, amount, season, and category
      // Other fields are left empty or set to 0 as defaults
      const row = [
        entry.address,
        entry.reward.toString(),
        airdropNumber.toString(),
        "conviction_staking", // category
        "approved", // sybilClassification
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

    // Summary
    console.log(`${colors.magenta}📊 Summary:${colors.reset}`);
    console.log(`   Total eligibility entries: ${eligibleAccounts.length}`);
    console.log(
      `   Total active stakes: ${attoValueToStringValue(totalActiveStakes)}`,
    );
    console.log(
      `   Total available rewards: ${attoValueToStringValue(availableRewards)}`,
    );
    console.log(
      `✅ Calculated rewards for ${eligibleAccounts.length} accounts\n`,
    );
    console.log(
      `💰 Total forfeited across all seasons: ${attoValueToStringValue(totalForfeited)}`,
    );

    // Show breakdown by season
    for (const [season, amount] of forfeitedBySeason.entries()) {
      console.log(`   Season ${season}: ${attoValueToStringValue(amount)}`);
    }

    // Calculate and display reward statistics for eligible entries
    if (eligibleAccounts.length > 0) {
      const eligibleRewards = eligibleAccounts.map((e) => e.reward);
      const totalEligible = eligibleRewards.reduce((sum, r) => sum + r, 0n);
      const meanEligible = totalEligible / BigInt(eligibleRewards.length);
      const maxEligible = eligibleRewards.reduce(
        (max, r) => (r > max ? r : max),
        0n,
      );
      const minEligible = eligibleRewards.reduce(
        (min, r) => (r < min ? r : min),
        eligibleRewards[0] || 0n,
      );

      const medianEligible = calculateMedian(eligibleRewards);

      console.log(
        `\n${colors.cyan}📊 Eligible Reward Statistics:${colors.reset}`,
      );
      console.log(`   Total rewards: ${attoValueToStringValue(totalEligible)}`);
      console.log(`   Mean reward: ${attoValueToStringValue(meanEligible)}`);
      console.log(
        `   Median reward: ${attoValueToStringValue(medianEligible)}`,
      );
      console.log(`   Max reward: ${attoValueToStringValue(maxEligible)}`);
      console.log(`   Min reward: ${attoValueToStringValue(minEligible)}`);
    }

    console.log("");

    if (eligibleAccounts.length > 0) {
      console.log(`\n${colors.cyan}Top 5 recipients:${colors.reset}`);
      for (let i = 0; i < Math.min(5, eligibleAccounts.length); i++) {
        const account = eligibleAccounts[i];
        console.log(
          `   ${i + 1}. ${account?.address}: ${attoValueToStringValue(account?.reward || 0n)}`,
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
