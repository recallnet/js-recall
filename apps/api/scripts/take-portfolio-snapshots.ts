import * as dotenv from "dotenv";
import * as path from "path";

import { createLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const services = new ServiceRegistry();
const logger = createLogger("PortfolioSnapshots");

/**
 * Take portfolio snapshots for the active competition
 */
async function takePortfolioSnapshots() {
  try {
    // Check if a competition is active
    const activeCompetition =
      await services.competitionManager.getActiveCompetition();

    if (!activeCompetition) {
      logger.info(
        "There is no active competition. No snapshots will be taken.",
      );
      return;
    }

    // Display competition details
    logger.info("Active Competition Details");
    logger.info(
      {
        id: activeCompetition.id,
        name: activeCompetition.name,
        status: activeCompetition.status,
      },
      "Active Competition Details",
    );

    // Take portfolio snapshots
    logger.info("Taking portfolio snapshots...");
    await services.portfolioSnapshotter.takePortfolioSnapshots(
      activeCompetition.id,
    );

    logger.info("Portfolio snapshots completed successfully!");
  } catch (error) {
    logger.error(
      "Error taking portfolio snapshots:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  } finally {
    // Exit the process
    process.exit(0);
  }
}

// Run the function
takePortfolioSnapshots();
