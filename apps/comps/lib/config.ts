import {
  SPECIFIC_CHAIN_TOKENS,
  getSpecificChainBalances,
  parseEvmChains,
} from "@recallnet/services";

/**
 * Configuration for the comps application
 * Uses shared config utilities from @recallnet/services to ensure
 * consistent behavior with the API
 */
export const config = {
  security: {
    rootEncryptionKey:
      process.env.ROOT_ENCRYPTION_KEY ||
      "default_dev_key_do_not_use_in_production",
  },
  api: {
    domain:
      process.env.API_DOMAIN || "https://api.competitions.recall.network/",
  },
  // Initial balances for agents when joining competitions
  // Parsed from environment variables to match API behavior
  specificChainBalances: getSpecificChainBalances(),
  // Token addresses for each supported chain (shared constant)
  specificChainTokens: SPECIFIC_CHAIN_TOKENS,
  // EVM chains configuration - parsed from environment or defaults
  evmChains: parseEvmChains(),
  // Price tracker configuration
  // Allows environment configuration like the API
  priceTracker: {
    maxCacheSize: parseInt(process.env.PRICE_CACHE_MAX_SIZE || "10000", 10),
    priceTTLMs: parseInt(process.env.PRICE_CACHE_TTL_MS || "60000", 10),
  },
};
