import { SpecificChain } from "./types/index.js";

/**
 * Token addresses for each supported chain
 * Shared constant used by both API and comps apps
 */
export const SPECIFIC_CHAIN_TOKENS = {
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
} as const;

/**
 * Parse EVM chains configuration from environment variable
 * Used by both API and comps apps to ensure consistent chain configuration
 */
export function parseEvmChains(): SpecificChain[] {
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
}

/**
 * Parse specific chain initial balance environment variables
 * Used by both API and comps apps to ensure consistent initial balance configuration
 */
export function getSpecificChainBalances(): Record<
  SpecificChain,
  Record<string, number>
> {
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
}
