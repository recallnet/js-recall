import dotenv from "dotenv";
import path from "path";

import {
  getSpecificChainBalances,
  parseEvmChains,
  specificChainTokens,
} from "@recallnet/services/lib";
import {
  CoinGeckoMode,
  CrossChainTradingType,
  PriceProvider,
} from "@recallnet/services/types";

import { createSentryConfig } from "@/lib/sentry-config.js";

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
    apiKey: process.env.LOOPS_API_KEY || "",
    mailingListId: process.env.LOOPS_MAILING_LIST_ID || "",
    // Allow overriding Loops base URL for testing/mocking
    baseUrl: process.env.LOOPS_BASE_URL || "https://app.loops.so/api/v1",
  },
  privy: {
    appId: process.env.PRIVY_APP_ID || "",
    appSecret: process.env.PRIVY_APP_SECRET || "",
    jwksPublicKey: process.env.PRIVY_JWKS_PUBLIC_KEY || "",
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
    disable: process.env.DISABLE_RATE_LIMITER === "true",
  },
  leaderboardAccess:
    process.env.DISABLE_PARTICIPANT_LEADERBOARD_ACCESS === "true",
  // Specific chain initial balances
  specificChainBalances: getSpecificChainBalances(),
  // Specific chain token addresses
  specificChainTokens,
  // EVM chain configuration
  evmChains: parseEvmChains(),
  api: {
    // Domain for API authentication and verification purposes
    domain:
      process.env.API_DOMAIN || "https://api.competitions.recall.network/",
  },
  // Multichain price provider configuration (DexScreener or CoinGecko) for paper trading
  priceProvider: {
    // Defaults to DexScreener (note: this provider does not require an API key)
    type: (process.env.PRICE_PROVIDER || "dexscreener") as PriceProvider,
    // For CoinGecko, an API key is required, which use different API URLs depending on the type
    coingecko: {
      apiKey: process.env.COINGECKO_API_KEY || "",
      mode: (process.env.COINGECKO_MODE ||
        // Non-production environments should use the highly rate limited, free "demo" API key (30 req/min)
        (process.env.NODE_ENV === "production"
          ? "pro"
          : "demo")) as CoinGeckoMode,
    },
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
    // Middleware: Active competition cache TTL in milliseconds (default: 3 seconds)
    activeCompetitionTtlMs: parseInt(
      process.env.CACHE_ACTIVE_COMP_TTL_MS || "3000",
      10,
    ),
    // Cache settings on individual API endpoints (see controllers for the specific routes)
    api: {
      disableCaching: process.env.DISABLE_CACHE_API === "true",
      leaderboard: {
        maxCacheSize: parseInt(
          process.env.CACHE_API_LEADERBOARD_MAX_CACHE_SIZE || "100",
          10,
        ),
        ttlMs: parseInt(
          process.env.CACHE_API_LEADERBOARD_TTL_MS || "1800000", // 30 minutes
          10,
        ),
      },
      competitions: {
        maxCacheSize: parseInt(
          process.env.CACHE_API_COMPETITION_MAX_CACHE_SIZE || "100",
          10,
        ),
        ttlMs: parseInt(
          process.env.CACHE_API_COMPETITION_TTL_MS || "300000", // 5 minutes
          10,
        ),
      },
    },
  },
  stakingIndex: {
    isEnabled: process.env.INDEXING_ENABLED === "true",
    stakingContract: process.env.INDEXING_STAKING_CONTRACT,
    rewardsContract: process.env.INDEXING_REWARDS_CONTRACT,
    startBlock: process.env.INDEXING_START_BLOCK
      ? parseInt(process.env.INDEXING_START_BLOCK, 10)
      : 27459229,
    hypersyncUrl: process.env.INDEXING_HYPERSYNC_URL,
    hypersyncBearerToken: process.env.INDEXING_HYPERSYNC_BEARER_TOKEN,
    delayMs: process.env.INDEXING_DELAY
      ? parseInt(process.env.INDEXING_DELAY, 10)
      : 3000,
  },
  // Sentry configuration (imported from shared config)
  sentry: createSentryConfig(),
  // Rewards allocation configuration
  rewards: {
    // Whether to use the externally owned account allocator
    eoaEnabled: process.env.REWARDS_EOA_ENABLED === "true",
    // Private key for the rewards allocator account
    eoaPrivateKey: process.env.REWARDS_EOA_PRIVATE_KEY || "",

    // Whether to use the Safe transaction proposer
    safeProposerEnabled: process.env.REWARDS_SAFE_PROPOSER_ENABLED === "true",
    // Private key for the Safe transaction proposer
    safeProposerPrivateKey: process.env.REWARDS_SAFE_PROPOSER_PRIVATE_KEY || "",
    // Address of the Safe contract
    safeAddress: process.env.REWARDS_SAFE_ADDRESS || "",
    // API key for the Safe API
    safeApiKey: process.env.REWARDS_SAFE_API_KEY || "",

    // Contract address for the rewards contract
    contractAddress: process.env.REWARDS_CONTRACT_ADDRESS || "",
    // Contract address of the ERC20 token
    tokenContractAddress: process.env.REWARDS_TOKEN_CONTRACT_ADDRESS || "",
    // RPC provider URL for blockchain interactions
    rpcProvider: process.env.RPC_PROVIDER || "",
    // Network for the rewards allocator
    network: process.env.REWARDS_NETWORK || "baseSepolia",
  },
  boost: {
    // Amount of boost (in wei) to grant on wallet linking pre TGE
    noStakeBoostAmount: process.env.NO_STAKE_BOOST_AMOUNT
      ? BigInt(process.env.NO_STAKE_BOOST_AMOUNT)
      : undefined,
  },
  // Chainalysis API key
  watchlist: {
    chainalysisApiKey: process.env.CHAINALYSIS_API_KEY || "",
  },
  symphony: {
    apiUrl: process.env.SYMPHONY_API_URL || "https://api.symphony.io",
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
