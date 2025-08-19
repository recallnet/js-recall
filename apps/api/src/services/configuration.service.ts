import { config, features } from "@/config/index.js";
import { findActive } from "@/database/repositories/competition-repository.js";
import { SelectCompetitionConfiguration } from "@/database/schema/trading/types.js";
import { serviceLogger } from "@/lib/logger.js";
import { CompetitionConfigurationService } from "@/services/competition-configuration.service.js";
import { CrossChainTradingType } from "@/types/index.js";

/**
 * Configuration Service
 * Manages dynamic configuration settings loaded from the database
 */
export class ConfigurationService {
  private competitionConfigurationService: CompetitionConfigurationService;

  // Cache for competition configurations
  private competitionConfigCache = new Map<
    string,
    SelectCompetitionConfiguration
  >();
  private activeCompetitionId: string | null = null;

  constructor(
    competitionConfigurationService: CompetitionConfigurationService,
  ) {
    this.competitionConfigurationService = competitionConfigurationService;
  }

  /**
   * Load competition-specific settings and update global configuration
   * This method updates the global features object with settings from the active competition
   */
  async loadCompetitionSettings(): Promise<void> {
    try {
      // Get the active competition from the database
      const activeCompetition = await findActive();

      if (activeCompetition) {
        this.activeCompetitionId = activeCompetition.id;

        // Load competition-specific configuration from database
        const config =
          await this.competitionConfigurationService.getConfiguration(
            activeCompetition.id,
          );

        if (config) {
          this.competitionConfigCache.set(activeCompetition.id, config);
          serviceLogger.debug(
            `[ConfigurationService] Loaded stateless configuration for competition ${activeCompetition.id}`,
          );
        }

        // Override the environment-based settings with competition-specific settings
        features.CROSS_CHAIN_TRADING_TYPE =
          activeCompetition.crossChainTradingType as CrossChainTradingType;
        features.SANDBOX_MODE = activeCompetition.sandboxMode;

        serviceLogger.debug(
          `[ConfigurationService] Updated competition settings from competition ${activeCompetition.id}:`,
          {
            crossChainTradingType: features.CROSS_CHAIN_TRADING_TYPE,
            sandboxMode: features.SANDBOX_MODE,
          },
        );
      } else {
        this.activeCompetitionId = null;
        // No active competition, keep the environment variable settings
        features.SANDBOX_MODE = false; // Default to false when no active competition
        serviceLogger.debug(
          `[ConfigurationService] No active competition, using environment settings:`,
          {
            crossChainTradingType: features.CROSS_CHAIN_TRADING_TYPE,
            sandboxMode: features.SANDBOX_MODE,
          },
        );
      }
    } catch (error) {
      serviceLogger.error(
        "[ConfigurationService] Error loading competition settings:",
        error,
      );
    }
  }

  /**
   * Get portfolio price freshness with competition-aware fallback
   */
  async getPortfolioPriceFreshnessMs(competitionId?: string): Promise<number> {
    const targetCompetitionId = competitionId || this.activeCompetitionId;

    if (targetCompetitionId) {
      const config = await this.getCompetitionConfig(targetCompetitionId);
      if (config?.portfolioPriceFreshnessMs !== undefined) {
        return config.portfolioPriceFreshnessMs;
      }
    }

    // Fall back to environment configuration
    return config.portfolio.priceFreshnessMs;
  }

  /**
   * Get max trade percentage with competition-aware fallback
   */
  async getMaxTradePercentage(competitionId?: string): Promise<number> {
    const targetCompetitionId = competitionId || this.activeCompetitionId;

    if (targetCompetitionId) {
      const config = await this.getCompetitionConfig(targetCompetitionId);
      if (config?.maxTradePercentage !== undefined) {
        return config.maxTradePercentage;
      }
    }

    // Fall back to environment configuration
    return config.maxTradePercentage;
  }

  /**
   * Get portfolio snapshot cron expression
   */
  async getPortfolioSnapshotCron(competitionId?: string): Promise<string> {
    const targetCompetitionId = competitionId || this.activeCompetitionId;

    if (targetCompetitionId) {
      const config = await this.getCompetitionConfig(targetCompetitionId);
      if (config?.portfolioSnapshotCron) {
        return config.portfolioSnapshotCron;
      }
    }

    // Fall back to default cron expression
    return "*/5 * * * *"; // Default: every 5 minutes
  }

  /**
   * Get competition configuration with caching
   */
  private async getCompetitionConfig(
    competitionId: string,
  ): Promise<SelectCompetitionConfiguration | null> {
    // Check cache first
    if (this.competitionConfigCache.has(competitionId)) {
      return this.competitionConfigCache.get(competitionId)!;
    }

    // Load from database
    const config =
      await this.competitionConfigurationService.getConfiguration(
        competitionId,
      );

    if (config) {
      this.competitionConfigCache.set(competitionId, config);
      return config;
    }

    return null;
  }

  /**
   * Clear configuration cache (e.g., when competition updated)
   */
  clearConfigCache(competitionId?: string): void {
    if (competitionId) {
      this.competitionConfigCache.delete(competitionId);
    } else {
      this.competitionConfigCache.clear();
    }
  }
}
