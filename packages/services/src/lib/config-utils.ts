import { SpecificChain, SpecificChainBalances } from "../types/index.js";

/**
 * Zero address used to represent native tokens (ETH, MATIC, etc.) in EVM chains
 * This address is used for storage and identification, not for price lookup
 */
export const NATIVE_TOKEN_ADDRESS =
  "0x0000000000000000000000000000000000000000";

/**
 * Native token symbols by chain
 */
export const NATIVE_TOKEN_SYMBOLS: Record<string, string> = {
  eth: "ETH",
  base: "ETH",
  arbitrum: "ETH",
  optimism: "ETH",
  polygon: "MATIC",
  avalanche: "AVAX",
  linea: "ETH",
  zksync: "ETH",
  scroll: "ETH",
  mantle: "MNT",
};

/**
 * Check if a token address is the native token (zero address)
 * @param tokenAddress The token address to check
 * @returns True if the address is the native token address
 */
export function isNativeToken(tokenAddress: string): boolean {
  return tokenAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();
}

/**
 * Get the wrapped native token address (WETH/WSOL) for a given chain
 * Used for price lookups since DEX APIs use wrapped versions, not native tokens
 * @param chain The specific chain
 * @returns Wrapped native address for the chain, or undefined if not configured
 */
export function getWrappedNativeAddress(
  chain: SpecificChain,
): string | undefined {
  const chainTokens =
    specificChainTokens[chain as keyof typeof specificChainTokens];
  if (!chainTokens) return undefined;

  // Each chain has its own native token key
  // SVM: sol, Polygon: matic, Avalanche: avax, Mantle: mnt, others: eth
  if (chain === "svm" && "sol" in chainTokens) {
    return chainTokens.sol;
  }
  if (chain === "polygon" && "matic" in chainTokens) {
    return chainTokens.matic;
  }
  if (chain === "avalanche" && "avax" in chainTokens) {
    return chainTokens.avax;
  }
  if (chain === "mantle" && "mnt" in chainTokens) {
    return chainTokens.mnt;
  }
  if ("eth" in chainTokens) {
    return chainTokens.eth;
  }
  return undefined;
}

/**
 * Map a token address for price lookup
 * If the token is native (zero address), returns the WETH address for that chain
 * Otherwise returns the original address
 * @param tokenAddress The token address (may be zero address for native)
 * @param chain The specific chain
 * @returns The address to use for price lookup
 */
export function getTokenAddressForPriceLookup(
  tokenAddress: string,
  chain: SpecificChain,
): string {
  if (isNativeToken(tokenAddress)) {
    const wethAddress = getWrappedNativeAddress(chain);
    if (wethAddress) {
      return wethAddress;
    }
    // Fallback: return original address if no WETH configured for chain
    // This will likely fail price lookup, but better than silently using wrong address
  }
  return tokenAddress;
}

/**
 * Get the native token symbol for a chain
 * @param chain The specific chain
 * @returns Native token symbol (e.g., "ETH", "MATIC")
 */
export function getNativeTokenSymbol(chain: string): string {
  return NATIVE_TOKEN_SYMBOLS[chain] ?? "ETH";
}

/**
 * Token addresses for each supported chain
 * Shared constant used by both API and comps apps
 */
export const specificChainTokens = {
  eth: {
    eth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH on Ethereum
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on Ethereum
    usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT on Ethereum
  },
  polygon: {
    matic: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC - wrapped native MATIC
    eth: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // Bridged WETH (not native)
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    usdt: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  },
  base: {
    eth: "0x4200000000000000000000000000000000000006", // WETH on Base
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Native USDC on Base
    usdt: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", // Bridged USDT on Base
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
    eth: "0x4200000000000000000000000000000000000006",
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    usdt: "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58",
  },
  avalanche: {
    avax: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", // WAVAX - wrapped native AVAX
    usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", // Native USDC (Circle)
  },
  linea: {
    eth: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f", // WETH on Linea
    usdc: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff", // Native USDC (upgraded from bridged March 2025)
  },
  zksync: {
    eth: "0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91", // WETH on zkSync Era
    usdc: "0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4", // Native USDC (Circle)
  },
  scroll: {
    eth: "0x5300000000000000000000000000000000000004", // WETH on Scroll
    usdc: "0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4", // Native USDC
  },
  mantle: {
    mnt: "0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8", // WMNT - wrapped native MNT
    usdc: "0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9", // Bridged USDC (no native USDC on Mantle yet)
  },
} as const;

/**
 * Token decimals by token type key (as used in specificChainTokens)
 *
 * These values are blockchain constants that don't change.
 * The integration test suite verifies these against on-chain data.
 */
const TOKEN_DECIMALS_BY_TYPE = {
  // Stablecoins - 6 decimals
  usdc: 6,
  usdt: 6,

  // Wrapped native tokens - 18 decimals (standard for ETH-like chains)
  eth: 18, // WETH on all EVM chains
  matic: 18, // WMATIC on Polygon
  avax: 18, // WAVAX on Avalanche
  mnt: 18, // WMNT on Mantle

  // Solana native - 9 decimals
  sol: 9,
} as const;

/**
 * Known token decimals by normalized (lowercased) address
 *
 * Built dynamically from specificChainTokens + TOKEN_DECIMALS_BY_TYPE
 * to avoid address duplication and keep data in sync.
 *
 * Used as a reliable fallback when RPC decimals() calls fail,
 * preventing incorrect 18-decimal assumptions for non-18 decimal tokens
 * (e.g., USDC with 6 decimals being treated as 18 would be off by 10^12).
 *
 * IMPORTANT: The integration test `rpc-spot-integration.test.ts` validates
 * all entries against actual on-chain RPC calls to ensure correctness.
 */
export const KNOWN_TOKEN_DECIMALS: ReadonlyMap<string, number> = (() => {
  const map = new Map<string, number>();

  for (const tokens of Object.values(specificChainTokens)) {
    for (const [tokenType, address] of Object.entries(tokens)) {
      const decimals =
        TOKEN_DECIMALS_BY_TYPE[
          tokenType as keyof typeof TOKEN_DECIMALS_BY_TYPE
        ];
      if (decimals !== undefined) {
        map.set(address.toLowerCase(), decimals);
      }
    }
  }

  return map;
})();

/**
 * Get known token decimals from the hardcoded map
 *
 * @param tokenAddress The token contract address (case-insensitive)
 * @returns The known decimals, or undefined if token is not in the known list
 */
export function getKnownTokenDecimals(
  tokenAddress: string,
): number | undefined {
  return KNOWN_TOKEN_DECIMALS.get(tokenAddress.toLowerCase());
}

/**
 * Parse EVM chains configuration from environment variable
 * Used by both API and comps apps to ensure consistent chain configuration
 */
export function parseEvmChains(): SpecificChain[] {
  const defaultChains: SpecificChain[] = [
    "eth",
    "polygon",
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
export function getSpecificChainBalances(): SpecificChainBalances {
  const result: SpecificChainBalances = {};

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

  return result;
}
