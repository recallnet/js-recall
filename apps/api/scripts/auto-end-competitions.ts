import * as dotenv from "dotenv";
import * as path from "path";

import { createLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

const services = new ServiceRegistry();
const logger = createLogger("AutoEndCompetitions");

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

/**
 * Auto end competitions that have reached their end date
 */
async function autoEndCompetitions() {
  try {
    // Process competition end date checks
    logger.info("Checking competition end dates...");
    await services.competitionManager.processCompetitionEndDateChecks();

    logger.info("Auto end competitions completed successfully!");
  } catch (error) {
    logger.error(
      "Error checking competition end dates:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  } finally {
    // Exit the process
    process.exit(0);
  }
}

// Run the function
autoEndCompetitions();
