import { Logger } from "pino";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";

import { features } from "@/config/index.js";

import { CrossChainTradingType } from "./types/index.js";

/**
 * Configuration Service
 * Manages dynamic configuration settings loaded from the database
 */
export class ConfigurationService {
  private competitionRepo: CompetitionRepository;
  private logger: Logger;

  constructor(competitionRepo: CompetitionRepository, logger: Logger) {
    this.competitionRepo = competitionRepo;
    this.logger = logger;
  }
  /**
   * Load competition-specific settings and update global configuration
   * This method updates the global features object with settings from the active competition
   */
  async loadCompetitionSettings(): Promise<void> {
    try {
      // Get the active competition from the database
      const activeCompetition = await this.competitionRepo.findActive();

      if (activeCompetition) {
        // Override the environment-based settings with competition-specific settings
        features.CROSS_CHAIN_TRADING_TYPE =
          activeCompetition.crossChainTradingType as CrossChainTradingType;
        features.SANDBOX_MODE = activeCompetition.sandboxMode;

        this.logger.debug(
          `[ConfigurationService] Updated competition settings from competition ${activeCompetition.id}:`,
          {
            crossChainTradingType: features.CROSS_CHAIN_TRADING_TYPE,
            sandboxMode: features.SANDBOX_MODE,
          },
        );
      } else {
        // No active competition, keep the environment variable settings
        features.SANDBOX_MODE = false; // Default to false when no active competition
        this.logger.debug(
          `[ConfigurationService] No active competition, using environment settings:`,
          {
            crossChainTradingType: features.CROSS_CHAIN_TRADING_TYPE,
            sandboxMode: features.SANDBOX_MODE,
          },
        );
      }
    } catch (error) {
      this.logger.error(
        "[ConfigurationService] Error loading competition settings:",
        error,
      );
    }
  }
}
