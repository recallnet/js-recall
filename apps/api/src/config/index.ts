import dotenv from "dotenv";
import path from "path";

import { CrossChainTradingType, SpecificChain } from "@/types/index.js";

// Simple console logging for config initialization (before full logger setup)
const configLogger = {
  info: (message: string) => console.log(`[Config] ${message}`),
  error: (message: string, error?: Error) =>
    console.error(`[Config] ${message}`, error),
  warn: (message: string) => console.warn(`[Config] ${message}`),
  debug: (message: string) => console.debug(`[Config] ${message}`),
};

// Environment file selection logic:
// - When NODE_ENV=test, load from .env.test
// - For all other environments (development, production), load from .env
// This allows separate configurations for testing environments
const envFile =
  process.env.NODE_ENV === "test"
    ? ".env.test"
    : process.env.NODE_ENV === "sandbox"
      ? ".env.sandbox"
      : ".env";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Log which environment file was loaded (helpful for debugging)
configLogger.info(`Config loaded environment variables from: ${envFile}`);

// Helper function to parse specific chain initial balance environment variables
const getSpecificChainBalances = (): Record<
  SpecificChain,
  Record<string, number>
> => {
  const result: Partial<Record<SpecificChain, Record<string, number>>> = {};

  // Ethereum Mainnet
  if (
    process.env.INITIAL_ETH_ETH_BALANCE ||
    process.env.INITIAL_ETH_USDC_BALANCE ||
    process.env.INITIAL_ETH_USDT_BALANCE
  ) {
    result.eth = {
      eth: parseInt(process.env.INITIAL_ETH_ETH_BALANCE || "0", 10),
      usdc: parseInt(process.env.INITIAL_ETH_USDC_BALANCE || "0", 10),
      usdt: parseInt(process.env.INITIAL_ETH_USDT_BALANCE || "0", 10),
    };
  }

  // Polygon
  if (
    process.env.INITIAL_POLYGON_ETH_BALANCE ||
    process.env.INITIAL_POLYGON_USDC_BALANCE
  ) {
    result.polygon = {
      eth: parseInt(process.env.INITIAL_POLYGON_ETH_BALANCE || "0", 10),
      usdc: parseInt(process.env.INITIAL_POLYGON_USDC_BALANCE || "0", 10),
      usdt: parseInt(process.env.INITIAL_POLYGON_USDT_BALANCE || "0", 10),
    };
  }

  // Base
  if (
    process.env.INITIAL_BASE_ETH_BALANCE ||
    process.env.INITIAL_BASE_USDC_BALANCE
  ) {
    result.base = {
      eth: parseInt(process.env.INITIAL_BASE_ETH_BALANCE || "0", 10),
      usdc: parseInt(process.env.INITIAL_BASE_USDC_BALANCE || "0", 10),
      usdt: parseInt(process.env.INITIAL_BASE_USDT_BALANCE || "0", 10),
    };
  }

  // Arbitrum
  if (
    process.env.INITIAL_ARBITRUM_ETH_BALANCE ||
    process.env.INITIAL_ARBITRUM_USDC_BALANCE ||
    process.env.INITIAL_ARBITRUM_USDT_BALANCE
  ) {
    result.arbitrum = {
      eth: parseInt(process.env.INITIAL_ARBITRUM_ETH_BALANCE || "0", 10),
      usdc: parseInt(process.env.INITIAL_ARBITRUM_USDC_BALANCE || "0", 10),
      usdt: parseInt(process.env.INITIAL_ARBITRUM_USDT_BALANCE || "0", 10),
    };
  }

  // Optimism
  if (
    process.env.INITIAL_OPTIMISM_ETH_BALANCE ||
    process.env.INITIAL_OPTIMISM_USDC_BALANCE ||
    process.env.INITIAL_OPTIMISM_USDT_BALANCE
  ) {
    result.optimism = {
      eth: parseInt(process.env.INITIAL_OPTIMISM_ETH_BALANCE || "0", 10),
      usdc: parseInt(process.env.INITIAL_OPTIMISM_USDC_BALANCE || "0", 10),
      usdt: parseInt(process.env.INITIAL_OPTIMISM_USDT_BALANCE || "0", 10),
      op: parseInt(process.env.INITIAL_OPTIMISM_OP_BALANCE || "0", 10),
    };
  }

  // Solana (for consistency)
  result.svm = {
    sol: parseInt(process.env.INITIAL_SVM_SOL_BALANCE || "0", 10),
    usdc: parseInt(process.env.INITIAL_SVM_USDC_BALANCE || "0", 10),
    usdt: parseInt(process.env.INITIAL_SVM_USDT_BALANCE || "0", 10),
  };

  return result as Record<SpecificChain, Record<string, number>>;
};

// Parse EVM chains configuration
const parseEvmChains = (): SpecificChain[] => {
  const defaultChains: SpecificChain[] = [
    "eth",
    "polygon",
    "bsc",
    "arbitrum",
    "base",
    "optimism",
    "avalanche",
    "linea",
  ];

  if (!process.env.EVM_CHAINS) {
    return defaultChains;
  }

  const configuredChains = process.env.EVM_CHAINS.split(",")
    .map((chain) => chain.trim().toLowerCase())
    .filter((chain) =>
      [
        "eth",
        "polygon",
        "bsc",
        "arbitrum",
        "optimism",
        "avalanche",
        "base",
        "linea",
        "zksync",
        "scroll",
        "mantle",
      ].includes(chain),
    ) as SpecificChain[];

  if (configuredChains.length === 0) {
    return defaultChains;
  }

  return configuredChains;
};

/**
 * Validates that a port number is in valid range and not conflicting
 */
function validatePort(
  port: number,
  name: string,
  otherPorts: number[] = [],
): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `${name} must be a valid port number (1-65535), got: ${port}`,
    );
  }

  if (otherPorts.includes(port)) {
    throw new Error(`${name} (${port}) conflicts with another configured port`);
  }
}

// Parse and validate ports
const mainPort = parseInt(process.env.PORT || "3000", 10);
const metricsPort = parseInt(process.env.METRICS_PORT || "3003", 10);

// Validate port configuration
validatePort(mainPort, "PORT");
validatePort(metricsPort, "METRICS_PORT", [mainPort]);

export const config = {
  server: {
    port: mainPort,
    // TODO: these ports are going to be put into the openapi json spec, so they can't really be set at runtime, wtd?
    testPort: 3001,
    metricsPort,
    metricsHost: process.env.METRICS_HOST || "127.0.0.1", // Secure by default
    nodeEnv: process.env.NODE_ENV || "development",
    apiPrefix: process.env.API_PREFIX || "",
    sandboxUrl: "https://api.sandbox.competitions.recall.network",
  },
  email: {
    autoVerifyUserEmail: process.env.ENABLE_AUTO_VERIFY_USER_EMAIL === "true",
    apiKey: process.env.LOOPS_API_KEY || "",
    transactionalId: process.env.LOOPS_TRANSACTIONAL_ID || "",
  },
  // Frontend app configuration for interfacing with the server
  app: {
    // Session management and email verification settings for the frontend competitions app
    url: process.env.FRONTEND_URL || "http://localhost:3001", // TODO: resolve frontend/backend default ports
    // CORS multi-origin requests and cookie domain
    domain: process.env.DOMAIN,
    cookieName: process.env.COOKIE_NAME || "session",
    sessionPassword:
      process.env.ROOT_ENCRYPTION_KEY ||
      "default_encryption_key_do_not_use_in_production",
    sessionTtl: parseInt(process.env.SESSION_TTL || "7200", 10),
  },
  database: {
    ssl: process.env.DB_SSL === "true",
    maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || "10", 10),
    url:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/trading_simulator",
    readReplicaUrl:
      process.env.DATABASE_READ_REPLICA_URL ||
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/trading_simulator",
  },
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  security: {
    rootEncryptionKey:
      process.env.ROOT_ENCRYPTION_KEY ||
      "default_encryption_key_do_not_use_in_production",
  },
  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
  },
  leaderboardAccess:
    process.env.DISABLE_PARTICIPANT_LEADERBOARD_ACCESS === "true",
  // Specific chain initial balances
  specificChainBalances: getSpecificChainBalances(),
  // Specific chain token addresses
  specificChainTokens: {
    eth: {
      eth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH on Ethereum
      usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on Ethereum
      usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT on Ethereum
    },
    polygon: {
      eth: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // Weth on Polygon
      usdc: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC on Polygon
      usdt: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // USDT on Polygon
    },
    base: {
      eth: "0x4200000000000000000000000000000000000006", // WETH on Base
      usdc: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", // USDbC on Base
      usdt: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", // USDT on Base
    },
    svm: {
      sol: "So11111111111111111111111111111111111111112",
      usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      usdt: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    },
    arbitrum: {
      eth: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", // WETH on Arbitrum
      usdc: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", // Native USDC on Arbitrum
      usdt: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", // USDT on Arbitrum
    },
    optimism: {
      eth: "0x4200000000000000000000000000000000000006", // WETH on Optimism
      usdc: "0x7f5c764cbc14f9669b88837ca1490cca17c31607", // USDC on Optimism
      usdt: "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58", // USDT on Optimism
    },
  },
  // EVM chain configuration
  evmChains: parseEvmChains(),
  api: {
    noves: {
      apiKey: process.env.NOVES_API_KEY || "",
      enabled: !!process.env.NOVES_API_KEY,
    },
    // Domain for API authentication and verification purposes
    domain:
      process.env.API_DOMAIN || "https://api.competitions.recall.network/",
  },

  priceTracker: {
    // Maximum number of entries for the token price cache
    maxCacheSize: parseInt(process.env.PRICE_CACHE_MAX_SIZE || "10000", 10),
    // TTL for token price cache entries - how fresh a price needs to be to be reused from cache
    priceTTLMs: parseInt(process.env.PRICE_CACHE_TTL_MS || "60000", 10),
  },
  // Whether to allow generation of mock price history data when real data is not available
  // Defaults to true in development/test, false in production
  allowMockPriceHistory: process.env.ALLOW_MOCK_PRICE_HISTORY
    ? process.env.ALLOW_MOCK_PRICE_HISTORY === "true"
    : process.env.NODE_ENV !== "production",
  // Maximum trade size as percentage of portfolio value
  // Defaults to 25% if not specified
  maxTradePercentage: parseInt(process.env.MAX_TRADE_PERCENTAGE || "25", 10),
  // Trading constraints configuration
  tradingConstraints: {
    // Default minimum pair age in hours (7 days)
    defaultMinimumPairAgeHours: parseInt(
      process.env.DEFAULT_MINIMUM_PAIR_AGE_HOURS || "168",
      10,
    ),
    // Default minimum 24h volume in USD ($100,000)
    defaultMinimum24hVolumeUsd: parseInt(
      process.env.DEFAULT_MINIMUM_24H_VOLUME_USD || "100000",
      10,
    ),
    // Default minimum liquidity in USD ($100,000)
    defaultMinimumLiquidityUsd: parseInt(
      process.env.DEFAULT_MINIMUM_LIQUIDITY_USD || "100000",
      10,
    ),
    // Default minimum FDV in USD ($1,000,000)
    defaultMinimumFdvUsd: parseInt(
      process.env.DEFAULT_MINIMUM_FDV_USD || "1000000",
      10,
    ),
  },

  // Logging configuration
  logging: {
    // Sample rate for repository timing logs (0.0 to 1.0)
    // 0.1 = 10% of operations logged - good balance of visibility vs volume
    repositorySampleRate: parseFloat(
      process.env.REPOSITORY_LOG_SAMPLE_RATE || "0.1",
    ),
    // Sample rate for HTTP request logs (0.0 to 1.0)
    httpSampleRate: parseFloat(process.env.HTTP_LOG_SAMPLE_RATE || "0.1"),
    level: process.env.LOG_LEVEL || "info",
  },

  // Cache configuration
  cache: {
    // Active competition cache TTL in milliseconds (default: 3 seconds)
    activeCompetitionTtlMs: parseInt(
      process.env.CACHE_ACTIVE_COMP_TTL_MS || "3000",
      10,
    ),
  },
};

/**
 * Feature flag configurations
 */
export const features: {
  CROSS_CHAIN_TRADING_TYPE: CrossChainTradingType;
  SANDBOX_MODE: boolean;
} = {
  // Enable or disable cross-chain trading functionality
  // When set to false, trades can only occur between tokens on the same chain
  // Defaults to false for security, must be explicitly enabled
  CROSS_CHAIN_TRADING_TYPE: "disallowAll",
  // Enable or disable sandbox mode for auto-joining newly registered agents
  // When set to true, newly registered agents are automatically joined to active competitions
  // Defaults to false, overridden by active competition configuration
  SANDBOX_MODE: false,
};

/**
 * Reload security-related configuration from environment variables
 * This is used when environment variables are updated at runtime (e.g., during admin setup)
 */
export function reloadSecurityConfig(): void {
  const newRootKey =
    process.env.ROOT_ENCRYPTION_KEY ||
    "default_encryption_key_do_not_use_in_production";

  config.security.rootEncryptionKey = newRootKey;
  config.app.sessionPassword = newRootKey;

  configLogger.info(
    "Security configuration reloaded with updated ROOT_ENCRYPTION_KEY",
  );
}

export default config;
