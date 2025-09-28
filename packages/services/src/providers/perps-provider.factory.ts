import { Logger } from "pino";

import { IPerpsDataProvider, PerpsProviderConfig } from "../types/perps.js";
import { SymphonyPerpsProvider } from "./perps/symphony-perps.provider.js";

/**
 * Factory for creating perps data providers based on configuration
 */
export class PerpsProviderFactory {
  static logger: Logger;
  /**
   * Create a perps data provider based on the configuration
   */
  static createProvider(config: PerpsProviderConfig): IPerpsDataProvider {
    PerpsProviderFactory.logger.info(
      `[PerpsProviderFactory] Creating provider of type: ${config.type}, provider: ${config.provider}`,
    );

    switch (config.type) {
      case "external_api":
        return this.createExternalApiProvider(config);

      case "onchain_indexing":
        // Placeholder for future implementation
        throw new Error("On-chain indexing providers not yet implemented");

      case "hybrid":
        // Placeholder for future implementation
        throw new Error("Hybrid providers not yet implemented");

      default:
        throw new Error(`Unsupported perps data source type: ${config.type}`);
    }
  }

  /**
   * Create external API provider based on provider name
   */
  private static createExternalApiProvider(
    config: PerpsProviderConfig,
  ): IPerpsDataProvider {
    switch (config.provider) {
      case "symphony":
        return this.createSymphonyProvider(config.apiUrl);

      case "hyperliquid":
        // Placeholder for future implementation
        throw new Error("Hyperliquid provider not yet implemented");

      default:
        throw new Error(`Unknown external API provider: ${config.provider}`);
    }
  }

  /**
   * Create Symphony provider instance
   */
  private static createSymphonyProvider(apiUrl?: string): IPerpsDataProvider {
    return new SymphonyPerpsProvider(PerpsProviderFactory.logger, apiUrl);
  }

  /**
   * Validate that a provider is working
   */
  static async validateProvider(
    provider: IPerpsDataProvider,
  ): Promise<boolean> {
    try {
      // Check if provider has health check method
      if (!provider.isHealthy) {
        PerpsProviderFactory.logger.debug(
          `[PerpsProviderFactory] Provider ${provider.getName()} does not implement health check`,
        );
        return true; // Assume healthy if no health check available
      }

      const isHealthy = await provider.isHealthy();
      if (!isHealthy) {
        PerpsProviderFactory.logger.warn(
          `[PerpsProviderFactory] Provider ${provider.getName()} health check failed`,
        );
        return false;
      }

      PerpsProviderFactory.logger.debug(
        `[PerpsProviderFactory] Provider ${provider.getName()} is healthy`,
      );
      return true;
    } catch (error) {
      PerpsProviderFactory.logger.error(
        `[PerpsProviderFactory] Provider validation error: ${error}`,
      );
      return false;
    }
  }
}
