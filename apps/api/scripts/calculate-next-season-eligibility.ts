#!/usr/bin/env tsx
import * as fs from "fs";
import * as path from "path";
import { parseArgs } from "util";

import { attoValueToStringValue } from "@recallnet/conversions/atto-conversions";
import { AirdropRepository } from "@recallnet/db/repositories/airdrop";
import { BoostRepository } from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { ConvictionClaimsRepository } from "@recallnet/db/repositories/conviction-claims";
import { DEFAULT_MIN_COMPETITIONS_FOR_ELIGIBILITY } from "@recallnet/services";

import { db, dbRead } from "@/database/db.js";
import { createLogger } from "@/lib/logger.js";

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

const logger = createLogger("CalculateNextSeasonEligibility");
const airdropRepository = new AirdropRepository(db, logger);
const convictionClaimsRepository = new ConvictionClaimsRepository(db, logger);
const boostRepository = new BoostRepository(db);
const competitionRepository = new CompetitionRepository(db, dbRead, logger);

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
      "min-competitions": {
        type: "string",
        short: "m",
        description:
          "Minimum number of competitions for eligibility (default: 3, or MIN_COMPETITIONS_FOR_ELIGIBILITY env var)",
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

Usage: pnpm tsx calculate-next-season-eligibility.ts --airdrop <number> [--prepend <file>] [--min-competitions <number>]

Options:
  -a, --airdrop          Airdrop number for the output (required)
  -p, --prepend          Prepend existing data from the specified file to the new csv file
  -m, --min-competitions Minimum competitions for eligibility (default: ${DEFAULT_MIN_COMPETITIONS_FOR_ELIGIBILITY}, or MIN_COMPETITIONS_FOR_ELIGIBILITY env var)
  -h, --help             Show this help message

Examples:
  pnpm tsx calculate-next-season-eligibility.ts --airdrop 2
  pnpm tsx calculate-next-season-eligibility.ts --airdrop 2 --prepend airdrop_1_2024-11-29T00:00:00.000Z.csv
  pnpm tsx calculate-next-season-eligibility.ts --airdrop 2 --min-competitions 5
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

  // Determine minimum competitions for eligibility: flag > env var > default
  const minCompetitionsRaw =
    values["min-competitions"] ??
    process.env.MIN_COMPETITIONS_FOR_ELIGIBILITY ??
    String(DEFAULT_MIN_COMPETITIONS_FOR_ELIGIBILITY);
  const minCompetitionsForEligibility = parseInt(minCompetitionsRaw, 10);
  if (
    isNaN(minCompetitionsForEligibility) ||
    minCompetitionsForEligibility < 0
  ) {
    console.error(
      `${colors.red}Error: Invalid min-competitions value${colors.reset}`,
    );
    process.exit(1);
  }

  console.log(
    `${colors.cyan}🔍 Calculating eligibility for airdrop ${airdropNumber}${colors.reset}`,
  );
  console.log(
    `${colors.cyan}   Minimum competitions for eligibility: ${minCompetitionsForEligibility}${colors.reset}`,
  );

  try {
    // Step 1: Find the activity season (the season before the target airdrop)
    console.log(
      `${colors.blue}Step 1: Finding activity season...${colors.reset}`,
    );
    const currentSeason = await airdropRepository.getSeasonStartingWithAirdrop(
      airdropNumber - 1,
    );
    if (!currentSeason) {
      console.error(`Season for airdrop ${airdropNumber - 1} not found`);
      process.exit(1);
    }
    console.log(
      `✅ Found season ${currentSeason.number} (${currentSeason.name})\n`,
    );

    // Step 2: Find all accounts with active stakes using repository
    console.log(
      `${colors.blue}Step 2: Finding accounts with active stakes...${colors.reset}`,
    );
    const accountStakes =
      await convictionClaimsRepository.getActiveStakesForSeason(
        currentSeason.endDate,
      );
    console.log(`✅ Found ${accountStakes.size} accounts with active stakes\n`);

    // Step 3: Calculate total active stakes
    console.log(
      `${colors.blue}Step 3: Calculating total active stakes...${colors.reset}`,
    );
    const totalActiveStakes =
      await convictionClaimsRepository.getTotalActiveStakesForSeason(
        currentSeason.endDate,
      );
    console.log(
      `📊 Total active stakes: ${attoValueToStringValue(totalActiveStakes)}\n`,
    );

    // Step 4: Calculate total forfeited amounts
    console.log(
      `${colors.blue}Step 4: Calculating total forfeited amounts...${colors.reset}`,
    );
    const totalForfeited =
      await convictionClaimsRepository.getTotalForfeitedUpToDate(
        currentSeason.endDate,
      );
    console.log(
      `💰 Total forfeited: ${attoValueToStringValue(totalForfeited)}\n`,
    );

    // Step 5: Calculate conviction rewards already claimed
    console.log(
      `${colors.blue}Step 5: Calculating conviction rewards already claimed...${colors.reset}`,
    );
    const totalConvictionRewardsClaimed =
      await convictionClaimsRepository.getTotalConvictionRewardsClaimedBySeason(
        1,
        airdropNumber - 1,
      );
    console.log(
      `📤 Total conviction rewards already claimed: ${attoValueToStringValue(totalConvictionRewardsClaimed)}\n`,
    );

    // Step 6: Calculate remaining available conviction rewards pool
    console.log(
      `${colors.blue}Step 6: Calculating conviction rewards pool...${colors.reset}`,
    );
    const availableRewards = totalForfeited - totalConvictionRewardsClaimed;
    console.log(
      `🎁 Available rewards: ${attoValueToStringValue(availableRewards)}`,
    );
    console.log(
      `   (${attoValueToStringValue(totalForfeited)} forfeited - ${attoValueToStringValue(totalConvictionRewardsClaimed)} already claimed)\n`,
    );

    // Step 7: Query for all agent boosters during the season using repository
    console.log(
      `${colors.blue}Step 7: Finding users who boosted agents...${colors.reset}`,
    );
    const userBoostedCompsMap =
      await boostRepository.getAllCompetitionIdsBoostedDuringSeason(
        currentSeason.startDate,
        currentSeason.endDate,
      );
    console.log(`✅ Found ${userBoostedCompsMap.size} users who boosted\n`);

    // Step 8: Query for all users that had an agent compete during the season using repository
    console.log(
      `${colors.blue}Step 8: Finding users who competed...${colors.reset}`,
    );
    const userCompetedCompsMap =
      await competitionRepository.getAllCompetitionIdsCompetedDuringSeason(
        currentSeason.startDate,
        currentSeason.endDate,
      );
    console.log(`✅ Found ${userCompetedCompsMap.size} users who competed\n`);

    // Step 9: Calculate individual rewards
    console.log(
      `${colors.blue}Step 9: Calculating individual rewards...${colors.reset}`,
    );

    // Merge boosted and competed competitions per user
    const allUserCompsMap = new Map<string, Set<string>>();

    // Add boosted competitions
    for (const [address, compIds] of userBoostedCompsMap) {
      const set = allUserCompsMap.get(address) || new Set<string>();
      for (const id of compIds) {
        set.add(id);
      }
      allUserCompsMap.set(address, set);
    }

    // Add competed competitions
    for (const [address, compIds] of userCompetedCompsMap) {
      const set = allUserCompsMap.get(address) || new Set<string>();
      for (const id of compIds) {
        set.add(id);
      }
      allUserCompsMap.set(address, set);
    }

    const eligibleAccounts: EligibleAccount[] = [];

    if (totalActiveStakes > 0n && availableRewards > 0n) {
      for (const [address, activeStake] of accountStakes.entries()) {
        const numEligibilityComps = allUserCompsMap.get(address)?.size || 0;
        const isEligible = numEligibilityComps >= minCompetitionsForEligibility;

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

    // Step 10: Generate CSV output
    console.log(
      `${colors.blue}Step 10: Generating CSV output...${colors.reset}`,
    );

    const csvFileName = `airdrop_${airdropNumber}_${currentSeason.endDate.toISOString()}.csv`;
    const csvPath = path.join(process.cwd(), "scripts", "data", csvFileName);

    // Create CSV header
    let csvLines: string[] = [
      "address,amount,season,category,sybilClassification,flaggedAt,flaggingReason,powerUser,recallSnapper,aiBuilder,aiExplorer",
    ];

    // Step 11: Prepend lines from the specified file to the new file if --prepend flag is set
    if (values.prepend) {
      console.log(
        `${colors.blue}Step 11: Prepending from ${values.prepend} to ${csvFileName}...${colors.reset}`,
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
      `💰 Total forfeited: ${attoValueToStringValue(totalForfeited)}`,
    );

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
