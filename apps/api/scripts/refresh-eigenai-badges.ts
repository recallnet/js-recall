import * as dotenv from "dotenv";
import cron from "node-cron";
import * as path from "path";

import { createLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const services = new ServiceRegistry();
const logger = createLogger("EigenAiBadgeProcessor");

/**
 * Refresh EigenAI badge statuses for all active competitions
 */
async function refreshEigenAiBadges() {
  const startTime = Date.now();
  logger.info("Starting EigenAI badge refresh...");

  try {
    // Get all active competitions
    const allCompetitions = await services.competitionRepository.findAll();
    const activeCompetitions = allCompetitions.filter(
      (c) => c.status === "active",
    );

    if (activeCompetitions.length === 0) {
      const duration = Date.now() - startTime;
      logger.info(
        `No active competitions. Nothing to process. (took ${duration}ms)`,
      );
      return;
    }

    let totalAgentsUpdated = 0;

    // Process each active competition
    for (const activeCompetition of activeCompetitions) {
      // Display competition details
      logger.info(
        {
          id: activeCompetition.id,
          name: activeCompetition.name,
          status: activeCompetition.status,
          type: activeCompetition.type,
        },
        "Refreshing EigenAI badges for competition",
      );

      try {
        const agentsUpdated =
          await services.eigenaiService.refreshBadgeStatuses(
            activeCompetition.id,
          );

        totalAgentsUpdated += agentsUpdated;

        logger.info(
          `EigenAI badge refresh complete: ${agentsUpdated} agents updated`,
        );
      } catch (eigenaiError) {
        logger.error(
          { error: eigenaiError },
          `Error refreshing badges for competition ${activeCompetition.id}:`,
        );
        // Continue processing other competitions even if one fails
      }
    }

    const duration = Date.now() - startTime;
    logger.info(
      `EigenAI badge refresh completed for ${activeCompetitions.length} competition(s), ${totalAgentsUpdated} agents updated in ${duration}ms!`,
    );
  } catch (error) {
    logger.error({ error }, "Error in EigenAI badge refresh task:");

    throw error;
  }
}

// Schedule the task to run every 15 minutes
cron.schedule("*/15 * * * *", async () => {
  logger.info("Running scheduled EigenAI badge refresh task");
  await refreshEigenAiBadges();
});

// Also run immediately if called directly
if (process.argv.includes("--run-once")) {
  logger.info("Running EigenAI badge refresh task once");
  try {
    await refreshEigenAiBadges();
  } catch {
    process.exit(1);
  }
}

// Keep the process alive for cron
logger.info(
  "EigenAI badge refresh processor started - running every 15 minutes",
);
