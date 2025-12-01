import * as dotenv from "dotenv";
import cron from "node-cron";
import * as path from "path";

import { BlockchainAddressAsU8A } from "@recallnet/db/coders";

import { createLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const services = new ServiceRegistry();
const logger = createLogger("AwardBoost");

/**
 * Assign boost to users for upcoming competitions
 */
async function awardAllBoost() {
  const startTime = Date.now();
  logger.info("Starting award Boost task...");

  const competitionRepository = services.competitionRepository;
  const stakesRepository = services.stakesRepository;
  const userManager = services.userService;
  const boostAwardService = services.boostAwardService;
  const boostBonusService = services.boostBonusService;

  try {
    // Step 1: Award stake-based boosts to pending competitions
    const upcomingCompetitionsRes = await competitionRepository.findByStatus({
      status: "pending",
      params: { limit: 100, offset: 0, sort: "" },
    });
    const upcomingCompetitions = upcomingCompetitionsRes.competitions;
    logger.info(
      `${upcomingCompetitions.length} competitions need Boost awarded to the users`,
    );
    // Iterate over competitions
    for (const competition of upcomingCompetitions) {
      const boostEndDate = competition.boostEndDate;
      if (!boostEndDate) {
        logger.warn(`No boost end date for competition: ${competition.id}`);
        continue;
      }
      const boostStartDate = competition.boostStartDate;
      if (!boostStartDate) {
        logger.warn(`No boost start date for competition: ${competition.id}`);
        continue;
      }
      // Iterate over Stakes pages
      let stakes = await stakesRepository.allStaked();
      while (stakes.length > 0) {
        // Iterate over Stakes
        for (const stake of stakes) {
          const walletString = BlockchainAddressAsU8A.decode(stake.wallet);
          const user = await userManager.getUserByWalletAddress(walletString);
          if (!user) {
            logger.warn(`User not found for wallet: ${stake.wallet}`);
            continue; // For some reason no user found for this wallet
          }
          // Now is the time to award boost
          const diffResult = await boostAwardService.awardForStake(
            {
              id: stake.id,
              wallet: BlockchainAddressAsU8A.decode(stake.wallet),
              amount: stake.amount,
              stakedAt: stake.stakedAt,
              canUnstakeAfter: stake.canUnstakeAfter,
            },
            {
              id: competition.id,
              boostEndDate: boostEndDate,
              boostStartDate: boostStartDate,
            },
          );
          if (diffResult.type === "applied") {
            logger.info(
              `Awarded Boost to user ${user.id} for stake ${stake.id}, balance is ${diffResult.balanceAfter}`,
            );
          }
        }

        // Fetch the next page of Stakes
        const lastStakeId = stakes[-1]?.id;
        if (lastStakeId) {
          stakes = await services.stakesRepository.allStaked(lastStakeId);
        } else {
          stakes = [];
        }
      }
    }

    // Step 2: Apply bonus boosts to eligible competitions (both pending AND active)
    logger.info("Starting to apply bonus boosts to eligible competitions...");
    const bonusBoostResult =
      await boostBonusService.applyBonusBoostsToEligibleCompetitions();
    logger.info(
      {
        totalBoostsApplied: bonusBoostResult.totalBoostsApplied,
        competitionsProcessed: bonusBoostResult.competitionsProcessed,
        competitionsSkipped: bonusBoostResult.competitionsSkipped,
        errorCount: bonusBoostResult.errors.length,
      },
      "Completed applying bonus boosts to eligible competitions",
    );

    if (bonusBoostResult.errors.length > 0) {
      logger.warn(
        { errors: bonusBoostResult.errors },
        "Some competitions failed during bonus boost application",
      );
    }

    const duration = Date.now() - startTime;
    logger.info(`Awarding Boost completed successfully in ${duration}ms!`);
  } catch (error) {
    logger.error({ error }, "Error awarding Boost:");

    throw error;
  }
}

const isRunOnce = process.argv.includes("--run-once");
if (isRunOnce) {
  logger.info("Running award Boost task once");
  try {
    await awardAllBoost();
  } catch {
    process.exit(1);
  } finally {
    process.exit(0);
  }
} else {
  // Schedule the task to run every 3 hours
  cron.schedule("0 */3 * * *", async () => {
    logger.info("Running award Boost task");
    await awardAllBoost();
  });
}
