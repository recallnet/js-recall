import * as dotenv from "dotenv";
import cron from "node-cron";
import * as path from "path";

import { BlockchainAddressAsU8A } from "@/lib/coders.js";
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

  const competitionManager = services.competitionManager;
  const stakesRepository = services.stakesRepository;
  const userManager = services.userManager;
  const boostAwardService = services.boostAwardService;

  try {
    const upcomingCompetitionsRes =
      await competitionManager.getUpcomingCompetitions();
    const upcomingCompetitions = upcomingCompetitionsRes.competitions;
    logger.info(
      `${upcomingCompetitions.length} competitions need Boost awarded to the users`,
    );
    // Iterate over competitions
    for (const competition of upcomingCompetitions) {
      const votingEndDate = competition.votingEndDate;
      if (!votingEndDate) {
        logger.warn(`No voting end date for competition: ${competition.id}`);
        continue;
      }
      const votingStartDate = competition.votingStartDate;
      if (!votingStartDate) {
        logger.warn(`No voting start date for competition: ${competition.id}`);
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
          const diffResult = await boostAwardService.awardForStake(stake, {
            id: competition.id,
            votingEndDate: votingEndDate,
            votingStartDate: votingStartDate,
          });
          if (diffResult.isChange) {
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

    const duration = Date.now() - startTime;
    logger.info(`Awarding Boost completed successfully in ${duration}ms!`);
  } catch (error) {
    logger.error(
      "Error awarding Boost:",
      error instanceof Error ? error.message : String(error),
    );

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
