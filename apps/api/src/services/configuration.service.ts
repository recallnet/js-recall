import { features } from "@/config/index.js";
import { findActive } from "@/database/repositories/competition-repository.js";

/**
 * Configuration Service
 * Manages dynamic configuration settings loaded from the database
 */
export class ConfigurationService {
  /**
   * Load competition-specific settings and update global configuration
   * This method updates the global features object with settings from the active competition
   */
  async loadCompetitionSettings(): Promise<void> {
    try {
      // Get the active competition from the database
      const activeCompetition = await findActive();

      if (activeCompetition) {
        // Override the environment-based setting with competition-specific settings
        features.CROSS_CHAIN_TRADING_TYPE =
          activeCompetition.crossChainTradingType;

        console.log(
          `[ConfigurationService] Updated cross-chain trading setting from competition ${activeCompetition.id}: ${features.CROSS_CHAIN_TRADING_TYPE}`,
        );
      } else {
        // No active competition, keep the environment variable setting
        console.log(
          `[ConfigurationService] No active competition, using environment setting for cross-chain trading: ${features.CROSS_CHAIN_TRADING_TYPE}`,
        );
      }
    } catch (error) {
      console.error(
        "[ConfigurationService] Error loading competition settings:",
        error,
      );
    }
  }
}
