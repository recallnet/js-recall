import { features } from "../config";
import { repositories } from "../database";

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
      const activeCompetition =
        await repositories.competitionRepository.findActive();

      if (activeCompetition) {
        // Override the environment-based setting with competition-specific settings
        features.ALLOW_CROSS_CHAIN_TRADING =
          activeCompetition.allowCrossChainTrading;

        console.log(
          `[ConfigurationService] Updated cross-chain trading setting from competition ${activeCompetition.id}: ${features.ALLOW_CROSS_CHAIN_TRADING}`,
        );
      } else {
        // No active competition, keep the environment variable setting
        console.log(
          `[ConfigurationService] No active competition, using environment setting for cross-chain trading: ${features.ALLOW_CROSS_CHAIN_TRADING}`,
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
