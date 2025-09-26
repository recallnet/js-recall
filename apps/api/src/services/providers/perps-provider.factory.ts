import { config } from "@/config/index.js";
import { serviceLogger } from "@/lib/logger.js";
import { SymphonyPerpsProvider } from "@/services/providers/perps/symphony-perps.provider.js";
import { IPerpsDataProvider, PerpsProviderConfig } from "@/types/perps.js";

/**
 * Factory for creating perps data providers based on configuration
 */
export class PerpsProviderFactory {
  /**
   * Create a perps data provider based on the configuration
   */
  static createProvider(config: PerpsProviderConfig): IPerpsDataProvider {
    serviceLogger.info(
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
    // Use API URL from competition config or fall back to global config
    const symphonyApiUrl = apiUrl || config.symphony.apiUrl;
    return new SymphonyPerpsProvider(symphonyApiUrl);
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
        serviceLogger.debug(
          `[PerpsProviderFactory] Provider ${provider.getName()} does not implement health check`,
        );
        return true; // Assume healthy if no health check available
      }

      const isHealthy = await provider.isHealthy();
      if (!isHealthy) {
        serviceLogger.warn(
          `[PerpsProviderFactory] Provider ${provider.getName()} health check failed`,
        );
        return false;
      }

      serviceLogger.debug(
        `[PerpsProviderFactory] Provider ${provider.getName()} is healthy`,
      );
      return true;
    } catch (error) {
      serviceLogger.error(
        `[PerpsProviderFactory] Provider validation error: ${error}`,
      );
      return false;
    }
  }
}
