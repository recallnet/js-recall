import { Logger } from "pino";

import { MockAlchemyRpcProvider } from "../lib/mock-alchemy-rpc-provider.js";
import {
  ISpotLiveDataProvider,
  ProtocolFilter,
  SpotLiveProviderConfig,
} from "../types/spot-live.js";
import { AlchemyRpcProvider } from "./spot-live/alchemy-rpc.provider.js";
import { RpcSpotProvider } from "./spot-live/rpc-spot.provider.js";

/**
 * Factory for creating spot live data providers based on configuration
 * Mirrors PerpsProviderFactory pattern for consistency
 */
export class SpotLiveProviderFactory {
  /**
   * Create a spot live data provider based on the configuration
   * @param config Provider configuration from database
   * @param protocolFilters Optional protocol filters for partnership competitions
   * @param logger Logger instance
   * @returns Configured spot live data provider
   */
  static createProvider(
    config: SpotLiveProviderConfig,
    protocolFilters: ProtocolFilter[],
    logger: Logger,
  ): ISpotLiveDataProvider {
    logger.info(
      {
        type: config.type,
        provider: config.provider,
        chains: config.chains,
        protocolFiltersCount: protocolFilters.length,
      },
      `[SpotLiveProviderFactory] Creating provider`,
    );

    switch (config.type) {
      case "rpc_direct":
        return SpotLiveProviderFactory.createRpcDirectProvider(
          config,
          protocolFilters,
          logger,
        );

      case "envio_indexing":
        // Placeholder for future implementation
        throw new Error("Envio indexing providers not yet implemented");

      case "hybrid":
        // Placeholder for future implementation
        throw new Error("Hybrid providers not yet implemented");

      default:
        throw new Error(
          `Unsupported spot live data source type: ${config.type}`,
        );
    }
  }

  /**
   * Create RPC direct provider (Alchemy, QuickNode, etc.)
   * @param config Provider configuration
   * @param protocolFilters Protocol filters
   * @param logger Logger instance
   * @returns RPC-based spot live provider
   */
  private static createRpcDirectProvider(
    config: SpotLiveProviderConfig,
    protocolFilters: ProtocolFilter[],
    logger: Logger,
  ): ISpotLiveDataProvider {
    // Validate RPC-specific config
    if (!config.provider) {
      throw new Error(
        "Provider name required for rpc_direct type (e.g., 'alchemy', 'quicknode')",
      );
    }

    if (!config.rpcUrls) {
      throw new Error("RPC URLs required for rpc_direct provider");
    }

    // Get API key from environment based on provider
    const apiKey = this.getRpcApiKey(config.provider);
    if (!apiKey) {
      throw new Error(
        `API key not found for ${config.provider}. Set ${this.getApiKeyEnvVar(config.provider)} environment variable.`,
      );
    }

    // Create underlying RPC provider
    const rpcProvider = this.createRpcProvider(config.provider, apiKey, logger);

    // Wrap with spot-specific logic (swap detection, protocol filtering)
    return new RpcSpotProvider(rpcProvider, protocolFilters, logger);
  }

  /**
   * Create underlying RPC provider based on provider name
   * @param provider Provider name (alchemy, quicknode, etc.)
   * @param apiKey API key for the provider
   * @param logger Logger instance
   * @returns RPC provider implementation
   */
  private static createRpcProvider(
    provider: string,
    apiKey: string,
    logger: Logger,
  ) {
    // In test mode, use mock RPC provider (matches MockPrivyClient pattern)
    // This allows E2E tests to use deterministic blockchain data
    // Integration tests bypass this by directly instantiating AlchemyRpcProvider
    if (
      process.env.NODE_ENV === "test" &&
      provider.toLowerCase() === "alchemy"
    ) {
      logger.info(
        `[SpotLiveProviderFactory] Test mode detected - using MockAlchemyRpcProvider`,
      );
      return new MockAlchemyRpcProvider(logger);
    }

    switch (provider.toLowerCase()) {
      case "alchemy":
        return new AlchemyRpcProvider(apiKey, 3, 1000, logger);

      case "quicknode":
        // Placeholder for future QuickNode implementation
        throw new Error("QuickNode provider not yet implemented");

      case "infura":
        // Placeholder for future Infura implementation
        throw new Error("Infura provider not yet implemented");

      default:
        throw new Error(`Unknown RPC provider: ${provider}`);
    }
  }

  /**
   * Get API key from environment for the specified provider
   * @param provider Provider name
   * @returns API key or undefined if not found
   */
  private static getRpcApiKey(provider: string): string | undefined {
    const envVar = this.getApiKeyEnvVar(provider);
    return process.env[envVar];
  }

  /**
   * Get environment variable name for provider API key
   * @param provider Provider name
   * @returns Environment variable name
   */
  private static getApiKeyEnvVar(provider: string): string {
    switch (provider.toLowerCase()) {
      case "alchemy":
        return "ALCHEMY_API_KEY";
      case "quicknode":
        return "QUICKNODE_API_KEY";
      case "infura":
        return "INFURA_API_KEY";
      default:
        return `${provider.toUpperCase()}_API_KEY`;
    }
  }

  /**
   * Validate provider health
   * @param provider Provider to validate
   * @param logger Logger instance
   * @returns True if provider is healthy
   */
  static async validateProvider(
    provider: ISpotLiveDataProvider,
    logger: Logger,
  ): Promise<boolean> {
    try {
      if (!provider.isHealthy) {
        return true; // Assume healthy if no health check
      }

      const isHealthy = await provider.isHealthy();
      logger.debug(
        {
          provider: provider.getName(),
          isHealthy,
        },
        `[SpotLiveProviderFactory] Provider health check`,
      );
      return isHealthy;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          provider: provider.getName(),
        },
        `[SpotLiveProviderFactory] Provider validation error`,
      );
      return false;
    }
  }
}
