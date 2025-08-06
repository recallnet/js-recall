import chalk from "chalk";
import * as readline from "readline";

import { db } from "@/database/db.js";
import { competitions } from "@/database/schema/core/defs.js";
import { tradingConstraints } from "@/database/schema/trading/defs.js";

const JULY_23_COMP = "99a8f533-b745-48c6-afb3-252a0c02e25b";

/**
 * Prompt user for confirmation
 */
async function promptConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes" || answer.toLowerCase() === "y");
    });
  });
}

/**
 * Find competitions that don't have trading constraints
 */
async function findCompetitionsWithoutConstraints() {
  console.log(
    chalk.blue("Checking for competitions without trading constraints..."),
  );

  // Get all competitions
  const allCompetitions = await db
    .select({
      id: competitions.id,
      name: competitions.name,
      type: competitions.type,
      status: competitions.status,
    })
    .from(competitions);

  console.log(chalk.gray(`Found ${allCompetitions.length} total competitions`));

  // Get all competitions that already have trading constraints
  const competitionsWithConstraints = await db
    .select({
      competitionId: tradingConstraints.competitionId,
    })
    .from(tradingConstraints);

  const constraintCompetitionIds = new Set(
    competitionsWithConstraints.map((c) => c.competitionId),
  );

  // Find competitions without constraints
  const competitionsWithoutConstraints = allCompetitions.filter(
    (comp) => !constraintCompetitionIds.has(comp.id),
  );

  return {
    total: allCompetitions.length,
    withConstraints: constraintCompetitionIds.size,
    withoutConstraints: competitionsWithoutConstraints,
  };
}

/**
 * Create default trading constraints for competitions that don't have them
 */
async function backfillTradingConstraints(execute: boolean = false) {
  console.log(
    chalk.bold("\n🔧  Competition Trading Constraints Backfill Script"),
  );
  console.log(
    chalk.gray("========================================================\n"),
  );

  if (!execute) {
    console.log(
      chalk.yellow("⚠️  Running in DRY RUN mode - no changes will be made"),
    );
    console.log(
      chalk.yellow("   Add --execute as argument to perform actual backfill\n"),
    );
  } else {
    console.log(
      chalk.red("⚠️  Running in EXECUTE mode - constraints WILL be created!\n"),
    );
  }

  const analysis = await findCompetitionsWithoutConstraints();

  console.log(chalk.blue("Analysis Results:"));
  console.log(chalk.gray(`  Total competitions: ${analysis.total}`));
  console.log(chalk.gray(`  With constraints: ${analysis.withConstraints}`));
  console.log(
    chalk.gray(`  Without constraints: ${analysis.withoutConstraints.length}`),
  );

  if (analysis.withoutConstraints.length === 0) {
    console.log(
      chalk.green("\n✅ All competitions already have trading constraints!"),
    );
    return;
  }

  console.log(chalk.yellow("\nCompetitions without trading constraints:"));
  for (const comp of analysis.withoutConstraints) {
    console.log(
      chalk.gray(
        `  • ${comp.id} - ${comp.name} (${comp.type}, ${comp.status})`,
      ),
    );
  }

  if (execute) {
    const confirmed = await promptConfirmation(
      `\nAre you sure you want to create trading constraints for ${analysis.withoutConstraints.length} competition(s)?`,
    );

    if (!confirmed) {
      console.log(chalk.red("\n❌ Backfill cancelled"));
      return;
    }

    console.log(chalk.blue("\nCreating trading constraints..."));

    // Create constraints with all values set to 0
    const constraintsToInsert = analysis.withoutConstraints.map((comp) => {
      const constraints =
        comp.id === JULY_23_COMP
          ? {
              minimumPairAgeHours: 168,
              minimum24hVolumeUsd: 100000,
              minimumLiquidityUsd: 100000,
              minimumFdvUsd: 1000000,
            }
          : {
              minimumPairAgeHours: 0,
              minimum24hVolumeUsd: 0,
              minimumLiquidityUsd: 0,
              minimumFdvUsd: 0,
            };
      return {
        competitionId: comp.id,
        ...constraints,
      };
    });

    await db.transaction(async (tx) => {
      for (const constraint of constraintsToInsert) {
        await tx.insert(tradingConstraints).values(constraint);
        console.log(
          chalk.gray(`  ✓ Created constraints for ${constraint.competitionId}`),
        );
      }
    });

    console.log(
      chalk.green(
        `\n✅ Successfully created trading constraints for ${analysis.withoutConstraints.length} competitions!`,
      ),
    );
  } else {
    console.log(
      chalk.yellow(
        `\nTo execute the backfill, run: pnpm --filter api tsx scripts/backfill-comp-constraints.ts --execute`,
      ),
    );
  }
}

/**
 * Main script execution
 */
async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes("--execute");

  try {
    await backfillTradingConstraints(execute);
  } catch (error) {
    console.error(chalk.red("\n❌ Script failed:"), error);
    process.exit(1);
  }

  // Clean exit
  process.exit(0);
}

// Execute the script
main().catch((error) => {
  console.error(chalk.red("\n❌ Script failed:"), error);
  process.exit(1);
});
