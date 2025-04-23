import dotenv from 'dotenv';
import path from 'path';
import { BlockchainType, SpecificChain } from '../types';

// Environment file selection logic:
// - When NODE_ENV=test, load from .env.test
// - For all other environments (development, production), load from .env
// This allows separate configurations for testing environments
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Log which environment file was loaded (helpful for debugging)
console.log(`Config loaded environment variables from: ${envFile}`);

// Helper function to parse specific chain initial balance environment variables
const getSpecificChainBalances = (): Record<SpecificChain, Record<string, number>> => {
  const result: Partial<Record<SpecificChain, Record<string, number>>> = {};

  // Ethereum Mainnet
  if (
    process.env.INITIAL_ETH_ETH_BALANCE ||
    process.env.INITIAL_ETH_USDC_BALANCE ||
    process.env.INITIAL_ETH_USDT_BALANCE
  ) {
    result.eth = {
      eth: parseInt(process.env.INITIAL_ETH_ETH_BALANCE || '0', 10),
      usdc: parseInt(process.env.INITIAL_ETH_USDC_BALANCE || '0', 10),
      usdt: parseInt(process.env.INITIAL_ETH_USDT_BALANCE || '0', 10),
    };
  }

  // Polygon
  if (process.env.INITIAL_POLYGON_ETH_BALANCE || process.env.INITIAL_POLYGON_USDC_BALANCE) {
    result.polygon = {
      eth: parseInt(process.env.INITIAL_POLYGON_ETH_BALANCE || '0', 10),
      usdc: parseInt(process.env.INITIAL_POLYGON_USDC_BALANCE || '0', 10),
      usdt: parseInt(process.env.INITIAL_POLYGON_USDT_BALANCE || '0', 10),
    };
  }

  // Base
  if (process.env.INITIAL_BASE_ETH_BALANCE || process.env.INITIAL_BASE_USDC_BALANCE) {
    result.base = {
      eth: parseInt(process.env.INITIAL_BASE_ETH_BALANCE || '0', 10),
      usdc: parseInt(process.env.INITIAL_BASE_USDC_BALANCE || '0', 10),
      usdt: parseInt(process.env.INITIAL_BASE_USDT_BALANCE || '0', 10),
    };
  }

  // Arbitrum
  if (
    process.env.INITIAL_ARBITRUM_ETH_BALANCE ||
    process.env.INITIAL_ARBITRUM_USDC_BALANCE ||
    process.env.INITIAL_ARBITRUM_USDT_BALANCE
  ) {
    result.arbitrum = {
      eth: parseInt(process.env.INITIAL_ARBITRUM_ETH_BALANCE || '0', 10),
      usdc: parseInt(process.env.INITIAL_ARBITRUM_USDC_BALANCE || '0', 10),
      usdt: parseInt(process.env.INITIAL_ARBITRUM_USDT_BALANCE || '0', 10),
    };
  }

  // Optimism
  if (
    process.env.INITIAL_OPTIMISM_ETH_BALANCE ||
    process.env.INITIAL_OPTIMISM_USDC_BALANCE ||
    process.env.INITIAL_OPTIMISM_USDT_BALANCE
  ) {
    result.optimism = {
      eth: parseInt(process.env.INITIAL_OPTIMISM_ETH_BALANCE || '0', 10),
      usdc: parseInt(process.env.INITIAL_OPTIMISM_USDC_BALANCE || '0', 10),
      usdt: parseInt(process.env.INITIAL_OPTIMISM_USDT_BALANCE || '0', 10),
      op: parseInt(process.env.INITIAL_OPTIMISM_OP_BALANCE || '0', 10),
    };
  }

  // Solana (for consistency)
  result.svm = {
    sol: parseInt(process.env.INITIAL_SVM_SOL_BALANCE || '0', 10),
    usdc: parseInt(process.env.INITIAL_SVM_USDC_BALANCE || '0', 10),
    usdt: parseInt(process.env.INITIAL_SVM_USDT_BALANCE || '0', 10),
  };

  return result as Record<SpecificChain, Record<string, number>>;
};

// Parse EVM chains configuration
const parseEvmChains = (): SpecificChain[] => {
  const defaultChains: SpecificChain[] = [
    'eth',
    'polygon',
    'bsc',
    'arbitrum',
    'base',
    'optimism',
    'avalanche',
    'linea',
  ];

  if (!process.env.EVM_CHAINS) {
    return defaultChains;
  }

  const configuredChains = process.env.EVM_CHAINS.split(',')
    .map((chain) => chain.trim().toLowerCase())
    .filter((chain) =>
      [
        'eth',
        'polygon',
        'bsc',
        'arbitrum',
        'optimism',
        'avalanche',
        'base',
        'linea',
        'zksync',
        'scroll',
        'mantle',
      ].includes(chain),
    ) as SpecificChain[];

  if (configuredChains.length === 0) {
    return defaultChains;
  }

  return configuredChains;
};

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'solana_trading_simulator',
    ssl: process.env.DB_SSL === 'true',
    url: process.env.POSTGRES_URL,
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  security: {
    rootEncryptionKey:
      process.env.ROOT_ENCRYPTION_KEY || 'default_encryption_key_do_not_use_in_production',
  },
  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  leaderboardAccess: process.env.DISABLE_PARTICIPANT_LEADERBOARD_ACCESS === 'true',
  // Specific chain initial balances
  specificChainBalances: getSpecificChainBalances(),
  // Specific chain token addresses
  specificChainTokens: {
    eth: {
      eth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH on Ethereum
      usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
      usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT on Ethereum
    },
    polygon: {
      eth: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', // Weth on Polygon
      usdc: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon
      usdt: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT on Polygon
    },
    base: {
      eth: '0x4200000000000000000000000000000000000006', // WETH on Base
      usdc: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', // USDbC on Base
      usdt: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', // USDT on Base
    },
    svm: {
      sol: 'So11111111111111111111111111111111111111112',
      usdc: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      usdt: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    },
    arbitrum: {
      eth: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', // WETH on Arbitrum
      usdc: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // Native USDC on Arbitrum
      usdt: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', // USDT on Arbitrum
    },
    optimism: {
      eth: '0x4200000000000000000000000000000000000006', // WETH on Optimism
      usdc: '0x7f5c764cbc14f9669b88837ca1490cca17c31607', // USDC on Optimism
      usdt: '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58', // USDT on Optimism
    },
  },
  // EVM chain configuration
  evmChains: parseEvmChains(),
  api: {
    noves: {
      apiKey: process.env.NOVES_API_KEY || '',
      enabled: !!process.env.NOVES_API_KEY,
    },
  },
  priceCacheDuration: parseInt(process.env.PRICE_CACHE_MS || '30000', 10), // 30 seconds
  portfolio: {
    // Default snapshot interval: 2 minutes (120000ms), configurable via env
    snapshotIntervalMs: parseInt(process.env.PORTFOLIO_SNAPSHOT_INTERVAL_MS || '120000', 10),
    // How fresh a price needs to be to reuse directly from DB (default: 10 minutes)
    priceFreshnessMs: parseInt(process.env.PORTFOLIO_PRICE_FRESHNESS_MS || '600000', 10),
  },
  // Whether to allow generation of mock price history data when real data is not available
  // Defaults to true in development/test, false in production
  allowMockPriceHistory: process.env.ALLOW_MOCK_PRICE_HISTORY
    ? process.env.ALLOW_MOCK_PRICE_HISTORY === 'true'
    : process.env.NODE_ENV !== 'production',
  // Maximum trade size as percentage of portfolio value
  // Defaults to 25% if not specified
  maxTradePercentage: parseInt(process.env.MAX_TRADE_PERCENTAGE || '25', 10),
};

/**
 * Feature flag configurations
 */
export const features = {
  // Enable or disable cross-chain trading functionality
  // When set to false, trades can only occur between tokens on the same chain
  // Defaults to false for security, must be explicitly enabled
  ALLOW_CROSS_CHAIN_TRADING: process.env.ALLOW_CROSS_CHAIN_TRADING === 'true',
};

export default config;
