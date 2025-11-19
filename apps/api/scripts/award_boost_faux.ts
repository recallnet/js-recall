import * as dotenv from "dotenv";
import * as path from "path";
import { parse } from "ts-command-line-args";

import { createLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const services = new ServiceRegistry();
const logger = createLogger("AwardBoost");

type Args = {
  competitionId: string;
  boostAmount: number;
  reason?: string;
};

/**
 * Assign boost to users for upcoming competitions
 */
async function awardBoostFaux(args: Args) {
  const startTime = Date.now();
  const competitionManager = services.competitionService;
  const userManager = services.userService;
  const boostAwardService = services.boostAwardService;
  logger.info("Starting award Boost task...");
  const competitionId = args.competitionId;
  const boostAmount = BigInt(args.boostAmount); // Beware! No decimals.
  const idemReason = args.reason ?? "script";

  try {
    const competition = await competitionManager.getCompetition(competitionId);
    if (!competition) {
      throw new Error(`Competition not found: ${args.competitionId}`);
    }

    const users = await userManager.getAllUsers();
    for (const user of users) {
      // Now is the time to award boost
      const diffResult = await boostAwardService.awardNoStake(
        competitionId,
        user.id,
        user.walletAddress,
        boostAmount,
        idemReason,
      );
      if (diffResult.type === "applied") {
        logger.info(
          `Awarded ${boostAmount} Boost to user ${user.id} for competition ${competitionId}, balance is ${diffResult.balanceAfter}`,
        );
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`Awarding Boost completed successfully in ${duration}ms!`);
  } catch (error) {
    logger.error({ error }, "Error awarding Boost:");

    throw error;
  }
}

const args = parse<Args>({
  competitionId: {
    type: String,
    description: "Execute the migration (default is dry-run)",
  },
  boostAmount: {
    type: Number,
    description: "Amount of boost to award",
  },
  reason: {
    type: String,
    optional: true,
    description: "Reason for the boost (for idempotency) - default is 'script'",
  },
});

awardBoostFaux(args)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
